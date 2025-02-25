import { NextFunction, Request, Response } from "express";
import { User } from "src/types";

// Middleware para impor acesso à organização correta
// Este middleware garante que apenas usuários autorizados possam acessar os recursos de uma organização específica.
export const enforceOrgAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Recupera o usuário autenticado da requisição, convertendo para o tipo 'User'
  const user = req.user as User;
  // Obtém o ID da organização requisitada a partir dos parâmetros da URL
  const requestedOrgId = req.params.orgId;

  // Usuários com o papel "super-admin" possuem acesso irrestrito a todas as organizações
  if (user.role === "super-admin") {
    return next();
  }

  // Se o ID da organização do usuário não corresponder ao ID requisitado,
  // o acesso é negado e um erro 403 é retornado
  if (user.organizationId !== requestedOrgId) {
    return res.status(403).json({
      success: false,
      error: "Acesso não autorizado a esta organização",
    });
  }

  // Se todas as verificações passarem, o controle é passado para o próximo middleware ou rota
  next();
};
