// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  // Use the environment variable, NOT the hardcoded string
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY, 
  
  // These non-secret values can stay hardcoded or moved to .env (up to you)
  authDomain: "project1-dc433.firebaseapp.com",
  projectId: "project1-dc433",
  storageBucket: "project1-dc433.firebasestorage.app",
  messagingSenderId: "53502164114",
  appId: "1:53502164114:web:b747c256c53a040582fa4b",
  measurementId: "G-ZHVPR0C1Y8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };