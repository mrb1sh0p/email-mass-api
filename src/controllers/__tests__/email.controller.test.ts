import { Request, Response } from "express";
import { SetSMTPConfig, SendEmail } from "../email.controller";
import {
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
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

const mockFirestore = {
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(),
};

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
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: expect.stringContaining("Campos obrigatórios faltando"),
      errorCode: "MISSING_FIELDS",
    });
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
      data: expect.objectContaining({
        ...smtpConfig,
      }),
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
