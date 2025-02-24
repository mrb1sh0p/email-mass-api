import dotenv from "dotenv";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { User } from "../types";

dotenv.config();

interface AuthProps {
  email: string;
  password: string;
}

export const registerUser = async (req: Request, res: Response) => {
  const { email, password, organizationId } = req.body;

  // Somente super-admin ou org-admin podem criar usuários
  const creator = req.user as User;

  if (creator.role === "user") {
    return res.status(403).json({
      success: false,
      error: "Permissão insuficiente para criar usuários",
    });
  }

  // Verificar se o criador tem acesso à organização
  if (
    (creator.role === "org-admin" || creator.role === "super-admin") &&
    creator.organizationId !== organizationId
  ) {
    return res.status(403).json({
      success: false,
      error: "Acesso não autorizado a esta organização",
    });
  }

  // Criar usuário no Firebase Auth
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  // Criar registro no Firestore
  await setDoc(doc(db, "users", userCredential.user.uid), {
    email,
    role: "user",
    organizationId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  res.status(201).json({ success: true });
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
    console.error("Erro na autenticação:", error);

    // Mapeamento de erros comuns do Firebase para status apropriados
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
