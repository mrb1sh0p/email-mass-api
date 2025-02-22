import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { signInWithEmailAndPassword } from "firebase/auth";
import { authenticate } from "../auth.controller";
import { auth } from "../../firebase";

jest.mock("firebase/auth");
jest.mock("jsonwebtoken");
jest.mock("../../firebase", () => ({
  auth: {},
}));

beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
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

describe("Authentication Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SECRET_KEY = "test-secret";
  });

  it("deve retornar erro 400 se email ou senha estiverem faltando", async () => {
    const req = mockRequest();
    const res = mockResponse();

    await authenticate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Email e senha são obrigatórios.",
    });
  });

  it("deve retornar erro 500 se SECRET_KEY não estiver definida", async () => {
    delete process.env.SECRET_KEY;
    const req = mockRequest({
      email: "test@example.com",
      password: "password",
    });
    const res = mockResponse();

    await authenticate(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Erro de configuração: SECRET_KEY não definida.",
    });
  });

  it("deve autenticar com sucesso e retornar token JWT", async () => {
    const mockUser = { uid: "123" };
    (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
      user: mockUser,
    });
    (jwt.sign as jest.Mock).mockReturnValue("fake-token");

    const req = mockRequest({
      email: "test@example.com",
      password: "password",
    });
    const res = mockResponse();

    await authenticate(req, res);

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      "test@example.com",
      "password"
    );
    expect(jwt.sign).toHaveBeenCalledWith({ uid: "123" }, "test-secret", {
      expiresIn: "24h",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      auth: true,
      token: "fake-token",
    });
  });

  it("deve lidar com credenciais inválidas", async () => {
    const error = new Error("Invalid credentials") as any;
    error.code = "auth/wrong-password";
    (signInWithEmailAndPassword as jest.Mock).mockRejectedValue(error);

    const req = mockRequest({ email: "test@example.com", password: "wrong" });
    const res = mockResponse();

    await authenticate(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      errorCode: "auth/wrong-password",
      errorMessage: "Invalid credentials",
    });
  });

  it("deve lidar com usuário não encontrado", async () => {
    const error = new Error("User not found") as any;
    error.code = "auth/user-not-found";
    (signInWithEmailAndPassword as jest.Mock).mockRejectedValue(error);

    const req = mockRequest({
      email: "nonexistent@example.com",
      password: "password",
    });
    const res = mockResponse();

    await authenticate(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      errorCode: "auth/user-not-found",
      errorMessage: "User not found",
    });
  });
});
