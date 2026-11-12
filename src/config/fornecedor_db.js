import mysql from "mysql2/promise"

const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "fornecedor_db",
    waitForConnections: true, //aguardar conexões
    connectionLimit: 10,
    queueLimit: 0,
})

export default pool