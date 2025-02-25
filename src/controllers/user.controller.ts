import { Request, Response } from "express";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
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

// Define a TypeScript interface for the expected user properties when registering
interface UserPorps {
  name: string;
  password: string;
  organizationId: string;
  email: string;
}

/**
 * Registra um novo usuário.
 * - Cria o usuário na autenticação do Firebase.
 * - Armazena os dados do usuário no Firestore.
 * - Atualiza a organização para incluir o novo membro.
 *
 * Restrições:
 * - Usuários com role "user" não podem criar novos usuários.
 * - Org-admins só podem criar usuários para sua própria organização.
 */
export const registerUser = async (req: Request, res: Response) => {
  try {
    // Extrai dados do corpo da requisição
    const { email, password, organizationId, name } = req.body as UserPorps;
    // Extrai a role e a organização do usuário autenticado
    const { role, organizationId: userOrgId } = req.user?.user as User;

    // Bloqueia a criação se o usuário autenticado tiver role "user"
    if (role === "user") {
      return res.status(403).json({
        success: false,
        error: "Permissão insuficiente para criar usuários",
      });
    }

    // Se o usuário não for super-admin, e for org-admin, só pode criar usuários da mesma organização
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

    // Cria o usuário no Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Armazena os dados do usuário no Firestore, utilizando o UID gerado
    await setDoc(doc(db, "users", userCredential.user.uid), {
      uid: userCredential.user.uid,
      name,
      name_lower: name.toLowerCase(), // Armazena o nome em minúsculas para facilitar pesquisas
      email,
      role: "user",
      organizationId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).then(() => {
      // Após criar o usuário, atualiza a organização para incluir o novo usuário na lista de membros
      updateDoc(doc(db, "organizations", organizationId), {
        orgMembers: arrayUnion(userCredential.user.uid),
      });
    });

    // Retorna sucesso com o UID do novo usuário
    return res.status(201).json({
      success: true,
      userId: userCredential.user.uid,
    });
  } catch (error: any) {
    console.error("Erro no registro:", error);

    // Caso os headers já tenham sido enviados, não tenta enviar outra resposta
    if (res.headersSent) {
      console.error("Tentativa de enviar resposta duplicada");
      return;
    }

    // Define o status HTTP apropriado para o erro (409 para e-mail já em uso)
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

/**
 * Lista usuários com suporte a paginação e busca.
 * - Super-admin pode listar todos os usuários com busca por nome.
 * - Org-admin pode listar apenas os usuários de sua própria organização.
 *
 * Parâmetros da query:
 * - page: número da página.
 * - limitValue: quantidade máxima de usuários a retornar.
 * - search: termo para filtrar por nome.
 */
export const listUsers = async (req: Request, res: Response) => {
  try {
    // Extrai informações do usuário autenticado
    const { uid, role, organizationId } = req.user.user as User;
    // Extrai parâmetros de paginação e busca da query string
    const { page = 1, limitValue = 10, search } = req.query as SearchProps;

    // Inicializa uma referência para a coleção "users"
    let queryRef: Query<DocumentData> = collection(db, "users");

    if (role === "super-admin") {
      // Para super-admin, permite busca por nome (usando o campo name_lower)
      if (search) {
        queryRef = query(
          queryRef,
          where("name_lower", ">=", search.toLowerCase()),
          where("name_lower", "<=", search.toLowerCase() + "\uf8ff"),
          orderBy("name_lower"),
          limit(limitValue)
        );
      } else {
        // Se não houver termo de busca, ordena por data de criação
        queryRef = query(
          queryRef,
          orderBy("createdAt", "desc"),
          limit(limitValue)
        );
      }
    } else if (role === "org-admin") {
      // Para org-admin, filtra apenas usuários da mesma organização
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
      // Outras roles não possuem autorização para listar usuários
      return res.status(403).json({
        success: false,
        error: "Acesso não autorizado",
      });
    }

    // Executa a consulta no Firestore
    const snapshot = await getDocs(queryRef);

    // Mapeia os documentos para extrair os dados relevantes de cada usuário
    const users = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name || "Sem Nome",
      role: doc.data().role,
    }));

    // Retorna a lista de usuários
    res.json({
      users,
    });
  } catch (error: any) {
    console.error("Erro ao listar usuários:", error);

    // Define status e mensagem de erro apropriados
    const status = error instanceof FirebaseError ? 503 : 500;
    return res.status(status).json({
      success: false,
      errorCode: error.code || "LIST_USERS_ERROR",
      errorMessage: error.message || "Erro ao buscar usuários",
    });
  }
};

/**
 * Exclui um usuário pelo ID.
 * - Permite a exclusão de usuários se o usuário autenticado possuir permissão (não pode ser role "user").
 * - Verifica se o usuário pertence à mesma organização, caso o solicitante seja um org-admin.
 * - Remove o usuário da organização (remove dos arrays orgAdmins e orgMembers) e então exclui o documento do usuário.
 */
export const deleteUserById = async (req: Request, res: Response) => {
  try {
    // Extrai dados do usuário autenticado
    const { uid: currentUserId, organizationId, role } = req.user.user as User;
    // Obtém o userId a ser excluído a partir dos parâmetros da query
    const userId = typeof req.query.userId === "string" ? req.query.userId : "";

    // Verifica se o userId fornecido é válido
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "ID do usuário inválido",
        errorCode: "INVALID_USER_ID",
      });
    }

    // Usuários com role "user" não podem excluir outros usuários
    if (role === "user") {
      return res.status(403).json({
        success: false,
        error: "Acesso não autorizado",
        errorCode: "UNAUTHORIZED",
      });
    }

    // Busca o documento do usuário a ser excluído no Firestore
    const userDoc = await getDoc(doc(db, "users", userId));

    // Se o usuário não existir, retorna erro 404
    if (!userDoc.exists()) {
      return res.status(404).json({
        success: false,
        error: "Usuário não encontrado",
        errorCode: "USER_NOT_FOUND",
      });
    }

    // Extrai os dados do usuário
    const userData = userDoc.data();
    if (!userData) {
      return res.status(500).json({
        success: false,
        error: "Dados do usuário inválidos",
        errorCode: "INVALID_USER_DATA",
      });
    }

    // Se o solicitante for um org-admin, verifica se o usuário a ser excluído pertence à mesma organização
    if (role === "org-admin") {
      if (organizationId !== userData.organizationId) {
        return res.status(403).json({
          success: false,
          error: "Acesso restrito à mesma organização",
          errorCode: "ORG_ACCESS_DENIED",
        });
      }
    }

    // Cria uma referência para o documento do usuário
    const userRef = doc(db, "users", userId);

    // Garante que o campo uid do usuário esteja presente
    if (!userData.uid) {
      return res.status(500).json({
        success: false,
        error: "UID do usuário não encontrado",
        errorCode: "UID_NOT_FOUND",
      });
    }

    // Se o usuário estiver vinculado a uma organização, remove-o dos arrays de administradores e membros
    if (userData.organizationId) {
      const orgRef = doc(db, "organizations", userData.organizationId);

      // Se o usuário for um administrador, remove-o do array orgAdmins
      if (userData.role === "org-admin") {
        await updateDoc(orgRef, {
          orgAdmins: arrayRemove(userId),
        });
      }

      // Remove o usuário do array orgMembers
      await updateDoc(orgRef, {
        orgMembers: arrayRemove(userId),
      });
    }

    // Exclui o documento do usuário no Firestore
    await deleteDoc(userRef);

    // Retorna uma resposta de sucesso
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
