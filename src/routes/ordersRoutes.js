import express from "express"
import { buscarOrders, inserirOrder, alterarOrder, deletarOrder } from "../controllers/orderControllers.js"
import { requireAuth, requireRole, requireSameOrigin } from "../auth/session.js"

const routerOrders = express.Router()

routerOrders.get("/", requireAuth, buscarOrders)
routerOrders.post("/", requireAuth, requireSameOrigin, inserirOrder)
routerOrders.put("/:id", requireAuth, requireRole("admin"), requireSameOrigin, alterarOrder)
routerOrders.delete("/:id", requireAuth, requireRole("admin"), requireSameOrigin, deletarOrder)

export default routerOrders
