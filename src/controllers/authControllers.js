import pool from "../config/fornecedor_db.js"
import { verifyPassword, hashPassword } from "../auth/passwords.js"
import { clearSessionCookie, setSessionCookie } from "../auth/session.js"

const failedLogins = new Map()
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILED_LOGINS = 10

function getLoginAttempt(ip) {
    const now = Date.now()
    for (const [address, attempt] of failedLogins) {
        if (attempt.resetAt <= now) failedLogins.delete(address)
    }

    const attempt = failedLogins.get(ip)
    if (!attempt || attempt.resetAt <= now) return null
    return attempt
}

function recordFailedLogin(ip) {
    const attempt = getLoginAttempt(ip)
    if (attempt) {
        attempt.count += 1
        return
    }
    if (failedLogins.size >= 5000) {
        failedLogins.delete(failedLogins.keys().next().value)
    }
    failedLogins.set(ip, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS })
}

async function login(req, res) {
    try {
        res.setHeader("Cache-Control", "no-store")
        const body = req.body || {}
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
        const senha = typeof body.senha === "string" ? body.senha : ""
        const clientIp = req.ip || "unknown"

        if (!email || !senha) {
            return res.status(400).json({ erro: "E-mail e senha são obrigatórios." })
        }

        if ((getLoginAttempt(clientIp)?.count || 0) >= MAX_FAILED_LOGINS) {
            return res.status(429).json({ erro: "Muitas tentativas. Aguarde 15 minutos e tente novamente." })
        }

        const [rows] = await pool.execute(
            "SELECT id, nome_empresa, email, senha, role FROM users WHERE email = ? LIMIT 1",
            [email]
        )
        const user = rows[0]
        const verification = await verifyPassword(senha, user?.senha || "__invalid_user__")

        if (!user || !verification.valid) {
            recordFailedLogin(clientIp)
            return res.status(401).json({ erro: "E-mail ou senha inválidos." })
        }

        failedLogins.delete(clientIp)
        if (verification.needsRehash) {
            const passwordHash = await hashPassword(senha)
            await pool.execute("UPDATE users SET senha = ? WHERE id = ?", [passwordHash, user.id])
        }

        setSessionCookie(res, user.id)
        res.json({
            usuario: {
                id: user.id,
                nome_empresa: user.nome_empresa,
                email: user.email,
                role: user.role
            }
        })
    } catch (error) {
        res.status(500).json({ erro: "Não foi possível realizar o login." })
    }
}

function logout(req, res) {
    clearSessionCookie(res)
    res.json({ sucesso: "Sessão encerrada." })
}

function currentUser(req, res) {
    res.setHeader("Cache-Control", "no-store")
    res.json({ usuario: req.user })
}

export { currentUser, login, logout }
