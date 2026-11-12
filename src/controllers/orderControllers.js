import pool from "../config/fornecedor_db.js"

const ORDER_STATUSES = ["Pendente", "Aprovado", "Enviado", "Cancelado"]

async function buscarOrders(req, res) {
    try {
        const [rows] = req.user.role === "admin"
            ? await pool.execute("SELECT * FROM orders ORDER BY created_at DESC")
            : await pool.execute("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC", [req.user.id])

        res.json([rows])
    } catch (error) {
        res.status(500).json({ erro: "Erro ao buscar pedidos no banco de dados." })
    }
}

async function inserirOrder(req, res) {
    const items = req.body?.items
    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
        return res.status(400).json({ erro: "O pedido deve conter entre 1 e 100 produtos." })
    }

    const quantities = new Map()
    for (const item of items) {
        const productId = Number(item?.product_id)
        const quantity = Number(item?.quantidade)

        if (!Number.isSafeInteger(productId) || productId <= 0 || productId > 2147483647 ||
            !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 2147483647) {
            return res.status(400).json({ erro: "Os produtos e quantidades do pedido são inválidos." })
        }
        const totalQuantity = (quantities.get(productId) || 0) + quantity
        if (totalQuantity > 2147483647) {
            return res.status(400).json({ erro: "A quantidade de um produto excede o limite permitido." })
        }
        quantities.set(productId, totalQuantity)
    }

    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()

        const productIds = [...quantities.keys()]
        const placeholders = productIds.map(() => "?").join(", ")
        const [products] = await connection.execute(
            `SELECT id, nome, preco_atacado, estoque, min_pedido FROM products WHERE id IN (${placeholders}) FOR UPDATE`,
            productIds
        )
        const productsById = new Map(products.map((product) => [Number(product.id), product]))

        if (productsById.size !== productIds.length) {
            await connection.rollback()
            return res.status(400).json({ erro: "Um ou mais produtos não foram encontrados." })
        }

        let totalCents = 0
        for (const [productId, quantity] of quantities) {
            const product = productsById.get(productId)
            if (quantity < Number(product.min_pedido)) {
                await connection.rollback()
                return res.status(400).json({
                    erro: `A quantidade mínima para ${product.nome} é ${product.min_pedido}.`
                })
            }
            if (quantity > Number(product.estoque)) {
                await connection.rollback()
                return res.status(400).json({ erro: `Estoque insuficiente para ${product.nome}.` })
            }
            totalCents += Math.round(Number(product.preco_atacado) * 100) * quantity
            if (!Number.isSafeInteger(totalCents) || totalCents > 9999999999) {
                await connection.rollback()
                return res.status(400).json({ erro: "O valor total do pedido excede o limite permitido." })
            }
        }

        const [orderResult] = await connection.execute(
            "INSERT INTO orders (user_id, status, valor_total) VALUES (?, 'Pendente', ?)",
            [req.user.id, (totalCents / 100).toFixed(2)]
        )
        const orderId = orderResult.insertId

        for (const [productId, quantity] of quantities) {
            const product = productsById.get(productId)
            await connection.execute(
                "INSERT INTO order_items (order_id, product_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)",
                [orderId, productId, quantity, product.preco_atacado]
            )
            await connection.execute(
                "UPDATE products SET estoque = estoque - ? WHERE id = ?",
                [quantity, productId]
            )
            await connection.execute(
                "INSERT INTO stock_movements (product_id, tipo, quantidade, motivo) VALUES (?, 'SAIDA', ?, ?)",
                [productId, quantity, `Reserva do pedido #${orderId}`]
            )
        }

        await connection.commit()
        res.status(201).json({ sucesso: "Pedido criado com sucesso.", id: orderId })
    } catch (error) {
        await connection.rollback()
        res.status(500).json({ erro: "Erro ao criar pedido no banco de dados." })
    } finally {
        connection.release()
    }
}

async function alterarOrder(req, res) {
    const { status } = req.body
    if (!ORDER_STATUSES.includes(status)) {
        return res.status(400).json({ erro: "Status do pedido inválido." })
    }

    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()
        const [orders] = await connection.execute(
            "SELECT id, status FROM orders WHERE id = ? FOR UPDATE",
            [req.params.id]
        )
        if (!orders.length) {
            await connection.rollback()
            return res.status(404).json({ erro: "Pedido não encontrado." })
        }

        const order = orders[0]
        if (order.status === "Cancelado" && status !== "Cancelado") {
            await connection.rollback()
            return res.status(400).json({ erro: "Um pedido cancelado não pode ser reaberto." })
        }
        if (order.status === "Enviado" && status === "Cancelado") {
            await connection.rollback()
            return res.status(400).json({ erro: "Um pedido enviado não pode ser cancelado por esta operação." })
        }

        if (status === "Cancelado" && order.status !== "Cancelado") {
            const [items] = await connection.execute(
                "SELECT product_id, quantidade FROM order_items WHERE order_id = ?",
                [order.id]
            )
            for (const item of items) {
                await connection.execute(
                    "UPDATE products SET estoque = estoque + ? WHERE id = ?",
                    [item.quantidade, item.product_id]
                )
                await connection.execute(
                    "INSERT INTO stock_movements (product_id, tipo, quantidade, motivo) VALUES (?, 'ENTRADA', ?, ?)",
                    [item.product_id, item.quantidade, `Liberação do pedido cancelado #${order.id}`]
                )
            }
        }

        await connection.execute("UPDATE orders SET status = ? WHERE id = ?", [status, order.id])
        await connection.commit()
        res.json({ sucesso: "Status do pedido atualizado." })
    } catch (error) {
        await connection.rollback()
        res.status(500).json({ erro: "Erro ao atualizar o pedido." })
    } finally {
        connection.release()
    }
}

async function deletarOrder(req, res) {
    const connection = await pool.getConnection()
    try {
        await connection.beginTransaction()
        const [orders] = await connection.execute(
            "SELECT id, status FROM orders WHERE id = ? FOR UPDATE",
            [req.params.id]
        )
        if (!orders.length) {
            await connection.rollback()
            return res.status(404).json({ erro: "Pedido não encontrado." })
        }

        const order = orders[0]
        if (order.status === "Enviado") {
            await connection.rollback()
            return res.status(400).json({ erro: "Um pedido enviado não pode ser removido por esta operação." })
        }
        if (order.status !== "Cancelado") {
            const [items] = await connection.execute(
                "SELECT product_id, quantidade FROM order_items WHERE order_id = ?",
                [order.id]
            )
            for (const item of items) {
                await connection.execute(
                    "UPDATE products SET estoque = estoque + ? WHERE id = ?",
                    [item.quantidade, item.product_id]
                )
                await connection.execute(
                    "INSERT INTO stock_movements (product_id, tipo, quantidade, motivo) VALUES (?, 'ENTRADA', ?, ?)",
                    [item.product_id, item.quantidade, `Liberação por remoção do pedido #${order.id}`]
                )
            }
        }

        await connection.execute("DELETE FROM orders WHERE id = ?", [order.id])
        await connection.commit()
        res.json({ sucesso: "Pedido removido." })
    } catch (error) {
        await connection.rollback()
        res.status(500).json({ erro: "Erro ao remover pedido." })
    } finally {
        connection.release()
    }
}

export { buscarOrders, inserirOrder, alterarOrder, deletarOrder }
