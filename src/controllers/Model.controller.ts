import { Request, Response } from "express";
import { IModelBody } from "../types";
import {
  addDoc,
  collection,
  doc,
  updateDoc,
  serverTimestamp,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { FirebaseError } from "firebase/app";

export const CreateModel = async (req: Request, res: Response) => {
  try {
    const { title, body }: IModelBody = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        error: "Título e conteúdo são obrigatórios",
        requiredFields: ["title", "body"],
      });
    }

    const modelsRef = collection(db, "models");

    const docRef = await addDoc(modelsRef, {
      title: title.trim(),
      body: body.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const newDoc = await getDoc(docRef);

    res.status(201).json({
      success: true,
      message: "Modelo criado com sucesso",
      data: {
        id: docRef.id,
        ...newDoc.data(),
      },
    });
  } catch (error) {
    console.error("Erro na criação:", error);

    if (error instanceof FirebaseError) {
      return res.status(503).json({
        success: false,
        error: "Erro no banco de dados",
        code: error.code,
      });
    }

    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";

    res.status(500).json({
      success: false,
      error: "Falha na criação do modelo",
      details: errorMessage,
    });
  }
};

export const UpdateModel = async (req: Request, res: Response) => {
  try {
    const { modelId, ...updateFields }: Partial<IModelBody> = req.body;

    if (!modelId) {
      return res.status(400).json({
        success: false,
        error: "modelId é obrigatório para atualização",
      });
    }

    const modelDocRef = doc(db, "models", modelId);

    const updateData: { [key: string]: any } = {
      updatedAt: serverTimestamp(),
    };

    Object.entries(updateFields).forEach(([key, value]) => {
      if (value !== undefined) {
        updateData[key] = value;
      }
    });

    if (Object.keys(updateData).length === 1) {
      return res.status(400).json({
        success: false,
        error: "Nenhum campo válido para atualização foi enviado",
      });
    }

    await updateDoc(modelDocRef, updateData);

    const updatedDoc = (await getDoc(modelDocRef)).data();

    res.status(200).json({
      success: true,
      message: "Modelo atualizado com sucesso",
      data: updatedDoc,
    });
  } catch (error) {
    console.error("Erro na atualização:", error);

    if (error instanceof FirebaseError) {
      return res.status(500).json({
        success: false,
        error: `Erro no Firestore: ${error.message}`,
      });
    }

    res.status(500).json({
      success: false,
      error: "Erro interno no servidor",
    });
  }
};

export const DeleteModel = async (modelId: string) => {
  try {
    if (!modelId || typeof modelId !== "string" || modelId.trim() === "") {
      return {
        success: false,
        error: "ID do modelo inválido",
        errorCode: "INVALID_ID",
      };
    }

    const noteRef = doc(db, "models", modelId);

    const docSnapshot = await getDoc(noteRef);
    if (!docSnapshot.exists()) {
      return {
        success: false,
        error: "Modelo não encontrado",
        errorCode: "NOT_FOUND",
      };
    }

    await updateDoc(noteRef, {
      deletedAt: serverTimestamp(),
    });

    await deleteDoc(noteRef);

    return {
      success: true,
      message: "Modelo excluído com sucesso",
      deletedId: modelId,
      deletedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Erro ao excluir modelo ${modelId}:`, error);

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
