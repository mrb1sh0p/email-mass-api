import { Request, Response } from "express";
import { addDoc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { CreateModel, UpdateModel, DeleteModel } from "../model.controller";
import { FirebaseError } from "firebase/app";

jest.mock("../../firebase", () => ({
  db: {},
}));
jest.mock("firebase/firestore");

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SECRET_KEY = "test-secret";
});

afterAll(() => {
  (console.error as jest.Mock).mockRestore();
});

const mockRequest = (body: any = {}) =>
  ({
    body,
  } as Request);

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

describe("CreateModel", () => {
  it("deve retornar erro 400 se título ou corpo estiverem faltando", async () => {
    const req = mockRequest({});
    const res = mockResponse();

    await CreateModel(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Título e conteúdo são obrigatórios",
      requiredFields: ["title", "body"],
    });
  });

  it("deve criar um modelo com sucesso", async () => {
    const modelData = {
      title: "Test Model",
      body: "Test Body",
    };

    (addDoc as jest.Mock).mockResolvedValue({ id: "123" });
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => modelData,
    });

    const req = mockRequest(modelData);
    const res = mockResponse();

    await CreateModel(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Modelo criado com sucesso",
      data: {
        id: "123",
        ...modelData,
      },
    });
  });

  it("deve retornar erro 503 em caso de falha no Firestore", async () => {
    (addDoc as jest.Mock).mockRejectedValue(
      new FirebaseError("firestore/error", "Firestore error")
    );

    const req = mockRequest({
      title: "Test Model",
      body: "Test Body",
    });
    const res = mockResponse();

    await CreateModel(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Erro no banco de dados",
      code: "firestore/error",
    });
  });

  it("deve retornar erro 500 em caso de erro desconhecido", async () => {
    (addDoc as jest.Mock).mockRejectedValue(new Error("Unknown error"));

    const req = mockRequest({
      title: "Test Model",
      body: "Test Body",
    });
    const res = mockResponse();

    await CreateModel(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Falha na criação do modelo",
      details: "Unknown error",
    });
  });
});

describe("UpdateModel", () => {
  it("deve retornar erro 400 se modelId estiver faltando", async () => {
    const req = mockRequest({});
    const res = mockResponse();

    await UpdateModel(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "modelId é obrigatório para atualização",
    });
  });

  it("deve retornar erro 400 se nenhum campo válido for enviado", async () => {
    const req = mockRequest({ modelId: "123" });
    const res = mockResponse();

    await UpdateModel(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Nenhum campo válido para atualização foi enviado",
    });
  });

  it("deve atualizar um modelo com sucesso", async () => {
    const updateData = {
      modelId: "123",
      title: "Updated Title",
    };

    (updateDoc as jest.Mock).mockResolvedValue({});
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => updateData,
    });

    const req = mockRequest(updateData);
    const res = mockResponse();

    await UpdateModel(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Modelo atualizado com sucesso",
      data: updateData,
    });
  });

  it("deve retornar erro 500 em caso de falha no Firestore", async () => {
    (updateDoc as jest.Mock).mockRejectedValue(
      new FirebaseError("firestore/error", "Firestore error")
    );

    const req = mockRequest({
      modelId: "123",
      title: "Updated Title",
    });
    const res = mockResponse();

    await UpdateModel(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Erro no Firestore: Firestore error",
    });
  });
});

describe("DeleteModel", () => {
  it("deve retornar erro se o ID for inválido", async () => {
    const result = await DeleteModel("");

    expect(result).toEqual({
      success: false,
      error: "ID do modelo inválido",
      errorCode: "INVALID_ID",
    });
  });

  it("deve retornar erro se o modelo não for encontrado", async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

    const result = await DeleteModel("123");

    expect(result).toEqual({
      success: false,
      error: "Modelo não encontrado",
      errorCode: "NOT_FOUND",
    });
  });

  it("deve excluir um modelo com sucesso", async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true });
    (updateDoc as jest.Mock).mockResolvedValue({});
    (deleteDoc as jest.Mock).mockResolvedValue({});

    const result = await DeleteModel("123");

    expect(result).toEqual({
      success: true,
      message: "Modelo excluído com sucesso",
      deletedId: "123",
      deletedAt: expect.any(String),
    });
  });

  it("deve retornar erro em caso de falha no Firestore", async () => {
    (getDoc as jest.Mock).mockRejectedValue(
      new FirebaseError("firestore/error", "Firestore error")
    );

    const result = await DeleteModel("123");

    expect(result).toEqual({
      success: false,
      error: "Erro no Firestore: Firestore error",
      errorCode: "firestore/error",
    });
  });
});
