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
import { Request, Response } from "express";
import { db } from "../firebase";
import { SearchProps, User } from "src/types";
import { FirebaseError } from "firebase/app";

interface OrgsProps {
  name: string;
  description: string;
}

export const createOrganization = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body as OrgsProps;
    const superAdminId = req.user.user.id;

    console.log(superAdminId);

    const orgRef = await addDoc(collection(db, "organizations"), {
      name,
      description,
      name_lower: name.toLowerCase(),
      createdBy: superAdminId,
      orgAdmins: [],
      orgMembers: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

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
    if (error.code === "invalid-argument") {
      status = 400;
    }

    return res.status(status).json({
      errorCode: error.code || "UNKNOWN_ERROR",
      errorMessage:
        error.message || "Ocorreu um erro durante a criação da Org.",
    });
  }
};

export const getOrganizations = async (req: Request, res: Response) => {
  try {
    const { uid, role } = req.user.user as User;
    const { page = 1, limitValue = 10, search } = req.query as SearchProps;

    const pageNumber = Number(page);
    const limitNumber = Number(limitValue);
    // const offsetValue = (pageNumber - 1) * limitNumber;

    let queryRef: Query<DocumentData> = collection(db, "organizations");

    if (role === "super-admin") {
      if (search) {
        queryRef = query(
          queryRef,
          where("name_lower", ">=", search.toLowerCase()),
          where("name_lower", "<=", search.toLowerCase() + "\uf8ff"),
          orderBy("name_lower"),
          limit(limitNumber)
        );
      } else {
        queryRef = query(
          queryRef,
          orderBy("createdAt", "desc"),
          limit(limitNumber)
        );
      }
    } else if (role === "org-admin") {
      const userDoc = await getDoc(doc(db, "users", uid));
      const orgId = userDoc.data()?.organizationId;

      if (!orgId) {
        return res.status(403).json({
          success: false,
          error: "Usuário não vinculado a nenhuma organização",
        });
      }

      queryRef = query(queryRef, where("__name__", "==", orgId));
    } else {
      return res.status(403).json({
        success: false,
        error: "Acesso não autorizado",
      });
    }

    const snapshot = await getDocs(queryRef);

    const organizations = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      description: doc.data().description,
      createdAt: doc.data().createdAt?.toDate(),
      memberCount: doc.data().orgMembers.length,
      isAdmin: doc.data().orgAdmins?.includes(uid) || false,
    }));

    let total = 0;
    if (role === "super-admin" && !search) {
      const countSnapshot = await getCountFromServer(
        collection(db, "organizations")
      );
      console.log(countSnapshot.data())
      total = countSnapshot.data().count;
    }

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

    if (error instanceof FirebaseError) {
      return res.status(503).json({
        success: false,
        error: "Erro no banco de dados",
        code: error.code,
      });
    }

    res.status(500).json({
      success: false,
      error: "Erro interno ao buscar organizações",
    });
  }
};

export const assignOrgAdmin = async (req: Request, res: Response) => {
  const { orgId, userId } = req.params;

  if (req.user.user.role !== "super-admin") {
    return res.status(403).json({
      success: false,
      error: "Somente o super-admin criador pode designar admins",
    });
  }

  await updateDoc(doc(db, "organizations", orgId), {
    orgAdmins: arrayUnion(userId),
  });

  await updateDoc(doc(db, "users", userId), {
    role: "org-admin",
    organizationId: orgId,
  });

  res.json({ success: true });
};
