import { Request, Response } from "express";
import { SetSMTPConfig, SendEmail } from "../email.controller";
import {
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  doc,
  collection,
} from "firebase/firestore";
import nodemailer from "nodemailer";
import { FirebaseError } from "firebase/app";

jest.mock("nodemailer");
jest.mock("../../firebase", () => ({
  db: {},
}));
jest.mock("firebase/firestore");

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

const mockRequest = (body: any = {}, user: any = { uid: "123" }) =>
  ({
    body,
    user,
  } as unknown as Request);

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

const mockTransporter = {
  verify: jest.fn(),
  sendMail: jest.fn(),
};
(nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

const MAX_PDF_SIZE = 30 * 1024 * 1024;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SECRET_KEY = "test-secret";
});

afterAll(() => {
  (console.error as jest.Mock).mockRestore();
});

describe("SetSMTPConfig", () => {
  it("deve retornar erro 400 se campos obrigatórios estiverem faltando", async () => {
    const req = mockRequest({});
    const res = mockResponse();

    await SetSMTPConfig(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining("Campos obrigatórios faltando"),
        errorCode: "MISSING_FIELDS",
      })
    );
  });

  it("deve retornar erro 400 se a porta for inválida", async () => {
    const req = mockRequest({
      serverAddress: "smtp.example.com",
      port: 70000,
      authMethod: "SMTP-AUTH",
      sslMethod: "TLS",
      emailAddress: "test@example.com",
    });
    const res = mockResponse();

    await SetSMTPConfig(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Porta inválida (deve ser entre 1 e 65535)",
      errorCode: "INVALID_PORT",
    });
  });

  it("deve criar uma nova configuração SMTP", async () => {
    const smtpConfig = {
      serverAddress: "smtp.example.com",
      port: 587,
      authMethod: "SMTP-AUTH",
      sslMethod: "TLS",
      emailAddress: "test@example.com",
    };

    (getDocs as jest.Mock).mockResolvedValue({ empty: true });
    (addDoc as jest.Mock).mockResolvedValue({ id: "123" });
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => smtpConfig,
    });

    const req = mockRequest(smtpConfig);
    const res = mockResponse();

    await SetSMTPConfig(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Configuração SMTP salva com sucesso",
      data: expect.objectContaining({
        id: "123",
        ...smtpConfig,
      }),
    });
  });

  it("deve atualizar uma configuração SMTP existente", async () => {
    const smtpConfig = {
      serverAddress: "smtp.example.com",
      port: 587,
      authMethod: "SMTP-AUTH",
      sslMethod: "TLS",
      emailAddress: "test@example.com",
    };

    (getDocs as jest.Mock).mockResolvedValue({
      empty: false,
      docs: [{ ref: "mockRef" }],
    });
    (updateDoc as jest.Mock).mockResolvedValue({});
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => smtpConfig,
    });

    const req = mockRequest(smtpConfig);
    const res = mockResponse();

    await SetSMTPConfig(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Configuração SMTP salva com sucesso",
      data: expect.objectContaining(smtpConfig),
    });
  });

  it("deve retornar erro 500 em caso de falha no Firestore", async () => {
    (getDocs as jest.Mock).mockRejectedValue(
      new FirebaseError("firestore/error", "Firestore error")
    );

    const req = mockRequest({
      serverAddress: "smtp.example.com",
      port: 587,
      authMethod: "SMTP-AUTH",
      sslMethod: "TLS",
      emailAddress: "test@example.com",
    });
    const res = mockResponse();

    await SetSMTPConfig(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Erro no banco de dados",
      errorCode: "firestore/error",
    });
  });
});

describe("SendEmail", () => {
  it("deve retornar erro 400 se modelId, smtpId ou recipients estiverem faltando", async () => {
    const req = mockRequest({});
    const res = mockResponse();

    await SendEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "modelId, smtpId e recipients são obrigatórios",
      errorCode: "MISSING_REQUIRED_FIELDS",
    });
  });

  it("deve retornar erro 404 se a configuração SMTP não for encontrada", async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

    const req = mockRequest({
      modelId: "123",
      smtpId: "456",
      recipients: [{ email: "test@example.com" }],
    });
    const res = mockResponse();

    await SendEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Configuração SMTP não encontrada",
      errorCode: "SMTP_NOT_FOUND",
    });
  });

  it("deve enviar e-mails com sucesso", async () => {
    const smtpConfig = {
      serverAddress: "smtp.example.com",
      port: 587,
      authMethod: "SMTP-AUTH",
      sslMethod: "TLS",
      emailAddress: "test@example.com",
      authAccount: "user",
      authPassword: "pass",
    };

    const modelDoc = {
      title: "Test Subject",
      body: "Test Body",
    };

    (getDoc as jest.Mock)
      .mockResolvedValueOnce({ exists: () => true, data: () => smtpConfig })
      .mockResolvedValueOnce({ exists: () => true, data: () => modelDoc });

    mockTransporter.verify.mockResolvedValue(true);
    mockTransporter.sendMail.mockResolvedValue(true);

    const req = mockRequest({
      modelId: "123",
      smtpId: "456",
      recipients: [{ email: "test@example.com" }],
    });
    const res = mockResponse();

    await SendEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        logId: expect.any(String),
        stats: { sent: 1, failed: 0 },
        details: expect.any(Array),
      })
    );
  });

  it("deve lidar com falha no envio de e-mails", async () => {
    const smtpConfig = {
      serverAddress: "smtp.example.com",
      port: 587,
      authMethod: "SMTP-AUTH",
      sslMethod: "TLS",
      emailAddress: "test@example.com",
      authAccount: "user",
      authPassword: "pass",
    };

    const modelDoc = {
      title: "Test Subject",
      body: "Test Body",
    };

    (getDoc as jest.Mock)
      .mockResolvedValueOnce({ exists: () => true, data: () => smtpConfig })
      .mockResolvedValueOnce({ exists: () => true, data: () => modelDoc });

    mockTransporter.verify.mockResolvedValue(true);
    mockTransporter.sendMail.mockRejectedValue(new Error("SMTP error"));

    const req = mockRequest({
      modelId: "123",
      smtpId: "456",
      recipients: [{ email: "test@example.com" }],
    });
    const res = mockResponse();

    await SendEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        logId: expect.any(String),
        stats: { sent: 0, failed: 1 },
        details: expect.any(Array),
      })
    );
  });

  it("deve rejeitar PDF maior que 30MB", async () => {
    // Cria um buffer maior que MAX_PDF_SIZE e gera uma string base64
    const oversizedBuffer = Buffer.alloc(MAX_PDF_SIZE + 1, "a");
    const oversizedBase64 = oversizedBuffer.toString("base64");

    const req = mockRequest({
      modelId: "123",
      smtpId: "456",
      recipients: [
        {
          email: "test@example.com",
          attachments: [{ filename: "huge.pdf", content: oversizedBase64 }],
        },
      ],
    });
    const res = mockResponse();

    await SendEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining("excede 30MB"),
      })
    );
  });

  it("deve rejeitar anexo com cabeçalho inválido", async () => {
    // Cria um arquivo pequeno, mas com cabeçalho que não é "%PDF"
    const invalidContent = Buffer.from("INVALID").toString("base64");
    const req = mockRequest({
      modelId: "123",
      smtpId: "456",
      recipients: [
        {
          email: "test@example.com",
          attachments: [{ filename: "invalid.pdf", content: invalidContent }],
        },
      ],
    });
    const res = mockResponse();

    await SendEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining("não é um PDF válido"),
      })
    );
  });
});
