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

interface Attachment {
  filename: string;
  content: string;
}

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

const MAX_PDF_SIZE = 30 * 1024 * 1024;

const validatePDF = (attachment: Attachment) => {
  const contentBuffer = Buffer.from(attachment.content, "base64");
  if (contentBuffer.length > MAX_PDF_SIZE) {
    throw new Error(`PDF ${attachment.filename} excede 5MB`);
  }

  const pdfHeader = contentBuffer.subarray(0, 4).toString();
  if (pdfHeader !== "%PDF") {
    throw new Error(`Arquivo ${attachment.filename} não é um PDF válido`);
  }

  return {
    filename: attachment.filename.replace(/[^a-zA-Z0-9_.-]/g, "_") + ".pdf",
    content: contentBuffer,
    contentType: "application/pdf",
  };
};

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

    if (!modelId || !recipients?.length || !smtpId) {
      return res.status(400).json({
        success: false,
        error: "modelId, smtpId e recipients são obrigatórios",
        errorCode: "MISSING_REQUIRED_FIELDS",
      });
    }

    const [smtpConfig, modelDoc] = await Promise.all([
      getDoc(doc(db, "smtpConfigs", smtpId)),
      getDoc(doc(db, "models", modelId)),
    ]);

    if (!smtpConfig.exists()) {
      return res.status(404).json({
        success: false,
        error: "Configuração SMTP não encontrada",
        errorCode: "SMTP_NOT_FOUND",
      });
    }

    if (!modelDoc.exists()) {
      return res.status(404).json({
        success: false,
        error: "Template de e-mail não encontrado",
        errorCode: "TEMPLATE_NOT_FOUND",
      });
    }

    // 3. Configuração segura do transporte
    const smtpData = smtpConfig.data();
    const transporter = nodemailer.createTransport({
      host: smtpData.serverAddress,
      port: smtpData.port,
      secure: smtpData.sslMethod === "SSL",
      requireTLS: smtpData.sslMethod === "TLS",
      auth:
        smtpData.authMethod === "SMTP-AUTH"
          ? {
              user: smtpData.authAccount,
              pass: smtpData.authPassword,
            }
          : undefined,
    });

    try {
      await transporter.verify();
    } catch (error) {
      console.error("Falha na conexão SMTP:", error);
      return res.status(502).json({
        success: false,
        error: "Falha na conexão com o servidor SMTP",
        errorCode: "SMTP_CONNECTION_FAILED",
      });
    }

    const BATCH_SIZE = 5;
    const results = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (recipient) => {
          try {
            const mailOptions = {
              from: smtpData.emailAddress,
              to: recipient.email,
              subject: modelDoc.data().title,
              html: modelDoc.data().body,
              attachments:
                recipient.attachments?.map((att) => ({
                  filename: `${att.filename.replace(
                    /[^a-zA-Z0-9_-]/g,
                    ""
                  )}.pdf`,
                  content: Buffer.from(att.content, "base64"),
                  contentType: "application/pdf",
                })) || [],
            };

            await transporter.sendMail(mailOptions);

            return {
              email: recipient.email,
              success: true,
              attachmentsSent: mailOptions.attachments.length,
            };
          } catch (error) {
            return {
              email: recipient.email,
              success: false,
              error:
                error instanceof Error ? error.message : "Erro desconhecido",
              errorCode: "EMAIL_SEND_FAILED",
            };
          }
        })
      );

      results.push(...batchResults);
    }

    const logRef = await addDoc(collection(db, "emailLogs"), {
      modelId,
      smtpId,
      timestamp: serverTimestamp(),
      totalRecipients: recipients.length,
      successCount: results.filter((r) => r.success).length,
      errorCount: results.filter((r) => !r.success).length,
      details: results,
    });

    res.json({
      success: true,
      logId: logRef.id,
      stats: {
        sent: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
      details: results,
    });
  } catch (error) {
    console.error("Erro geral no SendEmail:", error);
    res.status(500).json({
      success: false,
      error: "Erro interno no servidor",
      errorCode: "INTERNAL_SERVER_ERROR",
    });
  }
};
