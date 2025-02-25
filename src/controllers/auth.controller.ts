// Importa o módulo dotenv para carregar variáveis de ambiente
import dotenv from "dotenv";
// Importa os tipos Request e Response do Express para tipagem dos parâmetros da rota
import { Request, Response } from "express";
// Importa a biblioteca jwt para gerar tokens de autenticação
import jwt from "jsonwebtoken";
// Importa a função de autenticação do Firebase que permite logar com email e senha
import { signInWithEmailAndPassword } from "firebase/auth";
// Importa as configurações de autenticação e banco de dados do Firebase
import { auth, db } from "../firebase";
// Importa funções do Firestore para manipulação de documentos
import { doc, getDoc } from "firebase/firestore";
// Configura as variáveis de ambiente a partir do arquivo .env
dotenv.config();

// Define a interface para os dados de autenticação esperados no corpo da requisição
interface AuthProps {
  email: string;
  password: string;
}

// Função de autenticação assíncrona que recebe a requisição e a resposta
export const authenticate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  // Extrai email e senha do corpo da requisição, utilizando a interface AuthProps
  const { email, password } = req.body as AuthProps;

  // Validação dos dados de entrada: verifica se email e senha foram fornecidos
  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios." });
  }

  // Recupera a chave secreta do ambiente para assinar o token JWT
  const secretKey = process.env.SECRET_KEY;
  if (!secretKey) {
    return res
      .status(500)
      .json({ error: "Erro de configuração: SECRET_KEY não definida." });
  }

  try {
    // Tenta autenticar o usuário utilizando o Firebase com email e senha
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Obtém uma referência para o documento do usuário no Firestore usando o UID do Firebase
    const userRef = doc(db, "users", userCredential.user.uid);
    // Recupera os dados atuais do usuário a partir do documento
    const currentUser = (await getDoc(userRef)).data();

    // Cria um token JWT que inclui os dados do usuário e seu ID, com validade de 9 horas
    const token = jwt.sign(
      {
        user: {
          ...currentUser,
          id: userCredential.user.uid,
        },
      },
      secretKey,
      {
        expiresIn: "9h",
      }
    );

    // Retorna a resposta com status 200, indicando que a autenticação foi bem-sucedida, junto com o token
    return res.status(200).json({
      auth: true,
      token,
    });
  } catch (error: any) {
    // Inicializa o status de erro como 500 (erro interno do servidor)
    let status = 500;
    // Se o erro estiver relacionado a credenciais incorretas, ajusta o status para 401 (não autorizado)
    if (
      error.code === "auth/wrong-password" ||
      error.code === "auth/user-not-found"
    ) {
      status = 401;
    }

    // Retorna a resposta de erro com o código e a mensagem apropriados
    return res.status(status).json({
      errorCode: error.code || "UNKNOWN_ERROR",
      errorMessage: error.message || "Ocorreu um erro durante a autenticação.",
    });
  }
};
