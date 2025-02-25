import dotenv from "dotenv"; 
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

// Configuração do Firebase usando variáveis de ambiente
const firebaseConfig = {
  apiKey: process.env.FIREBASE_APIKEY, // Chave da API
  authDomain: "massemail-aad98.firebaseapp.com", // Domínio de autenticação do Firebase
  databaseURL: "https://massemail-aad98-default-rtdb.firebaseio.com", // URL do banco de dados em tempo real
  projectId: "massemail-aad98", // ID do projeto Firebase
  storageBucket: "massemail-aad98.firebasestorage.app", // Armazenamento de arquivos
  messagingSenderId: "595485932915", // ID do remetente do Firebase Cloud Messaging
  appId: "1:595485932915:web:8b8bd163b303104b31d906", // ID do aplicativo
  measurementId: "G-K9NYM1NWZS", // ID de medição do Google Analytics (se aplicável)
};

// Inicializa o aplicativo Firebase com a configuração fornecida
const app = initializeApp(firebaseConfig);

// Exporta instâncias do Firestore e do Firebase Auth para uso em outros arquivos
export const db = getFirestore(app); // Instância do Firestore (banco de dados NoSQL)
export const auth = getAuth(app); // Instância do Firebase Authentication
