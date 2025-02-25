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

    // Bloqueia criação se o usuário autenticado não tiver permissão
    if (role === "user") {
      return res.status(403).json({
        success: false,
        error: "Permissão insuficiente para criar usuários",
      });
    }

    // Se não for super-admin, e for org-admin, só pode criar usuários da mesma organização
    if (
      role !== "super-admin" &&
      role === "org-admin" &&
      userOrgId !== organizationId
    ) {
      return res.status(403).json({
        success: false,
        error: "Acesso não autorizado a esta organização",
      });
    }

    // Cria o usuário no Firebase Auth
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
    }).then(() => {
      updateDoc(doc(db, "organizations", organizationId), {
        orgMembers: arrayUnion(userCredential.user.uid),
      });
    });

    return res.status(201).json({
      success: true,
      userId: userCredential.user.uid,
    });
  } catch (error: any) {
    console.error("Erro no registro:", error);

    // Se os headers já foram enviados, não tenta enviar outra resposta
    if (res.headersSent) {
      console.error("Tentativa de enviar resposta duplicada");
      return;
    }

    const status = error.code === "auth/email-already-in-use" ? 409 : 500;
    const errorCode = error.code || "INTERNAL_ERROR";
    const errorMessage = error.message || "Erro desconhecido";

    return res.status(status).json({
      success: false,
      errorCode,
      errorMessage,
    });
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

    const userData = userDoc.data();
    console.log(userData);
    if (!userData) {
      return res.status(500).json({
        success: false,
        error: "Dados do usuário inválidos",
        errorCode: "INVALID_USER_DATA",
      });
    }

    if (role === "org-admin") {
      const currentUserDoc = await getDoc(doc(db, "users", currentUserId));
      if (currentUserDoc.data()?.organizationId !== userData.organizationId) {
        return res.status(403).json({
          success: false,
          error: "Acesso restrito à mesma organização",
          errorCode: "ORG_ACCESS_DENIED",
        });
      }
    }

    const userRef = doc(db, "users", userId);

    if (!userData.uid) {
      return res.status(500).json({
        success: false,
        error: "UID do usuário não encontrado",
        errorCode: "UID_NOT_FOUND",
      });
    }
    await deleteUser(userData.uid);

    if (userData.organizationId) {
      const orgRef = doc(db, "organizations", userData.organizationId);

      if (userData.role === "org-admin") {
        await updateDoc(orgRef, {
          orgAdmins: arrayRemove(userId),
        });
      }

      await updateDoc(orgRef, {
        orgMembers: arrayRemove(userId),
      });
    }

    await deleteDoc(userRef);

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
