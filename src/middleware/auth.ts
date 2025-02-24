import { NextFunction, Request, Response } from "express";
import { User } from "src/types";

export const requireSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = req.user as User;

  if (user?.role !== "super-admin") {
    return res.status(403).json({
      success: false,
      error: "Acesso restrito a super administradores",
    });
  }
  next();
};

export const requireOrgAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = req.user as User;

  if (user?.role !== "org-admin") {
    return res.status(403).json({
      success: false,
      error: "Acesso restrito a administradores de organização",
    });
  }
  next();
};
