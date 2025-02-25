import express from "express";
import { verifyJWT } from "src/middleware/verify";
import {
  listUsers,
  registerUser,
  deleteUserById as deleteUser,
} from "../controllers/user.controller";
import { requireOrgAdmin } from "../middleware/auth";
const router = express.Router();

// Rotas para operações com usuários
router.post("/users", verifyJWT, requireOrgAdmin, registerUser); // Registra um novo usuário (acesso restrito a administradores de organização)
router.get("/users", verifyJWT, requireOrgAdmin, listUsers); // Lista os usuários (acesso restrito a administradores de organização)
router.delete("/users", verifyJWT, requireOrgAdmin, deleteUser); // Exclui um usuário (acesso restrito a administradores de organização)

export default router;
