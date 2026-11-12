import express from "express"
import { buscarOrderItems, inserirOrderItem, alterarOrderItem, deletarOrderItem } from "../controllers/orderItemControllers.js"
import { requireAuth, requireRole, requireSameOrigin } from "../auth/session.js"

const routerOrderItems = express.Router()

routerOrderItems.get("/", requireAuth, requireRole("admin"), buscarOrderItems)
routerOrderItems.post("/", requireAuth, requireRole("admin"), requireSameOrigin, inserirOrderItem)
routerOrderItems.put("/:id", requireAuth, requireRole("admin"), requireSameOrigin, alterarOrderItem)
routerOrderItems.delete("/:id", requireAuth, requireRole("admin"), requireSameOrigin, deletarOrderItem)

export default routerOrderItems
