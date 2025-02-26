import helmet from "helmet";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { models, orgs, router, user } from "./routes/routes";

const app = express();
const PORT = process.env.PORT || 3030;

// Habilita o CORS para permitir requisições de diferentes origens
app.use(cors());

// Aplica medidas de segurança com Helmet (proteção contra ataques comuns)
app.use(helmet());

// Configura o middleware para aceitar requisições JSON com limite de 10MB
app.use(express.json({ limit: "10mb" }));

// Configura o rate limiter para limitar o número de requisições por IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Tempo de janela: 15 minutos
  max: 100, // Máximo de 100 requisições por IP dentro do período
});

app.use(limiter);

// Usa o roteador principal para gerenciar as rotas da aplicação
app.use(router); // Rotar para gerenciar rotas uteis
app.use(user); // Rotar para gerenciar usuarios
app.use(orgs); // Rotar para gerenciar orgs
app.use(models); // Rotar para gerenciar modelos

// Inicia o servidor na porta 3030
app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});
