import express from "express";
import { authenticate, registerUser } from "../controllers/auth.controller";
import { verifyJWT } from "../middleware/verify";
import {
  CreateModel,
  DeleteModel,
  GetModels,
  UpdateModel,
} from "../controllers/model.controller";
import { SendEmail, SetSMTPConfig } from "../controllers/email.controller";
import { requireOrgAdmin, requireSuperAdmin } from "../middleware/auth";
import { enforceOrgAccess } from "src/middleware/orgs";
import {
  assignOrgAdmin,
  createOrganization,
  getOrganizations,
} from "../controllers/organization.controller";

const router = express.Router();

router.post("/auth", authenticate);

router.post("/model", verifyJWT, CreateModel);
router.put("/model", verifyJWT, UpdateModel);
router.delete("/model", verifyJWT, DeleteModel);
router.get("/models", verifyJWT, GetModels);
router.post("/send", verifyJWT, SendEmail);

router.post("/smtp", verifyJWT, requireOrgAdmin, SetSMTPConfig);


// Orgs
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
// router.get("/users", authenticate, enforceOrgAccess, listUsers);

export default router;
