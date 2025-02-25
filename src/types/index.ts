import { Timestamp } from "firebase/firestore";

/**
 * Interface que representa um modelo (Model).
 */
export interface Model {
  // Identificador único do modelo
  modelId: string;
  // Título do modelo (opcional)
  title?: string;
  // Corpo do modelo (opcional)
  body?: string;
  // Identificador da organização à qual o modelo pertence
  idOrg: string;
  // Data de criação do modelo (opcional)
  createdAt?: Timestamp;
  // Data da última atualização do modelo (opcional)
  updatedAt?: Timestamp;
}

/**
 * Interface que representa um usuário (User).
 */
export interface User {
  // Identificador único do usuário
  uid: string;
  // Nome do usuário
  name: string;
  // Nome do usuário em minúsculas (para buscas eficientes)
  name_lower: string;
  // Endereço de e-mail do usuário
  email: string;
  // Papel do usuário no sistema: pode ser "super-admin", "org-admin" ou "user"
  role: "super-admin" | "org-admin" | "user";
  // Identificador da organização à qual o usuário pertence (opcional)
  organizationId?: string;
  // Data de criação do usuário
  createdAt: Timestamp;
  // Data da última atualização do usuário
  updatedAt: Timestamp;
}

/**
 * Interface que representa uma organização (Organization).
 */
export interface Organization {
  // Identificador único da organização
  id: string;
  // Nome da organização
  name: string;
  // Nome da organização em minúsculas (para buscas eficientes)
  name_lower: string;
  // Descrição da organização
  description: string;
  // Lista de identificadores dos administradores da organização
  orgAdmins: string[];
  // Lista de identificadores dos membros da organização
  orgMembers: string[];
  // Data de criação da organização
  createdAt: Timestamp;
  // Data da última atualização da organização
  updatedAt: Timestamp;
}

/**
 * Interface que define os parâmetros de busca.
 */
export interface SearchProps {
  // Número da página (opcional)
  page?: number;
  // Número máximo de itens por página (opcional)
  limitValue?: number;
  // Termo de busca utilizado para filtrar resultados (opcional)
  search?: string;
}
