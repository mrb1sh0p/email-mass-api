import { Timestamp } from "firebase/firestore";

export interface IModelBody {
  modelId: string;
  title?: string;
  body?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface User {
  id: string;
  email: string;
  role: "super-admin" | "org-admin" | "user";
  organizationId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Organization {
  id: string;
  name: string;
  description: string;
  orgAdmins: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}