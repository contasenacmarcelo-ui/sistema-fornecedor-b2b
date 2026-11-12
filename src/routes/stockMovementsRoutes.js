import express from "express"
import { buscarStockMovements, inserirStockMovement } from "../controllers/stockMovementControllers.js"
import { requireAuth, requireRole, requireSameOrigin } from "../auth/session.js"

const routerStockMovements = express.Router()

routerStockMovements.get("/", requireAuth, requireRole("admin"), buscarStockMovements)
routerStockMovements.post("/", requireAuth, requireRole("admin"), requireSameOrigin, inserirStockMovement)

export default routerStockMovements
