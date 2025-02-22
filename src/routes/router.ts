import express from "express";
import { authenticate } from "../controllers/auth";
import { verifyJWT } from "../middleware/verify";
import { CreateModel, deleteModel, UpdateModel } from "../controllers/ModelController";

const router = express.Router();

router.post("/auth", authenticate);

router.post("/model", verifyJWT, CreateModel);
router.put("/model", verifyJWT, UpdateModel);
router.delete("/model", verifyJWT, deleteModel);

export default router;
