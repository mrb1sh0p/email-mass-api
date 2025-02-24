import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { Request, Response } from "express";
import { db } from "../firebase";

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
      createdBy: superAdminId,
      orgAdmins: [],
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

export const assignOrgAdmin = async (req: Request, res: Response) => {
  const { orgId, userId } = req.params;

  // Verificar se o solicitante é super-admin
  const orgDoc = await getDoc(doc(db, "organizations", orgId));

  if (orgDoc.data()?.createdBy !== req.user?.uid) {
    return res.status(403).json({
      success: false,
      error: "Somente o super-admin criador pode designar admins",
    });
  }

  // Atualizar organização e usuário
  await updateDoc(doc(db, "organizations", orgId), {
    orgAdmins: arrayUnion(userId),
  });

  await updateDoc(doc(db, "users", userId), {
    role: "org-admin",
    organizationId: orgId,
  });

  res.json({ success: true });
};
