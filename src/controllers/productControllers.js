import pool from "../config/fornecedor_db.js"

function readProductFields(body = {}) {
    body = body || {}
    const nome = typeof body.nome === "string" ? body.nome.trim() : ""
    const descricao = typeof body.descricao === "string" && body.descricao.trim()
        ? body.descricao.trim()
        : null
    const preco_atacado = Number(body.preco_atacado)
    const estoque = body.estoque === undefined || body.estoque === "" ? 0 : Number(body.estoque)
    const min_pedido = body.min_pedido === undefined || body.min_pedido === "" ? 1 : Number(body.min_pedido)
    const imagem = typeof body.imagem === "string" && body.imagem.trim()
        ? body.imagem.trim()
        : null

    if (!nome || nome.length > 150 ||
        !Number.isFinite(preco_atacado) || preco_atacado <= 0 || preco_atacado > 99999999.99 ||
        !Number.isSafeInteger(estoque) || estoque < 0 || estoque > 2147483647 ||
        !Number.isSafeInteger(min_pedido) || min_pedido < 1 || min_pedido > 2147483647 ||
        (descricao !== null && descricao.length > 65535) ||
        (imagem !== null && imagem.length > 255)) {
        return null
    }

    return { nome, descricao, preco_atacado, estoque, min_pedido, imagem }
}

async function buscarProducts(req, res) {
    try {
        const { rows } = await pool.query("SELECT * FROM products")

        res.json([rows])
    } catch (error) {
        res.status(500).json({ erro: "Erro ao buscar produtos no banco de dados" })
    }
}

async function inserirProduct(req, res) {
    try {
        const fields = readProductFields(req.body)
        if (!fields) return res.status(400).json({ erro: "Os dados do produto são inválidos." })
        const { nome, descricao, preco_atacado, estoque, min_pedido, imagem } = fields

        await pool.query(
            "INSERT INTO products (nome, descricao, preco_atacado, estoque, min_pedido, imagem) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            [nome, descricao, preco_atacado, estoque, min_pedido, imagem]
        )

        res.status(201).json({ sucesso: "O produto foi criado com sucesso!" })
    } catch (error) {
        res.status(500).json({ erro: "Erro ao inserir o produto no banco de dados" })
    }
}

async function alterarProduct(req, res) {
    try {
        const { id } = req.params
        const fields = readProductFields(req.body)
        if (!fields) return res.status(400).json({ erro: "Os dados do produto são inválidos." })
        const { nome, descricao, preco_atacado, estoque, min_pedido, imagem } = fields

        await pool.query(
            "UPDATE products SET nome = $1, descricao = $2, preco_atacado = $3, estoque = $4, min_pedido = $5, imagem = $6 WHERE id = $7",
            [nome, descricao, preco_atacado, estoque, min_pedido, imagem, id]
        )

        res.json({ sucesso: "O produto foi alterado com sucesso!" })
    } catch (error) {
        res.status(500).json({ erro: "Erro ao alterar o produto no banco de dados" })
    }
}

async function deletarProduct(req, res) {
    try {
        const { id } = req.params

        await pool.query("DELETE FROM products WHERE id = $1", [id])

        res.json({ sucesso: "O produto foi deletado com sucesso!" })
    } catch (error) {
        res.status(500).json({ erro: "Erro ao deletar o produto no banco de dados" })
    }
}

export { buscarProducts, inserirProduct, alterarProduct, deletarProduct }
