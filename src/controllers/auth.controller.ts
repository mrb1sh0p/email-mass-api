import dotenv from "dotenv";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
} from "firebase/firestore";


dotenv.config();

interface AuthProps {
  email: string;
  password: string;
}

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

