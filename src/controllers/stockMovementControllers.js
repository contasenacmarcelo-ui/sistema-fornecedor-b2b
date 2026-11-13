import pool from "../config/fornecedor_db.js"

async function buscarStockMovements(req, res) {
    try {
        const { rows } = await pool.query("SELECT * FROM stock_movements ORDER BY created_at DESC")
        res.json([rows])
    } catch (error) {
        res.status(500).json({ erro: "Erro ao buscar movimentações de estoque." })
    }
}

async function inserirStockMovement(req, res) {
    const body = req.body || {}
    const productId = Number(body.product_id)
    const quantity = Number(body.quantidade)
    const { tipo } = body
    const motivo = typeof body.motivo === "string" && body.motivo.trim()
        ? body.motivo.trim()
        : null

    if (!Number.isSafeInteger(productId) || productId <= 0 ||
        !["ENTRADA", "SAIDA", "AJUSTE"].includes(tipo) ||
        !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 2147483647 ||
        (tipo !== "AJUSTE" && quantity === 0) ||
        (motivo !== null && motivo.length > 255)) {
        return res.status(400).json({ erro: "Produto, tipo e quantidade informados são inválidos." })
    }

    const connection = await pool.connect()
    try {
        await connection.query("BEGIN")
        const { rows: products } = await connection.query(
            "SELECT id, estoque FROM products WHERE id = $1 FOR UPDATE",
            [productId]
        )
        if (!products.length) {
            await connection.query("ROLLBACK")
            return res.status(404).json({ erro: "Produto não encontrado." })
        }

        const currentStock = Number(products[0].estoque)
        const nextStock = tipo === "ENTRADA"
            ? currentStock + quantity
            : tipo === "SAIDA"
                ? currentStock - quantity
                : quantity

        if (nextStock < 0 || nextStock > 2147483647) {
            await connection.query("ROLLBACK")
            return res.status(400).json({ erro: "A movimentação deixaria o estoque fora do limite permitido." })
        }

        await connection.query("UPDATE products SET estoque = $1 WHERE id = $2", [nextStock, productId])
        await connection.query(
            "INSERT INTO stock_movements (product_id, tipo, quantidade, motivo) VALUES ($1, $2, $3, $4) RETURNING id",
            [productId, tipo, quantity, motivo]
        )

        await connection.query("COMMIT")
        res.status(201).json({ sucesso: "Movimentação registrada e estoque atualizado." })
    } catch (error) {
        await connection.query("ROLLBACK")
        res.status(500).json({ erro: "Erro ao registrar movimentação de estoque." })
    } finally {
        connection.release()
    }
}

export { buscarStockMovements, inserirStockMovement }
