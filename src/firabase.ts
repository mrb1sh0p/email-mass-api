import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_APIKEY,
  authDomain: "massemail-b751e.firebaseapp.com",
  projectId: "massemail-b751e",
  storageBucket: "massemail-b751e.firebasestorage.app",
  messagingSenderId: "293773295683",
  appId: "1:293773295683:web:557fd3f51c11ee75f754f6",
  measurementId: "G-NSSN54BC9C",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
