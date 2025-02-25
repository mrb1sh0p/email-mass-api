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
import { User } from "../types";

interface Attachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

interface SendEmailRequest {
  modelId: string;
  smtpId: string;
  recipients: {
    email: string;
    attachments?: Attachment[];
  }[];
}

const MAX_PDF_SIZE = 30 * 1024 * 1024;

const validatePDF = (attachment: Attachment) => {
  const contentBuffer = Buffer.from(attachment.content.toString(), "base64");
  if (contentBuffer.length > MAX_PDF_SIZE) {
    throw new Error(`PDF ${attachment.filename} excede 30MB`);
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
    const { id: userId, organizationId, role } = req.user.user as User;
    const { smtpConfig, orgId } = req.body;

    const requiredFields: (keyof SMTPConfig)[] = [
      "serverAddress",
      "port",
      "authMethod",
      "sslMethod",
      "emailAddress",
    ];

    const missingFields = requiredFields.filter((field) => !smtpConfig[field]);
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

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: "organizationId é obrigatório",
        errorCode: "MISSING_ORGANIZATION_ID",
      });
    }

    if (organizationId !== orgId || role === "user") {
      return res.status(403).json({
        success: false,
        error: "Você não tem autorização para acessar essa área",
      });
    }

    // Possível implementação de criptografia para authPassword vat ser adicionada aqui.
    const smtpConfigsRef = collection(db, organizationId, "smtpConfigs");
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

    return res.status(200).json({
      success: true,
      message: "Configuração SMTP salva com sucesso",
      data: { id: docRef.id, ...configData },
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

    return res.status(500).json({
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

    // Validação prévia dos anexos para todos os destinatários
    for (const recipient of recipients) {
      if (recipient.attachments) {
        try {
          recipient.attachments = recipient.attachments.map(validatePDF);
        } catch (validationError) {
          return res.status(400).json({
            success: false,
            error:
              validationError instanceof Error
                ? validationError.message
                : "Erro de validação de anexo",
            errorCode: "INVALID_ATTACHMENT",
          });
        }
      }
    }

    const [smtpConfigSnap, modelDocSnap] = await Promise.all([
      getDoc(doc(db, "smtpConfigs", smtpId)),
      getDoc(doc(db, "models", modelId)),
    ]);

    if (!smtpConfigSnap.exists()) {
      return res.status(404).json({
        success: false,
        error: "Configuração SMTP não encontrada",
        errorCode: "SMTP_NOT_FOUND",
      });
    }

    if (!modelDocSnap.exists()) {
      return res.status(404).json({
        success: false,
        error: "Template de e-mail não encontrado",
        errorCode: "TEMPLATE_NOT_FOUND",
      });
    }

    const smtpData = smtpConfigSnap.data();
    const modelData = modelDocSnap.data();

    const transporter = nodemailer.createTransport({
      host: smtpData.serverAddress,
      port: smtpData.port,
      secure: smtpData.sslMethod === "SSL",
      requireTLS: smtpData.sslMethod === "TLS",
      auth:
        smtpData.authMethod === "SMTP-AUTH"
          ? { user: smtpData.authAccount, pass: smtpData.authPassword }
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
              subject: modelData.title,
              html: modelData.body,
              attachments: recipient.attachments || [],
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

    return res.status(200).json({
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
    return res.status(500).json({
      success: false,
      error: "Erro interno no servidor",
      errorCode: "INTERNAL_SERVER_ERROR",
    });
  }
};
