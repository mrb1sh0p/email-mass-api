import express from "express";
import { authenticate } from "../controllers/auth.controller";
import { verifyJWT } from "../middleware/verify";
import { CreateModel, DeleteModel, UpdateModel } from "../controllers/model.controller"
import { SendEmail, SetSMTPConfig } from "../controllers/email.controller";

const router = express.Router();

router.post("/auth", authenticate);

// rotas dos modelos
router.post("/model", verifyJWT, CreateModel);
router.put("/model", verifyJWT, UpdateModel);
router.delete("/model", verifyJWT, DeleteModel);

// rotas para envio
router.post("/smtp", verifyJWT, SetSMTPConfig);
router.post("/send", verifyJWT, SendEmail);

export default router;
