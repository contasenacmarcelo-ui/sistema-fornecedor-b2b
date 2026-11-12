import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64

async function hashPassword(password) {
    const salt = randomBytes(16).toString("hex")
    const key = await scrypt(password, salt, KEY_LENGTH)
    return `scrypt$${salt}$${key.toString("hex")}`
}

async function verifyPassword(password, storedPassword) {
    if (!storedPassword?.startsWith("scrypt$")) {
        return {
            valid: typeof storedPassword === "string" && password === storedPassword,
            needsRehash: true
        }
    }

    const [, salt, storedKey] = storedPassword.split("$")
    if (!salt || !storedKey || !/^[a-f0-9]{128}$/i.test(storedKey)) {
        return { valid: false, needsRehash: false }
    }

    const key = await scrypt(password, salt, KEY_LENGTH)
    return {
        valid: timingSafeEqual(key, Buffer.from(storedKey, "hex")),
        needsRehash: false
    }
}

export { hashPassword, verifyPassword }
