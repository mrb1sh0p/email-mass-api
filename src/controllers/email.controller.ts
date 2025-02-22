// src/controllers/email.controller.ts
import { Request, Response } from "express";
import nodemailer from "nodemailer";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { SMTPConfig } from "../types/emails.types";

interface SendEmailRequest {
  modelId: string;
  smtpId: string;
  recipients: {
    email: string;
    attachments?: {
      filename: string;
      content: string;
    }[];
  }[];
}

export const SetSMTPConfig = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    const smtpConfig: SMTPConfig = req.body;

    const requiredFields: (keyof SMTPConfig)[] = [
      "serverAddress",
      "port",
      "authMethod",
      "sslMethod",
      "emailAddress",
    ];

    const missingFields = requiredFields.filter(
      (field) => !smtpConfig[field as keyof SMTPConfig]
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Campos obrigatórios faltando: ${missingFields.join(", ")}`,
        errorCode: "MISSING_FIELDS",
      });
    }

    if (
      typeof smtpConfig.port !== "number" ||
      smtpConfig.port < 1 ||
      smtpConfig.port > 65535
    ) {
      return res.status(400).json({
        success: false,
        error: "Porta inválida (deve ser entre 1 e 65535)",
        errorCode: "INVALID_PORT",
      });
    }

    // if (smtpConfig.authPassword) {
    //   const encryptedPassword = await encrypt(smtpConfig.authPassword);
    //   smtpConfig.authPassword = encryptedPassword;
    // }

    const smtpConfigsRef = collection(db, "smtpConfigs");
    const querySnapshot = await getDocs(
      query(smtpConfigsRef, where("userId", "==", userId))
    );

    let docRef;
    if (!querySnapshot.empty) {
      docRef = querySnapshot.docs[0].ref;
      await updateDoc(docRef, {
        ...smtpConfig,
        updatedAt: serverTimestamp(),
      });
    } else {
      docRef = await addDoc(smtpConfigsRef, {
        ...smtpConfig,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const updatedDoc = await getDoc(docRef);
    const configData = updatedDoc.data();

    if (configData?.authPassword) {
      delete configData.authPassword;
    }

    res.status(200).json({
      success: true,
      message: "Configuração SMTP salva com sucesso",
      data: {
        id: docRef.id,
        ...configData,
      },
    });
  } catch (error) {
    console.error("Erro na configuração SMTP:", error);

    if (error instanceof FirebaseError) {
      return res.status(500).json({
        success: false,
        error: "Erro no banco de dados",
        errorCode: error.code,
      });
    }

    if (error instanceof Error && error.message.includes("encrypt")) {
      return res.status(500).json({
        success: false,
        error: "Erro na criptografia de dados sensíveis",
        errorCode: "ENCRYPTION_ERROR",
      });
    }

    res.status(500).json({
      success: false,
      error: "Erro interno no servidor",
      errorCode: "INTERNAL_ERROR",
    });
  }
};

export const SendEmail = async (req: Request, res: Response) => {
  try {
    const { modelId, recipients, smtpId }: SendEmailRequest = req.body;

    if (!modelId || !recipients?.length) {
      return res.status(400).json({
        success: false,
        error: "modelId e recipients são obrigatórios",
      });
    }

    const smtpConfigRef = doc(db, "smtpConfigs", smtpId);
    const smtpConfig = await getDoc(smtpConfigRef);

    if (!smtpConfig.exists()) {
      return res.status(400).json({
        success: false,
        error: "Configuração SMTP não encontrada",
      });
    }

    const modelRef = doc(db, "models", modelId);
    const modelDoc = await getDoc(modelRef);

    if (!modelDoc.exists()) {
      return res.status(404).json({
        success: false,
        error: "Template de e-mail não encontrado",
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.data().serverAddress,
      port: smtpConfig.data().port,
      requireTLS: smtpConfig.data().sslMethod == "TLS" ? true : false,
      auth: {
        user: smtpConfig.data().authAccount,
        pass: smtpConfig.data().authPassword,
      },
    });

    const results = [];

    try {
      await transporter.verify();
      console.log("Conexão SMTP válida!");
    } catch (error) {
      console.log(smtpConfig.data());
      console.error("Falha na conexão:", error);
    }

    for (const recipient of recipients) {
      try {
        const mailOptions = {
          from: smtpConfig.data().emailAddress,
          to: recipient.email,
          subject: modelDoc.data().title,
          html: modelDoc.data().body,
          attachments:
            recipient.attachments?.map((att) => ({
              filename: att.filename,
              content: Buffer.from(att.content, "base64"),
            })) || [],
        };

        await transporter.sendMail(mailOptions);

        results.push({
          email: recipient.email,
          success: true,
          attachmentsSent: recipient.attachments?.length || 0,
        });
      } catch (error) {
        results.push({
          email: recipient.email,
          success: false,
          error: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }

    //TODO: Save log in firebase

    res.json({
      success: true,
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      details: results,
    });
  } catch (error) {}
};
