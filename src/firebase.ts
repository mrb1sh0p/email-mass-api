import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_APIKEY,
  authDomain: "massemail-aad98.firebaseapp.com",
  projectId: "massemail-aad98",
  storageBucket: "massemail-aad98.firebasestorage.app",
  messagingSenderId: "595485932915",
  appId: "1:595485932915:web:8b8bd163b303104b31d906",
  measurementId: "G-K9NYM1NWZS"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
