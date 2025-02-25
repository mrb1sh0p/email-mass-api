import express from "express";
import { authenticate } from "../controllers/auth.controller";
import { verifyJWT } from "../middleware/verify";
import {
  CreateModel,
  DeleteModel,
  GetModels,
  UpdateModel,
} from "../controllers/model.controller";
import { SendEmail, SetSMTPConfig } from "../controllers/email.controller";
import { requireOrgAdmin, requireSuperAdmin } from "../middleware/auth";
import {
  assignOrgAdmin,
  createOrganization,
  getOrganizations,
} from "../controllers/organization.controller";
import {
  listUsers,
  registerUser,
  deleteUserById as deleteUser,
} from "../controllers/user.controller";

const router = express.Router();

router.post("/auth", authenticate);

router.post("/model", verifyJWT, CreateModel); // cria um modelo novo
router.put("/model", verifyJWT, UpdateModel); // atualiza um modelo especifico
router.delete("/model", verifyJWT, DeleteModel); // delete um modelo especiico
router.get("/models", verifyJWT, GetModels); // pega todos modelos da organização
router.post("/send", verifyJWT, SendEmail);

router.post("/smtp", verifyJWT, requireOrgAdmin, SetSMTPConfig); // registro o smtp da org

// Orgs
router.get("/org", verifyJWT, getOrganizations); // lista a organização referente ao usuario
router.get("/orgs", verifyJWT, requireSuperAdmin, getOrganizations); // lista todas as organizações
router.post("/organizations", verifyJWT, requireSuperAdmin, createOrganization); // cria um nova orgnanização

router.patch(
  "/organizations/:orgId/admins/:userId",
  verifyJWT,
  requireSuperAdmin,
  assignOrgAdmin
); // designa um usuario a uma organização

router.post("/users", verifyJWT, requireOrgAdmin, registerUser); // registra um novo usuario
router.get("/users", verifyJWT, requireOrgAdmin, listUsers); // lista todos usuarios
router.delete("/users", verifyJWT, requireOrgAdmin, deleteUser); // remove usuarios

export default router;
