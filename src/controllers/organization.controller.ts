// Importa funções do Firestore para manipulação de documentos e consultas no banco de dados
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  DocumentData,
  getDoc,
  orderBy,
  query,
  Query,
  serverTimestamp,
  updateDoc,
  where,
  limit,
  getDocs,
  getCountFromServer,
} from "firebase/firestore";

// Importa os tipos Request e Response do Express para tratamento de requisições HTTP
import { Request, Response } from "express";

// Importa a instância do banco de dados configurado no Firebase
import { db } from "../firebase";

// Importa os tipos personalizados para busca e usuário
import { SearchProps, User } from "src/types";

// Importa a classe FirebaseError para tratamento de erros específicos do Firebase
import { FirebaseError } from "firebase/app";

// Define a interface para as propriedades necessárias ao criar uma organização
interface OrgsProps {
  name: string;
  description: string;
}

/**
 * Função para criar uma nova organização.
 * - Recebe nome e descrição da organização do corpo da requisição.
 * - Utiliza o ID do super-admin (usuário autenticado) para definir o criador.
 * - Armazena a organização no Firestore e retorna os dados criados.
 */
export const createOrganization = async (req: Request, res: Response) => {
  try {
    // Extrai os dados enviados no corpo da requisição
    const { name, description } = req.body as OrgsProps;
    // Obtém o ID do super-admin a partir dos dados do usuário autenticado
    const superAdminId = req.user.user.id;

    console.log(superAdminId);

    // Cria um novo documento na coleção "organizations" com os dados da organização
    const orgRef = await addDoc(collection(db, "organizations"), {
      name,
      description,
      name_lower: name.toLowerCase(), // Armazena o nome em minúsculas para facilitar buscas
      createdBy: superAdminId, // Define o criador da organização
      orgAdmins: [], // Inicializa a lista de administradores da organização vazia
      orgMembers: [], // Inicializa a lista de membros da organização vazia
      createdAt: serverTimestamp(), // Registra o horário de criação
      updatedAt: serverTimestamp(), // Registra o horário de atualização
    });

    // Retorna uma resposta de sucesso com os dados da organização criada
    res.status(201).json({
      success: true,
      data: {
        id: orgRef.id,
        name,
        description,
      },
    });
  } catch (error: any) {
    let status = 500;
    // Caso ocorra um erro de argumento inválido, ajusta o status para 400 (Bad Request)
    if (error.code === "invalid-argument") {
      status = 400;
    }

    // Retorna uma resposta de erro com o código e mensagem apropriados
    return res.status(status).json({
      errorCode: error.code || "UNKNOWN_ERROR",
      errorMessage:
        error.message || "Ocorreu um erro durante a criação da Org.",
    });
  }
};

/**
 * Função para obter organizações com suporte à paginação e pesquisa.
 * - Super-admins podem buscar por nome ou listar todas as organizações.
 * - Org-admins só podem acessar a organização à qual pertencem.
 * - Retorna dados de cada organização, incluindo contagem de membros e se o usuário é admin.
 */
export const getOrganizations = async (req: Request, res: Response) => {
  try {
    // Extrai o ID e a role do usuário autenticado
    const { uid, role } = req.user.user as User;
    // Extrai parâmetros de paginação e pesquisa da query string
    const { page = 1, limitValue = 10, search } = req.query as SearchProps;

    const pageNumber = Number(page);
    const limitNumber = Number(limitValue);

    // Inicializa a referência da query para a coleção "organizations"
    let queryRef: Query<DocumentData> = collection(db, "organizations");

    // Configura a query com base na role do usuário
    if (role === "super-admin") {
      if (search) {
        // Se houver termo de busca, filtra os nomes (em minúsculas) que correspondam à pesquisa
        queryRef = query(
          queryRef,
          where("name_lower", ">=", search.toLowerCase()),
          where("name_lower", "<=", search.toLowerCase() + "\uf8ff"),
          orderBy("name_lower"),
          limit(limitNumber)
        );
      } else {
        // Se não houver busca, ordena as organizações pela data de criação (mais recentes primeiro)
        queryRef = query(
          queryRef,
          orderBy("createdAt", "desc"),
          limit(limitNumber)
        );
      }
    } else if (role === "org-admin") {
      // Para org-admins, recupera a organização vinculada ao usuário
      const userDoc = await getDoc(doc(db, "users", uid));
      const orgId = userDoc.data()?.organizationId;

      if (!orgId) {
        return res.status(403).json({
          success: false,
          error: "Usuário não vinculado a nenhuma organização",
        });
      }

      // Filtra a organização que corresponde ao ID do usuário
      queryRef = query(queryRef, where("__name__", "==", orgId));
    } else {
      // Outras roles não têm autorização para acessar organizações
      return res.status(403).json({
        success: false,
        error: "Acesso não autorizado",
      });
    }

    // Executa a query e obtém os documentos correspondentes
    const snapshot = await getDocs(queryRef);

    // Mapeia os documentos para extrair os dados relevantes de cada organização
    const organizations = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      description: doc.data().description,
      createdAt: doc.data().createdAt?.toDate(),
      memberCount: doc.data().orgMembers.length,
      isAdmin: doc.data().orgAdmins?.includes(uid) || false,
    }));

    let total = 0;
    // Se o usuário for super-admin e não houver filtro de busca, obtém a contagem total de organizações
    if (role === "super-admin" && !search) {
      const countSnapshot = await getCountFromServer(
        collection(db, "organizations")
      );
      console.log(countSnapshot.data());
      total = countSnapshot.data().count;
    }

    // Retorna os dados das organizações com informações de paginação
    res.json({
      success: true,
      data: organizations,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Erro ao buscar organizações:", error);

    // Trata erros específicos do Firebase
    if (error instanceof FirebaseError) {
      return res.status(503).json({
        success: false,
        error: "Erro no banco de dados",
        code: error.code,
      });
    }

    // Retorna erro interno do servidor para outros casos
    res.status(500).json({
      success: false,
      error: "Erro interno ao buscar organizações",
    });
  }
};

/**
 * Função para designar um usuário como administrador de uma organização.
 * - Apenas o super-admin (criador) tem permissão para designar administradores.
 * - Atualiza a organização para incluir o novo admin e o usuário para definir sua role.
 */
export const assignOrgAdmin = async (req: Request, res: Response) => {
  // Extrai orgId e userId dos parâmetros da URL
  const { orgId, userId } = req.params;

  // Verifica se o usuário autenticado é um super-admin, pois somente ele pode designar admins
  if (req.user.user.role !== "super-admin") {
    return res.status(403).json({
      success: false,
      error: "Somente o super-admin criador pode designar admins",
    });
  }

  // Atualiza o documento da organização para adicionar o userId à lista de administradores
  await updateDoc(doc(db, "organizations", orgId), {
    orgAdmins: arrayUnion(userId),
  });

  // Atualiza o documento do usuário para definir sua role como org-admin e vincular à organização
  await updateDoc(doc(db, "users", userId), {
    role: "org-admin",
    organizationId: orgId,
  });

  // Retorna uma resposta de sucesso
  res.json({ success: true });
};
