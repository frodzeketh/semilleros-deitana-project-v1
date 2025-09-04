// src/firebase.js
import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: "AIzaSyAVJTPQDUn9AQAwADyXM14jO5U5na5H0gY",
  authDomain: "login-deitana.firebaseapp.com",
  projectId: "login-deitana",
  storageBucket: "login-deitana.firebasestorage.app",
  messagingSenderId: "862040519775",
  appId: "1:862040519775:web:e712873f63df9cf3e797ea",
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const storage = getStorage(app)
