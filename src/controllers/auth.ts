import dotenv from "dotenv";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firabase";
dotenv.config();

interface AuthProps {
  email: string;
  password: string;
}

export const authenticate = async (req: Request, res: Response) => {
  try {
    const { email, password }: AuthProps = req.body;

    await signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        const secretKey = process.env.SECRET_KEY;

        if (!secretKey) throw new Error("Secret Key is not defined");

        const token = jwt.sign({ uid: userCredential.user.uid }, secretKey, {
          expiresIn: "24h",
        });

        return res.status(201).send({
          auth: true,
          token: token,
        });
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        return res
          .status(500)
          .send({ errorCode: errorCode, errorMessage: error.message });
      });
  } catch (error) {
    res.status(401).send("Invalid token");
  }
};
