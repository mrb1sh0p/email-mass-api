import { Request, Response } from "express";
import { IModelBody } from "../types";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firabase";

export const CreateModel = async (req: Request, res: Response) => {
  try {
    const { title, body }: IModelBody = req.body;

    const modelsRef = collection(db, "models");

    const doc = await addDoc(modelsRef, {
      title,
      body,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    res.status(201).json({ doc: doc.id });
  } catch (error) {
    res.status(500).json({ errorMensagem: (error as Error).message });
  }
};
