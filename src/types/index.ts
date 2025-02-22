import { Timestamp } from "firebase/firestore";

export interface IModelBody {
  modelId: string;
  title?: string;
  body?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}