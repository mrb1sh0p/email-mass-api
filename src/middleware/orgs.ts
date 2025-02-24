import { NextFunction, Request, Response } from "express";
import { User } from "src/types";

export const enforceOrgAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = req.user as User;
  const requestedOrgId = req.params.orgId;

  if (user.role === "super-admin") {
    return next();
  }

  if (user.organizationId !== requestedOrgId) {
    return res.status(403).json({
      success: false,
      error: "Acesso não autorizado a esta organização",
    });
  }

  next();
};
