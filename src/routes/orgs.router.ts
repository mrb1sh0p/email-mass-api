// Imports
import express from "express";
import { verifyJWT } from "../middleware/verify";
import {
  assignOrgAdmin,
  createOrganization,
  getOrganizations,
} from "../controllers/organization.controller";
import { requireSuperAdmin } from "../middleware/auth";

const router = express.Router();
// Rotas para operações com organizações
router.get("/org", verifyJWT, getOrganizations); // Obtém organizações (acesso com autenticação)
router.get("/orgs", verifyJWT, requireSuperAdmin, getOrganizations); // Obtém organizações (acesso restrito a super-administradores)
router.post("/organizations", verifyJWT, requireSuperAdmin, createOrganization); // Cria uma nova organização (somente super-administradores)
router.patch(
  "/organizations/:orgId/admins/:userId",
  verifyJWT,
  requireSuperAdmin,
  assignOrgAdmin
); // Atribui o papel de administrador de organização a um usuário (somente super-administradores)

export default router;
