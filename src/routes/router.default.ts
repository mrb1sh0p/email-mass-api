import express from "express";
// Importa a função de autenticação do controller
import { authenticate } from "../controllers/auth.controller";
// Importa o middleware para verificação de token JWT
import { verifyJWT } from "../middleware/verify";
// Importa as funções do controller de e-mail para envio e configuração SMTP
import { SendEmail, SetSMTPConfig } from "../controllers/email.controller";
// Importa os middlewares que restringem acesso baseado nos papéis do usuário
import { requireOrgAdmin, requireSuperAdmin } from "../middleware/auth";

// Importa a função para listar logs do controller de logs
import { listLogs } from "../controllers/logs.controller";

// Cria uma instância do router do Express para definir as rotas da API
const router = express.Router();

// Rota para autenticar o usuário
router.post("/auth", authenticate);

// Rota para envio de e-mails, protegida pela verificação JWT
router.post("/send", verifyJWT, SendEmail);

// Rota para configuração SMTP, requer autenticação e que o usuário seja administrador de organização
router.post("/smtp", verifyJWT, requireOrgAdmin, SetSMTPConfig);

// Rota para listar logs de e-mails, protegida por autenticação e restrição de acesso para administradores de organização
router.get("/emailLogs", verifyJWT, requireOrgAdmin, listLogs);

export default router;
