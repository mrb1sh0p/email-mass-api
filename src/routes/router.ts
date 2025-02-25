import express from "express";
// Importa a função de autenticação do controller
import { authenticate } from "../controllers/auth.controller";
// Importa o middleware para verificação de token JWT
import { verifyJWT } from "../middleware/verify";
// Importa as funções do controller de modelos (create, update, delete, get)
import {
  CreateModel,
  DeleteModel,
  GetModels,
  UpdateModel,
} from "../controllers/model.controller";
// Importa as funções do controller de e-mail para envio e configuração SMTP
import { SendEmail, SetSMTPConfig } from "../controllers/email.controller";
// Importa os middlewares que restringem acesso baseado nos papéis do usuário
import { requireOrgAdmin, requireSuperAdmin } from "../middleware/auth";
// Importa as funções do controller de organizações para criação, listagem e atribuição de administradores
import {
  assignOrgAdmin,
  createOrganization,
  getOrganizations,
} from "../controllers/organization.controller";
// Importa as funções do controller de usuários para registro, listagem e exclusão de usuários
import {
  listUsers,
  registerUser,
  deleteUserById as deleteUser,
} from "../controllers/user.controller";
// Importa a função para listar logs do controller de logs
import { listLogs } from "../controllers/logs.controller";

// Cria uma instância do router do Express para definir as rotas da API
const router = express.Router();

// Rota para autenticar o usuário
router.post("/auth", authenticate);

// Rotas para operações com modelos, protegidas pelo middleware de verificação JWT
router.post("/model", verifyJWT, CreateModel); // Cria um novo modelo
router.put("/model", verifyJWT, UpdateModel); // Atualiza um modelo existente
router.delete("/model", verifyJWT, DeleteModel); // Exclui um modelo
router.get("/models", verifyJWT, GetModels); // Recupera a lista de modelos

// Rota para envio de e-mails, protegida pela verificação JWT
router.post("/send", verifyJWT, SendEmail);

// Rota para configuração SMTP, requer autenticação e que o usuário seja administrador de organização
router.post("/smtp", verifyJWT, requireOrgAdmin, SetSMTPConfig);

// Rotas para operações com organizações
router.get("/org", verifyJWT, getOrganizations); // Obtém organizações (acesso com autenticação)
router.get("/orgs", verifyJWT, requireSuperAdmin, getOrganizations); // Obtém organizações (acesso restrito a super-administradores)
router.post("/organizations", verifyJWT, requireSuperAdmin, createOrganization); // Cria uma nova organização (somente super-administradores)
router.patch(
  "/organizations/:orgId/admins/:userId",
  verifyJWT,
  requireSuperAdmin,
  assignOrgAdmin
); // Atribui o papel de administrador de organização a um usuário (somente super-administradores)

// Rotas para operações com usuários
router.post("/users", verifyJWT, requireOrgAdmin, registerUser); // Registra um novo usuário (acesso restrito a administradores de organização)
router.get("/users", verifyJWT, requireOrgAdmin, listUsers); // Lista os usuários (acesso restrito a administradores de organização)
router.delete("/users", verifyJWT, requireOrgAdmin, deleteUser); // Exclui um usuário (acesso restrito a administradores de organização)

// Rota para listar logs de e-mails, protegida por autenticação e restrição de acesso para administradores de organização
router.get("/emailLogs", verifyJWT, requireOrgAdmin, listLogs);

// Exporta o router para ser utilizado pela aplicação
export default router;
