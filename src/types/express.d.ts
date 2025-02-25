import { IUser } from "./types";

// Declaração de módulo para estender a interface Request do Express
declare module "express-serve-static-core" {
  interface Request {
    // Adiciona a propriedade 'user' à requisição, que pode conter os dados do usuário autenticado
    user?: IUser;
  }
}
