import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import pool from "../config/fornecedor_db.js"

const COOKIE_NAME = "fornecedor_session"
const SESSION_SECONDS = 60 * 60 * 8
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex")

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    throw new Error("Defina SESSION_SECRET no ambiente de produção.")
}

if (!process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRET não configurado; sessões serão invalidadas ao reiniciar o servidor.")
}

function sign(value) {
    return createHmac("sha256", SESSION_SECRET).update(value).digest("base64url")
}

function createSessionToken(userId) {
    const payload = Buffer.from(JSON.stringify({
        sub: userId,
        exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
    })).toString("base64url")

    return `${payload}.${sign(payload)}`
}

function readCookie(req, name) {
    const cookies = req.headers.cookie || ""
    const item = cookies.split(";").map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(`${name}=`))
    return item ? item.slice(name.length + 1) : ""
}

function readSessionToken(token) {
    if (!token || token.length > 2048) return null
    const [payload, signature, extra] = token.split(".")
    if (!payload || !signature || extra) return null

    const expected = Buffer.from(sign(payload))
    const actual = Buffer.from(signature)
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

    try {
        const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
        if (!Number.isInteger(session.sub) || !Number.isInteger(session.exp) || session.exp <= Date.now() / 1000) {
            return null
        }
        return session
    } catch (error) {
        return null
    }
}

function setSessionCookie(res, userId) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
    res.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(createSessionToken(userId))}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`)
}

function clearSessionCookie(res) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
    res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`)
}

async function requireAuth(req, res, next) {
    try {
        res.setHeader("Cache-Control", "no-store")
        const session = readSessionToken(readCookie(req, COOKIE_NAME))
        if (!session) return res.status(401).json({ erro: "Autenticação necessária." })

        const { rows } = await pool.query(
            "SELECT id, nome_empresa, email, role FROM users WHERE id = $1 LIMIT 1",
            [session.sub]
        )
        if (!rows.length) return res.status(401).json({ erro: "Sessão inválida." })

        req.user = rows[0]
        next()
    } catch (error) {
        res.status(500).json({ erro: "Não foi possível verificar a sessão." })
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ erro: "Acesso não autorizado para este perfil." })
        }
        next()
    }
}

function requireSameOrigin(req, res, next) {
    const origin = req.get("origin")
    if (!origin) return next()

    try {
        if (new URL(origin).host !== req.get("host")) {
            return res.status(403).json({ erro: "Origem da requisição não autorizada." })
        }
    } catch (error) {
        return res.status(403).json({ erro: "Origem da requisição inválida." })
    }

    next()
}

export { clearSessionCookie, requireAuth, requireRole, requireSameOrigin, setSessionCookie }
