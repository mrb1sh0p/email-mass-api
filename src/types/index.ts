import { Timestamp } from "firebase/firestore";

export interface Model {
  modelId: string;
  title?: string;
  body?: string;
  idOrg: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface User {
  uid: string;
  name: string,
  name_lower: string,
  email: string;
  role: "super-admin" | "org-admin" | "user";
  organizationId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Organization {
  id: string;
  name: string;
  name_lower: string;
  description: string;
  orgAdmins: string[];
  orgMembers: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SearchProps {
  page?: number;
  limitValue?: number;
  search?: string;
}
