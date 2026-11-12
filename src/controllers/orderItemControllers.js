import pool from "../config/fornecedor_db.js"

async function buscarOrderItems(req, res) {
    try {
        const [rows] = await pool.execute("SELECT * FROM order_items")

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

        await pool.execute(
            "INSERT INTO order_items (order_id, product_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)",
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

        await pool.execute(
            "UPDATE order_items SET order_id = ?, product_id = ?, quantidade = ?, preco_unitario = ? WHERE id = ?",
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

        await pool.execute("DELETE FROM order_items WHERE id = ?", [id])

        res.json({ sucesso: "O item do pedido foi deletado com sucesso!" })
    } catch (error) {
        res.status(500).json({ erro: "Erro ao deletar o item do pedido no banco de dados" })
    }
}

export { buscarOrderItems, inserirOrderItem, alterarOrderItem, deletarOrderItem }
