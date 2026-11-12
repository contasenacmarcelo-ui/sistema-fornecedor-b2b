import express from "express"
import { buscarUsers } from "../controllers/userControllers.js"
import { inserirUsers } from "../controllers/userControllers.js"
import { alterarUsuario } from "../controllers/userControllers.js"
import { deletarUsers } from "../controllers/userControllers.js"
import { requireAuth, requireRole, requireSameOrigin } from "../auth/session.js"

const routerUsers = express.Router()

routerUsers.get("/", requireAuth, requireRole("admin"), buscarUsers)
routerUsers.post("/", requireSameOrigin, inserirUsers)
routerUsers.put("/:id", requireAuth, requireRole("admin"), requireSameOrigin, alterarUsuario)
routerUsers.delete("/:id", requireAuth, requireRole("admin"), requireSameOrigin, deletarUsers)


export default routerUsers;

