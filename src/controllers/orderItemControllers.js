import pool from "../config/fornecedor_db.js"

async function buscarOrderItems(req, res) {
    try {
        const { rows } = await pool.query("SELECT * FROM order_items")

        res.json([rows])
    } catch (error) {
        res.status(500).json({ erro: "Erro ao buscar itens dos pedidos no banco de dados" })
    }
}

async function inserirOrderItem(req, res) {
    try {
        const { order_id, product_id, quantidade, preco_unitario } = req.body

        if (order_id === undefined || order_id === null || order_id === "" ||
            product_id === undefined || product_id === null || product_id === "" ||
            quantidade === undefined || quantidade === null || quantidade === "" ||
            preco_unitario === undefined || preco_unitario === null || preco_unitario === "") {
            return res.json({ erro: "Todos os campos são obrigatórios!" })
        }

        await pool.query(
            "INSERT INTO order_items (order_id, product_id, quantidade, preco_unitario) VALUES ($1, $2, $3, $4) RETURNING id",
            [order_id, product_id, quantidade, preco_unitario]
        )

        res.json({ sucesso: "O item do pedido foi criado com sucesso!" })
    } catch (error) {
        res.status(500).json({ erro: "Erro ao inserir o item do pedido no banco de dados" })
    }
}

async function alterarOrderItem(req, res) {
    try {
        const { id } = req.params
        const { order_id, product_id, quantidade, preco_unitario } = req.body

        if (order_id === undefined || order_id === null || order_id === "" ||
            product_id === undefined || product_id === null || product_id === "" ||
            quantidade === undefined || quantidade === null || quantidade === "" ||
            preco_unitario === undefined || preco_unitario === null || preco_unitario === "") {
            return res.json({ erro: "Todos os campos são obrigatórios!" })
        }

        await pool.query(
            "UPDATE order_items SET order_id = $1, product_id = $2, quantidade = $3, preco_unitario = $4 WHERE id = $5",
            [order_id, product_id, quantidade, preco_unitario, id]
        )

        res.json({ sucesso: "O item do pedido foi alterado com sucesso!" })
    } catch (error) {
        res.status(500).json({ erro: "Erro ao alterar o item do pedido no banco de dados" })
    }
}

async function deletarOrderItem(req, res) {
    try {
        const { id } = req.params

        await pool.query("DELETE FROM order_items WHERE id = $1", [id])

        res.json({ sucesso: "O item do pedido foi deletado com sucesso!" })
    } catch (error) {
        res.status(500).json({ erro: "Erro ao deletar o item do pedido no banco de dados" })
    }
}

export { buscarOrderItems, inserirOrderItem, alterarOrderItem, deletarOrderItem }
