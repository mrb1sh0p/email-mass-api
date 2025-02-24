import { Request, Response } from "express";
import { auth, db } from "../firebase";

import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  arrayUnion,
  collection,
  doc,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  Query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { SearchProps, User } from "../types";
import { FirebaseError } from "firebase/app";

interface UserPorps {
  name: string;
  password: string;
  organizationId: string;
  email: string;
}

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { email, password, organizationId, name } = req.body as UserPorps;
    const { role, organizationId: userOrgId } = req.user?.user as User;

    if (role === "user") {
      return res.status(403).json({
        success: false,
        error: "Permissão insuficiente para criar usuários",
      });
    }

    if (role !== "super-admin") {
      if (role === "org-admin" && userOrgId !== organizationId) {
        return res.status(403).json({
          success: false,
          error: "Acesso não autorizado a esta organização",
        });
      }
    }

    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await setDoc(doc(db, "users", userCredential.user.uid), {
      name,
      name_lower: name.toLowerCase(),
      email,
      role: "user",
      organizationId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, "organizations", organizationId), {
      orgMembers: arrayUnion(userCredential.user.uid),
    });

    return res.status(201).json({
      success: true,
      userId: userCredential.user.uid,
    });
  } catch (error: any) {
    console.error("Erro no registro:", error);

    const status = error.code === "auth/email-already-in-use" ? 409 : 500;
    const errorCode = error.code || "INTERNAL_ERROR";
    const errorMessage = error.message || "Erro desconhecido";

    if (!res.headersSent) {
      return res.status(status).json({
        success: false,
        errorCode,
        errorMessage,
      });
    }

    console.error("Tentativa de enviar resposta duplicada");
  }
};

export const listUsers = async (req: Request, res: Response) => {
  try {
    const { id, role, organizationId } = req.user.user as User;
    const { page = 1, limitValue = 10, search } = req.query as SearchProps;

    let queryRef: Query<DocumentData> = collection(db, "users");

    if (role === "super-admin") {
      if (search) {
        queryRef = query(
          queryRef,
          where("name_lower", ">=", search.toLowerCase()),
          where("name_lower", "<=", search.toLowerCase() + "\uf8ff"),
          orderBy("name_lower"),
          limit(limitValue)
        );
      } else {
        queryRef = query(
          queryRef,
          orderBy("createdAt", "desc"),
          limit(limitValue)
        );
      }
    } else if (role === "org-admin") {
      if (search) {
        queryRef = query(
          queryRef,
          where("name_lower", ">=", search.toLowerCase()),
          where("name_lower", "<=", search.toLowerCase() + "\uf8ff"),
          where("organizationId", "==", organizationId),
          orderBy("name_lower"),
          limit(limitValue)
        );
      } else {
        queryRef = query(
          queryRef,
          where("organizationId", "==", organizationId),
          orderBy("createdAt", "desc"),
          limit(limitValue)
        );
      }
    } else {
      return res.status(403).json({
        success: false,
        error: "Acesso não autorizado",
      });
    }

    const snapshot = await getDocs(queryRef);

    const users = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || "Sem Nome",
      role: doc.data().role,
    }));

    res.json({
      users,
    });
  } catch (error: any) {
    console.error("Erro ao listar usuários:", error);

    const status = error instanceof FirebaseError ? 503 : 500;
    return res.status(status).json({
      success: false,
      errorCode: error.code || "LIST_USERS_ERROR",
      errorMessage: error.message || "Erro ao buscar usuários",
    });
  }
};

export const DeleteUser = async (req: Request, res: Response) => {
  try {
  } catch (error) {
    if (error instanceof FirebaseError) {
      return {
        success: false,
        error: `Erro no Firestore: ${error.message}`,
        errorCode: error.code,
      };
    }

    return {
      success: false,
      error: "Erro desconhecido ao excluir modelo",
      errorCode: "UNKNOWN_ERROR",
    };
  }
};
