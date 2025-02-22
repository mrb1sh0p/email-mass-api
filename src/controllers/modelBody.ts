import { Request, Response } from "express";
import { IModelBody } from "../types";

export const CreateModel = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    const { title, body }: IModelBody = req.body;

    res.status(201).json({
      owner: userId,
      model: {
        title,
        body,
      },
    });
  } catch (error) {
    res.status(500).json({ errorMensagem: (error as Error).message });
  }
};
