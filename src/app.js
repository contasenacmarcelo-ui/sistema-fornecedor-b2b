import express from "express"
import cors from  "cors"
import path from "path"
import routerUsers from "./routes/usersRoutes.js"
import routerProducts from "./routes/productsRoutes.js"
import routerOrders from "./routes/ordersRoutes.js"
import routerOrderItems from "./routes/orderItemsRoutes.js"
import routerStockMovements from "./routes/stockMovementsRoutes.js"
import routerAuth from "./routes/authRoutes.js"


const app = express()

app.use(express.json())
app.use(cors())

app.use(express.static(path.join(process.cwd(), "public")))

app.get("/", (req,res)=>{
    res.sendFile(path.join(process.cwd(), "public", "pages", "index.html"))
})

app.use("/auth", routerAuth)
app.use("/users", routerUsers)
app.use("/products", routerProducts)
app.use("/orders", routerOrders)
app.use("/order_items", routerOrderItems)
app.use("/stock_movements", routerStockMovements)

export default app