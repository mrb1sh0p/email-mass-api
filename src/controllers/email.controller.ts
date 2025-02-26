// Importa os tipos Request e Response do Express para tipagem dos parâmetros HTTP
import { Request, Response } from "express";
// Importa o módulo nodemailer para envio de e-mails
import nodemailer from "nodemailer";
// Importa a instância do banco de dados Firebase
import { db } from "../firebase";
// Importa funções do Firestore para operações com o banco de dados (criação, atualização, consulta, etc.)
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
// Importa a classe FirebaseError para tratar erros específicos do Firebase
import { FirebaseError } from "firebase/app";
// Importa o tipo SMTPConfig que define a estrutura da configuração SMTP
import { SMTPConfig } from "../types/emails.types";
// Importa o tipo User que representa a estrutura dos dados do usuário autenticado
import { User } from "../types";

// Define a interface para os anexos que podem ser enviados com o e-mail
interface Attachment {
  filename: string; // Nome do arquivo
  content: Buffer; // Conteúdo do arquivo em formato Buffer
  contentType: string; // Tipo de conteúdo (por exemplo, "application/pdf")
}

// Define a interface para a requisição de envio de e-mail, contendo o ID do modelo, ID SMTP e lista de destinatários
interface SendEmailRequest {
  modelId: string;
  smtpId: string;
  recipients: {
    email: string;
    attachments?: Attachment[];
  }[];
}

// Define o tamanho máximo permitido para arquivos PDF (30MB)
const MAX_PDF_SIZE = 30 * 1024 * 1024;

// Função para validar se um anexo é um PDF válido e não excede o tamanho máximo permitido
const validatePDF = (attachment: Attachment) => {
  // Converte o conteúdo do anexo para um Buffer usando codificação base64
  const contentBuffer = Buffer.from(attachment.content.toString(), "base64");

  // Verifica se o tamanho do PDF excede o limite máximo definido
  if (contentBuffer.length > MAX_PDF_SIZE) {
    throw new Error(`PDF ${attachment.filename} excede 30MB`);
  }

  // Extrai os primeiros 4 bytes para checar o cabeçalho do arquivo e verificar se é um PDF (deve iniciar com "%PDF")
  const pdfHeader = contentBuffer.subarray(0, 4).toString();
  if (pdfHeader !== "%PDF") {
    throw new Error(`Arquivo ${attachment.filename} não é um PDF válido`);
  }

  // Retorna o anexo validado com o nome sanitizado (substituindo caracteres indesejados), o conteúdo e o tipo de conteúdo
  return {
    filename: attachment.filename.replace(/[^a-zA-Z0-9_.-]/g, "_") + ".pdf",
    content: contentBuffer,
    contentType: "application/pdf",
  };
};

// Função para configurar ou atualizar a configuração SMTP de uma organização
export const SetSMTPConfig = async (req: Request, res: Response) => {
  try {
    // Extrai dados do usuário autenticado (ID, organização e função)
    const { uid: userId, organizationId, role } = req.user.user as User;
    // Extrai a configuração SMTP enviada no corpo da requisição e o ID da organização
    const { smtpConfig, orgId } = req.body;

    // Define os campos obrigatórios para a configuração SMTP
    const requiredFields: (keyof SMTPConfig)[] = [
      "serverAddress",
      "port",
      "authMethod",
      "sslMethod",
      "emailAddress",
    ];
    // Verifica se algum dos campos obrigatórios está faltando na configuração enviada
    const missingFields = requiredFields.filter((field) => !smtpConfig[field]);

    // Se o usuário não estiver autenticado, retorna erro 401 (não autorizado)
    if (!req.user || !req.user.user || !req.user.user.uid) {
      return res.status(401).json({
        success: false,
        error: "Usuário não autenticado",
        errorCode: "UNAUTHENTICATED",
      });
    }

    // Se houver campos obrigatórios faltando, retorna erro 400 com a lista de campos em falta
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Campos obrigatórios faltando: ${missingFields.join(", ")}`,
        errorCode: "MISSING_FIELDS",
      });
    }

    // Valida se a porta informada é um número válido entre 1 e 65535
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

    // Verifica se o usuário possui um organizationId associado
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: "organizationId é obrigatório",
        errorCode: "MISSING_ORGANIZATION_ID",
      });
    }

    // Garante que o usuário tem autorização para configurar SMTP: deve pertencer à organização correta e não pode ser apenas "user"
    if (organizationId !== orgId || role === "user") {
      return res.status(403).json({
        success: false,
        error: "Você não tem autorização para acessar essa área",
      });
    }

    // Cria uma referência para a coleção de configurações SMTP da organização no Firestore
    const smtpConfigsRef = collection(
      db,
      "smtpConfigs",
      organizationId,
      "smtpConfigs"
    );

    // Obtém as configurações SMTP existentes para a organização
    const existingConfigsSnapshot = await getDocs(smtpConfigsRef);
    console.log(existingConfigsSnapshot.empty);

    // Se já existir uma configuração, atualiza o documento existente com os novos dados e registra o timestamp da atualização
    if (!existingConfigsSnapshot.empty) {
      const existingDoc = existingConfigsSnapshot.docs[0];
      await updateDoc(existingDoc.ref, {
        ...smtpConfig,
        userId,
        updatedAt: serverTimestamp(),
      });

      return res.status(200).json({
        success: true,
        message: "Configuração SMTP atualizada com sucesso",
        data: { id: existingDoc.id },
      });
    } else {
      // Se não houver configuração existente, cria um novo documento com os dados fornecidos e registra os timestamps de criação e atualização
      const newDocRef = await addDoc(smtpConfigsRef, {
        ...smtpConfig,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return res.status(200).json({
        success: true,
        message: "Configuração SMTP salva com sucesso",
        data: { id: newDocRef.id },
      });
    }
  } catch (error: any) {
    // Registra o erro no console para fins de depuração
    console.error("Erro na configuração SMTP:", error);

    // Se o erro for um FirebaseError, retorna uma mensagem específica de erro no banco de dados
    if (error instanceof FirebaseError) {
      return res.status(500).json({
        success: false,
        error: "Erro no banco de dados",
        errorCode: error.code,
      });
    }

    // Para quaisquer outros erros, retorna um erro interno no servidor (500)
    return res.status(500).json({
      success: false,
      error: "Erro interno no servidor",
      errorCode: "INTERNAL_ERROR",
    });
  }
};

// Função para enviar e-mails utilizando uma configuração SMTP e um template de e-mail
export const SendEmail = async (req: Request, res: Response) => {
  try {
    // Extrai o ID da organização do usuário autenticado
    const { organizationId } = req.user.user as User;
    // Extrai os parâmetros "model" (ID do template) e "smtpId" da query string da requisição
    const { model: modelId, smtpId } = req.query;
    // Extrai a lista de destinatários do corpo da requisição, de acordo com a interface SendEmailRequest
    const { recipients }: SendEmailRequest = req.body;

    // Verifica se os parâmetros obrigatórios foram fornecidos
    if (!modelId || !smtpId || !recipients?.length) {
      return res.status(400).json({
        success: false,
        error: "modelId, smtpId e recipients são obrigatórios",
        errorCode: "MISSING_REQUIRED_FIELDS",
      });
    }

    // Verifica se o usuário está associado a uma organização
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: "Usuário não pertence a nenhuma organização",
        errorCode: "MISSING_ORGANIZATION_ID",
      });
    }

    // Valida se smtpId e modelId são do tipo string
    if (typeof smtpId !== "string") {
      return res.status(400).json({
        success: false,
        error: "smtpId deve ser uma string",
        errorCode: "INVALID_SMTPID",
      });
    }
    if (typeof modelId !== "string") {
      return res.status(400).json({
        success: false,
        error: "modelId deve ser uma string",
        errorCode: "INVALID_MODELID",
      });
    }

    // Para cada destinatário, se existirem anexos, realiza a validação de cada anexo (para garantir que sejam PDFs válidos)
    for (const recipient of recipients) {
      if (recipient.attachments) {
        try {
          // Mapeia cada anexo utilizando a função validatePDF
          recipient.attachments = recipient.attachments.map(validatePDF);
        } catch (validationError) {
          // Em caso de erro na validação, retorna um erro 400 com a mensagem apropriada
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

    // Busca em paralelo a configuração SMTP e o template de e-mail a partir do Firestore
    const [smtpConfigSnap, modelDocSnap] = await Promise.all([
      getDoc(doc(db, "smtpConfigs", organizationId, "smtpConfigs", smtpId)),
      getDoc(doc(db, "models", organizationId, "models", modelId)),
    ]);

    // Se a configuração SMTP não for encontrada, retorna um erro 404
    if (!smtpConfigSnap.exists()) {
      return res.status(404).json({
        success: false,
        error: "Configuração SMTP não encontrada",
        errorCode: "SMTP_NOT_FOUND",
      });
    }

    // Se o template de e-mail não for encontrado, retorna um erro 404
    if (!modelDocSnap.exists()) {
      return res.status(404).json({
        success: false,
        error: "Template de e-mail não encontrado",
        errorCode: "TEMPLATE_NOT_FOUND",
      });
    }

    // Extrai os dados da configuração SMTP e do template de e-mail
    const smtpData = smtpConfigSnap.data();
    const modelData = modelDocSnap.data();

    // Cria um transportador de e-mail utilizando os dados de configuração SMTP
    const transporter = nodemailer.createTransport({
      host: smtpData.serverAddress,
      port: smtpData.port,
      secure: smtpData.sslMethod === "SSL", // Define conexão segura via SSL, se aplicável
      requireTLS: smtpData.sslMethod === "TLS", // Define uso obrigatório de TLS, se aplicável
      auth:
        smtpData.authMethod === "SMTP-AUTH"
          ? { user: smtpData.authAccount, pass: smtpData.authPassword }
          : undefined,
    });

    // Verifica se a conexão com o servidor SMTP está funcionando corretamente
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

    // Define o tamanho do lote para envio de e-mails (neste caso, 5 e-mails por lote)
    const BATCH_SIZE = 5;
    // Array para armazenar os resultados de envio para cada destinatário
    const results = [];
    // Itera sobre os destinatários em lotes para evitar sobrecarregar o servidor SMTP
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      // Envia os e-mails em paralelo para o lote atual
      const batchResults = await Promise.all(
        batch.map(async (recipient) => {
          try {
            // Define as opções do e-mail: remetente, destinatário, assunto, corpo (HTML) e anexos (se houver)
            const mailOptions = {
              from: smtpData.emailAddress,
              to: recipient.email,
              cc: smtpData.emailAddress,
              subject: modelData.title,
              html: modelData.body,
              attachments: recipient.attachments || [],
            };
            // Envia o e-mail utilizando o transportador configurado
            await transporter.sendMail(mailOptions);
            // Retorna o resultado bem-sucedido para este destinatário
            return {
              email: recipient.email,
              success: true,
              attachmentsSent: mailOptions.attachments.length,
            };
          } catch (error) {
            // Em caso de erro no envio, retorna os detalhes do erro para o destinatário
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
      // Acumula os resultados do lote no array geral de resultados
      results.push(...batchResults);
    }

    // Registra um log do envio de e-mails no Firestore, contendo estatísticas e detalhes do envio
    const logRef = await addDoc(
      collection(db, "emailLogs", organizationId, "emailLogs"),
      {
        modelId,
        smtpId,
        timestamp: serverTimestamp(),
        totalRecipients: recipients.length,
        successCount: results.filter((r) => r.success).length,
        errorCount: results.filter((r) => !r.success).length,
        details: results,
      }
    );

    // Retorna a resposta com status 200 contendo o ID do log, estatísticas e detalhes dos envios
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
    // Loga o erro geral no console para depuração
    console.error("Erro geral no SendEmail:", error);
    // Retorna um erro interno no servidor (500) caso ocorra qualquer exceção inesperada
    return res.status(500).json({
      success: false,
      error: "Erro interno no servidor",
      errorCode: "INTERNAL_SERVER_ERROR",
    });
  }
};
