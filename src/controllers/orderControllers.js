import pool from "../config/fornecedor_db.js"

const ORDER_STATUSES = ["Pendente", "Aprovado", "Enviado", "Cancelado"]

async function buscarOrders(req, res) {
    try {
        const { rows } = req.user.role === "admin"
            ? await pool.query("SELECT * FROM orders ORDER BY created_at DESC")
            : await pool.query("SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC", [req.user.id])

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

    const connection = await pool.connect()
    try {
        await connection.query("BEGIN")

        const productIds = [...quantities.keys()]
        const { rows: products } = await connection.query(
            "SELECT id, nome, preco_atacado, estoque, min_pedido FROM products WHERE id = ANY($1::int[]) FOR UPDATE",
            [productIds]
        )
        const productsById = new Map(products.map((product) => [Number(product.id), product]))

        if (productsById.size !== productIds.length) {
            await connection.query("ROLLBACK")
            return res.status(400).json({ erro: "Um ou mais produtos não foram encontrados." })
        }

        let totalCents = 0
        for (const [productId, quantity] of quantities) {
            const product = productsById.get(productId)
            if (quantity < Number(product.min_pedido)) {
                await connection.query("ROLLBACK")
                return res.status(400).json({
                    erro: `A quantidade mínima para ${product.nome} é ${product.min_pedido}.`
                })
            }
            if (quantity > Number(product.estoque)) {
                await connection.query("ROLLBACK")
                return res.status(400).json({ erro: `Estoque insuficiente para ${product.nome}.` })
            }
            totalCents += Math.round(Number(product.preco_atacado) * 100) * quantity
            if (!Number.isSafeInteger(totalCents) || totalCents > 9999999999) {
                await connection.query("ROLLBACK")
                return res.status(400).json({ erro: "O valor total do pedido excede o limite permitido." })
            }
        }

        const { rows: orderRows } = await connection.query(
            "INSERT INTO orders (user_id, status, valor_total) VALUES ($1, 'Pendente', $2) RETURNING id",
            [req.user.id, (totalCents / 100).toFixed(2)]
        )
        const orderId = orderRows[0].id

        for (const [productId, quantity] of quantities) {
            const product = productsById.get(productId)
            await connection.query(
                "INSERT INTO order_items (order_id, product_id, quantidade, preco_unitario) VALUES ($1, $2, $3, $4) RETURNING id",
                [orderId, productId, quantity, product.preco_atacado]
            )
            await connection.query(
                "UPDATE products SET estoque = estoque - $1 WHERE id = $2",
                [quantity, productId]
            )
            await connection.query(
                "INSERT INTO stock_movements (product_id, tipo, quantidade, motivo) VALUES ($1, 'SAIDA', $2, $3) RETURNING id",
                [productId, quantity, `Reserva do pedido #${orderId}`]
            )
        }

        await connection.query("COMMIT")
        res.status(201).json({ sucesso: "Pedido criado com sucesso.", id: orderId })
    } catch (error) {
        await connection.query("ROLLBACK")
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

    const connection = await pool.connect()
    try {
        await connection.query("BEGIN")
        const { rows: orders } = await connection.query(
            "SELECT id, status FROM orders WHERE id = $1 FOR UPDATE",
            [req.params.id]
        )
        if (!orders.length) {
            await connection.query("ROLLBACK")
            return res.status(404).json({ erro: "Pedido não encontrado." })
        }

        const order = orders[0]
        if (order.status === "Cancelado" && status !== "Cancelado") {
            await connection.query("ROLLBACK")
            return res.status(400).json({ erro: "Um pedido cancelado não pode ser reaberto." })
        }
        if (order.status === "Enviado" && status === "Cancelado") {
            await connection.query("ROLLBACK")
            return res.status(400).json({ erro: "Um pedido enviado não pode ser cancelado por esta operação." })
        }

        if (status === "Cancelado" && order.status !== "Cancelado") {
            const { rows: items } = await connection.query(
                "SELECT product_id, quantidade FROM order_items WHERE order_id = $1",
                [order.id]
            )
            for (const item of items) {
                await connection.query(
                    "UPDATE products SET estoque = estoque + $1 WHERE id = $2",
                    [item.quantidade, item.product_id]
                )
                await connection.query(
                    "INSERT INTO stock_movements (product_id, tipo, quantidade, motivo) VALUES ($1, 'ENTRADA', $2, $3) RETURNING id",
                    [item.product_id, item.quantidade, `Liberação do pedido cancelado #${order.id}`]
                )
            }
        }

        await connection.query("UPDATE orders SET status = $1 WHERE id = $2", [status, order.id])
        await connection.query("COMMIT")
        res.json({ sucesso: "Status do pedido atualizado." })
    } catch (error) {
        await connection.query("ROLLBACK")
        res.status(500).json({ erro: "Erro ao atualizar o pedido." })
    } finally {
        connection.release()
    }
}

async function deletarOrder(req, res) {
    const connection = await pool.connect()
    try {
        await connection.query("BEGIN")
        const { rows: orders } = await connection.query(
            "SELECT id, status FROM orders WHERE id = $1 FOR UPDATE",
            [req.params.id]
        )
        if (!orders.length) {
            await connection.query("ROLLBACK")
            return res.status(404).json({ erro: "Pedido não encontrado." })
        }

        const order = orders[0]
        if (order.status === "Enviado") {
            await connection.query("ROLLBACK")
            return res.status(400).json({ erro: "Um pedido enviado não pode ser removido por esta operação." })
        }
        if (order.status !== "Cancelado") {
            const { rows: items } = await connection.query(
                "SELECT product_id, quantidade FROM order_items WHERE order_id = $1",
                [order.id]
            )
            for (const item of items) {
                await connection.query(
                    "UPDATE products SET estoque = estoque + $1 WHERE id = $2",
                    [item.quantidade, item.product_id]
                )
                await connection.query(
                    "INSERT INTO stock_movements (product_id, tipo, quantidade, motivo) VALUES ($1, 'ENTRADA', $2, $3) RETURNING id",
                    [item.product_id, item.quantidade, `Liberação por remoção do pedido #${order.id}`]
                )
            }
        }

        await connection.query("DELETE FROM orders WHERE id = $1", [order.id])
        await connection.query("COMMIT")
        res.json({ sucesso: "Pedido removido." })
    } catch (error) {
        await connection.query("ROLLBACK")
        res.status(500).json({ erro: "Erro ao remover pedido." })
    } finally {
        connection.release()
    }
}

export { buscarOrders, inserirOrder, alterarOrder, deletarOrder }
