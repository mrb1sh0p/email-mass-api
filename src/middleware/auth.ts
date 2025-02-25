import { NextFunction, Request, Response } from "express";
import { User } from "src/types";

// Middleware que verifica se o usuário possui o papel de "super-admin"
export const requireSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Extrai a propriedade 'role' do objeto usuário presente na requisição
  const { role } = req.user.user as User;

  // Se o usuário não for um "super-admin", retorna um erro 403 (Forbidden)
  if (role !== "super-admin") {
    return res.status(403).json({
      success: false,
      error: "Acesso restrito a super administradores",
    });
  }

  // Caso o usuário seja "super-admin", passa para o próximo middleware ou rota
  next();
};

// Middleware que verifica se o usuário possui o papel de "org-admin" ou é "super-admin"
export const requireOrgAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Extrai a propriedade 'role' do objeto usuário presente na requisição
  const { role } = req.user.user as User;

  // Se o usuário for "super-admin", permite o acesso diretamente
  if (role === "super-admin") {
    next();
  }
  // Se o usuário não for "org-admin", retorna um erro 403 (Forbidden)
  else if (role !== "org-admin") {
    return res.status(403).json({
      success: false,
      error: "Acesso restrito a administradores de organização",
    });
  }

  // Se o usuário for "org-admin", passa para o próximo middleware ou rota
  next();
};
