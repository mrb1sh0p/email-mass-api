import dotenv from "dotenv";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "../firebase";
import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { User } from "../types";

dotenv.config();

interface AuthProps {
  email: string;
  password: string;
}

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { email, password, organizationId } = req.body;
    const { role, organizationId: userOrgId } = req.user?.user as User;

    // Verificação de permissões
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

export const authenticate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { email, password } = req.body as AuthProps;

  // Validação dos dados de entrada
  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios." });
  }

  const secretKey = process.env.SECRET_KEY;
  if (!secretKey) {
    return res
      .status(500)
      .json({ error: "Erro de configuração: SECRET_KEY não definida." });
  }

  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const userRef = doc(db, "users", userCredential.user.uid);
    const currentUser = (await getDoc(userRef)).data();

    const token = jwt.sign(
      {
        user: {
          ...currentUser,
          id: userCredential.user.uid,
        },
      },
      secretKey,
      {
        expiresIn: "9h",
      }
    );

    return res.status(200).json({
      auth: true,
      token,
    });
  } catch (error: any) {
    let status = 500;
    if (
      error.code === "auth/wrong-password" ||
      error.code === "auth/user-not-found"
    ) {
      status = 401;
    }

    return res.status(status).json({
      errorCode: error.code || "UNKNOWN_ERROR",
      errorMessage: error.message || "Ocorreu um erro durante a autenticação.",
    });
  }
};
