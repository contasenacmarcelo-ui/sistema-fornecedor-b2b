import pool from "../config/fornecedor_db.js"
import { hashPassword } from "../auth/passwords.js"

async function buscarUsers(req, res) {
    try {
        const { rows } = await pool.query("SELECT id, nome_empresa, cnpj, email, role, created_at FROM users")

        res.json([rows])
    } catch (error) {
        res.status(500).json({ erro: "Erro ao buscar usuários no banco de dados." })
    }
}

async function inserirUsers(req, res) {
    try {
        const body = req.body || {}
        const nome_empresa = typeof body.nome_empresa === "string" ? body.nome_empresa.trim() : ""
        const cnpj = typeof body.cnpj === "string" ? body.cnpj.trim() : ""
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
        const senha = typeof body.senha === "string" ? body.senha : ""

        if (!nome_empresa || !cnpj || !email || !senha) {
            return res.status(400).json({ erro: "Todos os campos são obrigatórios." })
        }

        if (nome_empresa.length > 150 || cnpj.length > 20 || email.length > 100 ||
            senha.length < 8 || senha.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ erro: "Verifique os campos e use uma senha com pelo menos 8 caracteres." })
        }

        const passwordHash = await hashPassword(senha)
        await pool.query(
            "INSERT INTO users (nome_empresa, cnpj, email, senha, role) VALUES ($1, $2, $3, $4, 'client') RETURNING id",
            [nome_empresa, cnpj, email, passwordHash]
        )

        res.status(201).json({ sucesso: "Usuário cadastrado. Faça login para continuar." })
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ erro: "Já existe um cadastro com esse CNPJ ou e-mail." })
        }
        res.status(500).json({ erro: "Erro ao cadastrar usuário." })
    }
}

async function alterarUsuario(req,res) {
    try {
        const id = req.params.id

        const nome_empresa = typeof req.body.nome_empresa === "string" ? req.body.nome_empresa.trim() : ""
        const cnpj = typeof req.body.cnpj === "string" ? req.body.cnpj.trim() : ""
        const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : ""
        const senha = typeof req.body.senha === "string" ? req.body.senha : ""

        if (!nome_empresa || !cnpj || !email) {
            return res.status(400).json({ erro: "Nome da empresa, CNPJ e e-mail são obrigatórios." })
        }

        if (senha && senha.length < 8) {
            return res.status(400).json({ erro: "A senha deve ter pelo menos 8 caracteres." })
        }

        if (senha) {
            const passwordHash = await hashPassword(senha)
            await pool.query(
                "UPDATE users SET nome_empresa = $1, cnpj = $2, email = $3, senha = $4 WHERE id = $5",
                [nome_empresa, cnpj, email, passwordHash, id]
            )
        } else {
            await pool.query(
                "UPDATE users SET nome_empresa = $1, cnpj = $2, email = $3 WHERE id = $4",
                [nome_empresa, cnpj, email, id]
            )
        }

        res.json({ sucesso: "O usuário foi alterado com sucesso." })
    } catch (error) {
        res.status(500).json({ erro: "Erro ao alterar usuário." })
    }
}

async function deletarUsers(req, res) {
    try {
        const { id } = req.params
        await pool.query("DELETE FROM users WHERE id = $1", [id])
        res.json({ sucesso: "O usuário foi removido com sucesso." })
    } catch (error) {
        res.status(500).json({ erro: "Erro ao remover usuário." })
    }
}

export { buscarUsers, inserirUsers, alterarUsuario, deletarUsers }