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

const router = express.Router();

router.post("/auth", authenticate);

router.post("/model", verifyJWT, CreateModel);
router.put("/model", verifyJWT, UpdateModel);
router.delete("/model", verifyJWT, DeleteModel);
router.get("/models", verifyJWT, GetModels);

router.post("/smtp", verifyJWT, SetSMTPConfig);
router.post("/send", verifyJWT, SendEmail);

export default router;
