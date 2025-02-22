import dotenv from "dotenv";
dotenv.config();
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const verifyJWT = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false,
        message: "Formato de token inválido. Use: Bearer <token>" 
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!process.env.SECRET_KEY) {
      throw new Error("Chave secreta não configurada");
    }

    jwt.verify(token, process.env.SECRET_KEY, (error, decoded) => {
      if (error) {
        return res.status(401).json({
          success: false,
          message: "Token inválido ou expirado",
          error: error.name
        });
      }
      
      req.user = decoded;
      next();
    });

  } catch (error) {
    console.error("Erro na verificação do token:", error);
    return res.status(500).json({
      success: false,
      message: "Erro interno na autenticação"
    });
  }
};