// imports
import express from "express";
import { verifyJWT } from "../middleware/verify";
import {
  CreateModel,
  DeleteModel,
  GetModels,
  UpdateModel,
} from "../controllers/model.controller";

const router = express.Router();

// Rotas para operações com modelos, protegidas pelo middleware de verificação JWT
router.post("/model", verifyJWT, CreateModel); // Cria um novo modelo
router.put("/model", verifyJWT, UpdateModel); // Atualiza um modelo existente
router.delete("/model", verifyJWT, DeleteModel); // Exclui um modelo
router.get("/models", verifyJWT, GetModels); // Recupera a lista de modelos

export default router;