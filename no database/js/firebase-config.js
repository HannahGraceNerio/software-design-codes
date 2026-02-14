import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  FacebookAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  query, 
  where 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBr5kQpIGltxwbZtju1r3mYWR2wJix2hd4",
  authDomain: "favored-guided-engraving.firebaseapp.com",
  databaseURL: "https://favored-guided-engraving-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "favored-guided-engraving",
  storageBucket: "favored-guided-engraving.firebasestorage.app",
  messagingSenderId: "14707657229",
  appId: "1:14707657229:web:ba43ba5e88ad21ebc5e344",
  measurementId: "G-KWVLH7SP8R"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ✅ Make Firebase available globally
window.auth = auth;
window.db = db;

window.GoogleAuthProvider = GoogleAuthProvider;
window.FacebookAuthProvider = FacebookAuthProvider;
window.signInWithPopup = signInWithPopup;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signOut = signOut;
window.onAuthStateChanged = onAuthStateChanged;

window.collection = collection;
window.doc = doc;
window.getDoc = getDoc;
window.getDocs = getDocs;
window.setDoc = setDoc;
window.updateDoc = updateDoc;
window.deleteDoc = deleteDoc;
window.addDoc = addDoc;
window.query = query;
window.where = where;
