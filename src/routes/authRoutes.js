import express from "express"
import { currentUser, login, logout } from "../controllers/authControllers.js"
import { requireAuth, requireSameOrigin } from "../auth/session.js"

const routerAuth = express.Router()

routerAuth.post("/login", requireSameOrigin, login)
routerAuth.post("/logout", requireSameOrigin, logout)
routerAuth.get("/me", requireAuth, currentUser)

export default routerAuth
