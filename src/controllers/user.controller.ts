import { Request, Response } from "express";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
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

export const deleteUserById = async (req: Request, res: Response) => {
  try {
    const { id: currentUserId, role } = req.user.user as User;
    const userId = typeof req.query.userId === "string" ? req.query.userId : "";

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "ID do usuário inválido",
        errorCode: "INVALID_USER_ID",
      });
    }

    if (role === "user") {
      return res.status(403).json({
        success: false,
        error: "Acesso não autorizado",
        errorCode: "UNAUTHORIZED",
      });
    }

    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) {
      return res.status(404).json({
        success: false,
        error: "Usuário não encontrado",
        errorCode: "USER_NOT_FOUND",
      });
    }

    if (role === "org-admin" || role === "super-admin") {
      const userRef = doc(db, "users", currentUserId);
      const currentUserDoc = await getDoc(userRef);

      if (
        currentUserDoc.data()?.organizationId !== userDoc.data()?.organizationId
      ) {
        return res.status(403).json({
          success: false,
          error: "Acesso restrito à mesma organização",
          errorCode: "ORG_ACCESS_DENIED",
        });
      }

      if (userDoc.data()?.organizationId) {
        await updateDoc(
          doc(db, "organizations", userDoc.data().organizationId),
          {
            orgMembers: arrayRemove(userId),
          }
        );
      }

      if (userDoc.data()?.role == "org-admin") {
        await updateDoc(
          doc(db, "organizations", userDoc.data().organizationId),
          {
            orgAdmins: arrayRemove(userId),
          }
        );
      }
      const deleteRef = doc(db, "users", userId);
      const deleteUserDoc = await getDoc(deleteRef);

      await deleteDoc(deleteRef);
      await deleteUser(deleteUserDoc.data()?.uid);
    }

    return res.json({
      success: true,
      message: "Usuário excluído com sucesso",
    });
  } catch (error) {
    console.error("Erro na exclusão:", error);

    if (error instanceof FirebaseError) {
      return res.status(500).json({
        success: false,
        error: `Erro do Firebase: ${error.message}`,
        errorCode: error.code,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Erro interno no servidor",
      errorCode: "INTERNAL_ERROR",
    });
  }
};
