import express from "express"
import { buscarProducts, inserirProduct, alterarProduct, deletarProduct } from "../controllers/productControllers.js"
import { requireAuth, requireRole, requireSameOrigin } from "../auth/session.js"

const routerProducts = express.Router()

routerProducts.get("/", buscarProducts)
routerProducts.post("/", requireAuth, requireRole("admin"), requireSameOrigin, inserirProduct)
routerProducts.put("/:id", requireAuth, requireRole("admin"), requireSameOrigin, alterarProduct)
routerProducts.delete("/:id", requireAuth, requireRole("admin"), requireSameOrigin, deletarProduct)

export default routerProducts
