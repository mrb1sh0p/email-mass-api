import dotenv from "dotenv";
// Carrega as variáveis de ambiente a partir do arquivo .env
dotenv.config();
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Middleware para verificar a validade do token JWT na requisição
export const verifyJWT = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Obtém o header de autorização da requisição
    const authHeader = req.headers.authorization;
    
    // Verifica se o header de autorização existe e se começa com "Bearer "
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false,
        message: "Formato de token inválido. Use: Bearer <token>" 
      });
    }

    // Extrai o token do header, removendo o prefixo "Bearer "
    const token = authHeader.split(' ')[1];
    
    // Verifica se a chave secreta está configurada nas variáveis de ambiente
    if (!process.env.SECRET_KEY) {
      throw new Error("Chave secreta não configurada");
    }

    // Verifica a validade do token utilizando a chave secreta
    jwt.verify(token, process.env.SECRET_KEY, (error, decoded) => {
      // Se ocorrer algum erro na verificação, como token inválido ou expirado, retorna status 401
      if (error) {
        return res.status(401).json({
          success: false,
          message: "Token inválido ou expirado",
          error: error.name
        });
      }
      
      // Se a verificação for bem-sucedida, armazena os dados decodificados no objeto req.user
      req.user = decoded;
      // Chama o próximo middleware ou rota
      next();
    });

  } catch (error) {
    // Em caso de erro inesperado, registra o erro e retorna status 500 (Erro Interno)
    console.error("Erro na verificação do token:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno na autenticação"
    });
  }
};
