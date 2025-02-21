import express from "express";
import { authenticate } from "../controllers/auth";
import { verifyJWT } from "../middleware/verify";
import { IUser } from "../types";

declare module "express-serve-static-core" {
  interface Request {
    user?: IUser;
  }
}

const router = express.Router();

// Rota pública de teste
router.get("/", (req, res) => {
  res.send({ Hello: "world" });
});

// Rota de autenticação
router.post("/auth", authenticate);

// Rota protegida
router.get("/protected", verifyJWT, (req, res) => {
  // Verificação segura do user
  if (!req.user) {
    return res.status(401).json({ error: "Usuário não autenticado" });
  }

  res.send({
    Hello: req.user,
    message: "Você está autenticado!",
  });
});

export default router;
