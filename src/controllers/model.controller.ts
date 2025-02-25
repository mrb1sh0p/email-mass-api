import { Request, Response } from "express";
import { Model as IModelBody, User } from "../types";
import {
  addDoc,
  collection,
  doc,
  updateDoc,
  serverTimestamp,
  deleteDoc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { FirebaseError } from "firebase/app";

export const CreateModel = async (req: Request, res: Response) => {
  try {
    const { organizationId, role } = req.user.user as User;
    const { title, body, idOrg }: IModelBody = req.body;

    if (organizationId !== idOrg || role === "user") {
      return res.status(403).json({
        success: false,
        error: "Você não tem autorização para acessar essa área",
      });
    }

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        error: "Título e conteúdo são obrigatórios",
        requiredFields: ["title", "body"],
      });
    }

    const modelsRef = collection(db, "models", organizationId, "models");
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    const docRef = await addDoc(modelsRef, {
      title: trimmedTitle,
      body: trimmedBody,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const newDocSnap = await getDoc(docRef);
    const newDocData = newDocSnap.data();

    return res.status(201).json({
      success: true,
      message: "Modelo criado com sucesso",
      data: {
        id: docRef.id,
        ...newDocData,
      },
    });
  } catch (error) {
    console.error("Erro na criação do modelo:", error);

    if (error instanceof FirebaseError) {
      return res.status(503).json({
        success: false,
        error: "Erro no banco de dados",
        code: error.code,
      });
    }

    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({
      success: false,
      error: "Falha na criação do modelo",
      details: errorMessage,
    });
  }
};

export const UpdateModel = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.user.user as User;
    const { model: modelId } = req.query;
    const { title, body }: Partial<IModelBody> & { modelId?: string } =
      req.body;

    if (!modelId) {
      return res.status(400).json({
        success: false,
        error: "modelId é obrigatório para atualização",
      });
    }

    const updateData: { [key: string]: any } = { updatedAt: serverTimestamp() };
    if (title !== undefined) {
      updateData.title = title.trim();
    }
    if (body !== undefined) {
      updateData.body = body.trim();
    }

    if (Object.keys(updateData).length === 1) {
      return res.status(400).json({
        success: false,
        error: "Nenhum campo válido para atualização foi enviado",
      });
    }

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: "Falha ao buscar o id da organização",
      });
    }

    if (typeof modelId !== "string") throw new Error();

    const modelDocRef = doc(db, "models", organizationId, "models", modelId);
    await updateDoc(modelDocRef, updateData);
    const updatedDocSnap = await getDoc(modelDocRef);
    const updatedData = updatedDocSnap.data();

    return res.status(200).json({
      success: true,
      message: "Modelo atualizado com sucesso",
      data: updatedData,
    });
  } catch (error) {
    console.error("Erro na atualização do modelo:", error);

    if (error instanceof FirebaseError) {
      return res.status(500).json({
        success: false,
        error: `Erro no Firestore: ${error.message}`,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Erro interno no servidor",
    });
  }
};

export const DeleteModel = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.user.user as User;
    const { model: modelId } = req.query;

    if (!modelId || typeof modelId !== "string" || modelId.trim() === "") {
      return {
        success: false,
        error: "ID do modelo inválido",
        errorCode: "INVALID_ID",
      };
    }

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: "Falha ao buscar o id da organização",
      });
    }

    const modelRef = doc(db, "models", organizationId, "models", modelId);
    const docSnapshot = await getDoc(modelRef);

    if (!docSnapshot.exists()) {
      return {
        success: false,
        error: "Modelo não encontrado",
        errorCode: "NOT_FOUND",
      };
    }

    await deleteDoc(modelRef);
    return res.status(200).json({
      success: true,
      message: "Modelo excluído com sucesso",
      deletedId: modelId,
      deletedAt: new Date().toISOString(),
    });
  } catch (error) {
    const { modelId } = req.query;
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

export const GetModels = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.user.user as User;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: "Falha ao buscar o id da organização",
      });
    }

    const modelsRef = collection(db, "models", organizationId, "models");
    const querySnapshot = await getDocs(modelsRef);

    const modelsList = querySnapshot.docs
      .map((doc) => ({
        id: doc.id,
        title: doc.data().title,
      }))
      .filter((model) => model.title);

    return res.status(200).json({
      success: true,
      data: modelsList,
    });
  } catch (error) {
    console.error("Erro ao buscar modelos:", error);

    if (error instanceof FirebaseError) {
      return res.status(503).json({
        success: false,
        error: "Erro no banco de dados",
        code: error.code,
      });
    }

    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({
      success: false,
      error: "Falha na busca de modelos",
      details: errorMessage,
    });
  }
};
