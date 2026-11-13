import { Pool } from "pg"
import dotenv from "dotenv"
dotenv.config();

const pool = process.env.POSTGRES_URL
    ? new Pool({
        connectionString: process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false }
    })
    : new Pool({
        host: process.env.POSTGRES_HOST || process.env.DB_HOST || "localhost",
        user: process.env.POSTGRES_USER || process.env.DB_USER || "postgres",
        password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || "",
        database: process.env.POSTGRES_DATABASE || process.env.DB_NAME || "fornecedor_db",
        port: Number(process.env.POSTGRES_PORT || process.env.DB_PORT || 5432)
    })

export default pool;