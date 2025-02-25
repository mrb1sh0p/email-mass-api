import fs from "fs";
import { Request, Response } from "express";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { User } from "../types";

interface Attachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export const listLogs = async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.user.user as User;
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: "Organization not found in user data",
        errorCode: "MISSING_ORGANIZATION_ID",
      });
    }

    const logsCollectionRef = collection(
      db,
      "emailLogs",
      organizationId,
      "emailLogs"
    );
    const logsSnapshot = await getDocs(logsCollectionRef);

    const logs = logsSnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    return res.status(200).json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error("Error listing logs: ", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      errorCode: "INTERNAL_SERVER_ERROR",
    });
  }
};