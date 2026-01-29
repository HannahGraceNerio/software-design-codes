// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBr5kQpIGltxwbZtju1r3mYWR2wJix2hd4",
  authDomain: "favored-guided-engraving.firebaseapp.com",
  projectId: "favored-guided-engraving",
  storageBucket: "favored-guided-engraving.firebasestorage.app",
  messagingSenderId: "14707657229",
  appId: "1:14707657229:web:ba43ba5e88ad21ebc5e344",
  measurementId: "G-KWVLH7SP8R"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Make available globally
window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDb = db;
window.firebaseStorage = storage;

console.log("Firebase initialized successfully");