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

// Função para criar um novo modelo de e-mail/template
export const CreateModel = async (req: Request, res: Response) => {
  try {
    // Extrai o organizationId e a role do usuário autenticado
    const { organizationId, role } = req.user.user as User;
    // Extrai os dados do modelo (título, corpo e idOrg) do corpo da requisição
    const { title, body, idOrg }: IModelBody = req.body;

    // Verifica se o usuário tem permissão para criar um modelo (a organização deve coincidir e a role não pode ser "user")
    if (organizationId !== idOrg || role === "user") {
      return res.status(403).json({
        success: false,
        error: "Você não tem autorização para acessar essa área",
      });
    }

    // Valida se os campos obrigatórios estão presentes
    if (!title || !body) {
      return res.status(400).json({
        success: false,
        error: "Título e conteúdo são obrigatórios",
        requiredFields: ["title", "body"],
      });
    }

    // Cria uma referência para a coleção "models" da organização no Firestore
    const modelsRef = collection(db, "models", organizationId, "models");
    // Remove espaços em branco desnecessários do título e corpo
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    // Adiciona um novo documento à coleção com os dados do modelo e timestamps para criação e atualização
    const docRef = await addDoc(modelsRef, {
      title: trimmedTitle,
      body: trimmedBody,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Recupera o documento recém-criado para retornar seus dados
    const newDocSnap = await getDoc(docRef);
    const newDocData = newDocSnap.data();

    // Retorna resposta de sucesso com os dados do novo modelo
    return res.status(201).json({
      success: true,
      message: "Modelo criado com sucesso",
      data: {
        id: docRef.id,
        ...newDocData,
      },
    });
  } catch (error) {
    // Loga o erro para debug
    console.error("Erro na criação do modelo:", error);

    // Se o erro for do Firebase, retorna status 503 com a mensagem apropriada
    if (error instanceof FirebaseError) {
      return res.status(503).json({
        success: false,
        error: "Erro no banco de dados",
        code: error.code,
      });
    }

    // Para outros tipos de erro, retorna status 500
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({
      success: false,
      error: "Falha na criação do modelo",
      details: errorMessage,
    });
  }
};

// Função para atualizar um modelo existente
export const UpdateModel = async (req: Request, res: Response) => {
  try {
    // Extrai o organizationId do usuário autenticado
    const { organizationId } = req.user.user as User;
    // Obtém o modelId dos parâmetros da query
    const { model: modelId } = req.query;
    // Extrai os campos que podem ser atualizados do corpo da requisição (parcialmente)
    const { title, body }: Partial<IModelBody> & { modelId?: string } =
      req.body;

    // Verifica se o modelId foi fornecido
    if (!modelId) {
      return res.status(400).json({
        success: false,
        error: "modelId é obrigatório para atualização",
      });
    }

    // Prepara os dados a serem atualizados, iniciando com a atualização do timestamp
    const updateData: { [key: string]: any } = { updatedAt: serverTimestamp() };
    if (title !== undefined) {
      updateData.title = title.trim();
    }
    if (body !== undefined) {
      updateData.body = body.trim();
    }

    // Se nenhum campo válido além do timestamp foi enviado, retorna erro
    if (Object.keys(updateData).length === 1) {
      return res.status(400).json({
        success: false,
        error: "Nenhum campo válido para atualização foi enviado",
      });
    }

    // Garante que o organizationId está presente
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: "Falha ao buscar o id da organização",
      });
    }

    // Confirma que modelId é uma string
    if (typeof modelId !== "string") throw new Error();

    // Cria uma referência ao documento do modelo no Firestore
    const modelDocRef = doc(db, "models", organizationId, "models", modelId);
    // Atualiza o documento com os dados fornecidos
    await updateDoc(modelDocRef, updateData);
    // Recupera o documento atualizado para enviar na resposta
    const updatedDocSnap = await getDoc(modelDocRef);
    const updatedData = updatedDocSnap.data();

    // Retorna sucesso com os dados atualizados
    return res.status(200).json({
      success: true,
      message: "Modelo atualizado com sucesso",
      data: updatedData,
    });
  } catch (error) {
    // Loga o erro ocorrido na atualização
    console.error("Erro na atualização do modelo:", error);

    // Se for um erro do Firebase, retorna mensagem específica
    if (error instanceof FirebaseError) {
      return res.status(500).json({
        success: false,
        error: `Erro no Firestore: ${error.message}`,
      });
    }

    // Para demais erros, retorna erro interno no servidor
    return res.status(500).json({
      success: false,
      error: "Erro interno no servidor",
    });
  }
};

// Função para deletar um modelo existente
export const DeleteModel = async (req: Request, res: Response) => {
  try {
    // Extrai o organizationId do usuário autenticado
    const { organizationId } = req.user.user as User;
    // Obtém o modelId dos parâmetros da query
    const { model: modelId } = req.query;

    // Valida se o modelId é uma string não vazia
    if (!modelId || typeof modelId !== "string" || modelId.trim() === "") {
      return {
        success: false,
        error: "ID do modelo inválido",
        errorCode: "INVALID_ID",
      };
    }

    // Garante que o organizationId está presente
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: "Falha ao buscar o id da organização",
      });
    }

    // Cria uma referência ao documento do modelo no Firestore
    const modelRef = doc(db, "models", organizationId, "models", modelId);
    // Recupera o documento para confirmar sua existência
    const docSnapshot = await getDoc(modelRef);

    // Se o modelo não existir, retorna erro informando que não foi encontrado
    if (!docSnapshot.exists()) {
      return {
        success: false,
        error: "Modelo não encontrado",
        errorCode: "NOT_FOUND",
      };
    }

    // Deleta o documento do modelo
    await deleteDoc(modelRef);
    // Retorna sucesso com informações sobre a deleção
    return res.status(200).json({
      success: true,
      message: "Modelo excluído com sucesso",
      deletedId: modelId,
      deletedAt: new Date().toISOString(),
    });
  } catch (error) {
    // Extrai modelId para fins de log e depuração
    const { modelId } = req.query;
    console.error(`Erro ao excluir modelo ${modelId}:`, error);

    // Se for um erro do Firebase, retorna uma mensagem apropriada
    if (error instanceof FirebaseError) {
      return {
        success: false,
        error: `Erro no Firestore: ${error.message}`,
        errorCode: error.code,
      };
    }

    // Para outros erros, retorna mensagem de erro desconhecido
    return {
      success: false,
      error: "Erro desconhecido ao excluir modelo",
      errorCode: "UNKNOWN_ERROR",
    };
  }
};

// Função para buscar e listar todos os modelos disponíveis para uma organização
export const GetModels = async (req: Request, res: Response) => {
  try {
    // Extrai o organizationId do usuário autenticado
    const { organizationId } = req.user.user as User;

    // Garante que o organizationId está presente
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: "Falha ao buscar o id da organização",
      });
    }

    // Cria uma referência para a coleção "models" da organização
    const modelsRef = collection(db, "models", organizationId, "models");
    // Recupera todos os documentos da coleção
    const querySnapshot = await getDocs(modelsRef);

    // Mapeia os documentos para extrair o id e o título (apenas modelos que possuam título)
    const modelsList = querySnapshot.docs
      .map((doc) => ({
        id: doc.id,
        title: doc.data().title,
      }))
      .filter((model) => model.title);

    // Retorna os modelos encontrados com sucesso
    return res.status(200).json({
      success: true,
      data: modelsList,
    });
  } catch (error) {
    // Se for um erro do Firebase, retorna status 503
    if (error instanceof FirebaseError) {
      return res.status(503).json({
        success: false,
        error: "Erro no banco de dados",
        code: error.code,
      });
    }

    // Para outros erros, retorna status 500 com detalhes do erro
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({
      success: false,
      error: "Falha na busca de modelos",
      details: errorMessage,
    });
  }
};
