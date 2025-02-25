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

router.post("/model", verifyJWT, CreateModel);
router.put("/model", verifyJWT, UpdateModel);
router.delete("/model", verifyJWT, DeleteModel);
router.get("/models", verifyJWT, GetModels);
router.post("/send", verifyJWT, SendEmail); // envia os emails

router.post("/smtp", verifyJWT, requireOrgAdmin, SetSMTPConfig);

router.get("/org", verifyJWT, getOrganizations);
router.get("/orgs", verifyJWT, requireSuperAdmin, getOrganizations);
router.post("/organizations", verifyJWT, requireSuperAdmin, createOrganization);
router.patch(
  "/organizations/:orgId/admins/:userId",
  verifyJWT,
  requireSuperAdmin,
  assignOrgAdmin
);

router.post("/users", verifyJWT, requireOrgAdmin, registerUser);
router.get("/users", verifyJWT, requireOrgAdmin, listUsers);
router.delete("/users", verifyJWT, requireOrgAdmin, deleteUser);

export default router;
