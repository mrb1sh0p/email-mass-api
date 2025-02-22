import express from "express";
import { authenticate } from "../controllers/auth";
import { verifyJWT } from "../middleware/verify";
import { CreateModel } from "../controllers/ModelController";

const router = express.Router();

router.post("/auth", authenticate);

router.post("/model", verifyJWT, CreateModel);

export default router;
