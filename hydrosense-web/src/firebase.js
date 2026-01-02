// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// --- PASTE YOUR FIREBASE CONFIG HERE ---
// It should look like this (but with your actual keys):
const firebaseConfig = {
  apiKey: "AIzaSyB1pQjNrTVj-J0V19WVIt75VL-IqjF1dR8",
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