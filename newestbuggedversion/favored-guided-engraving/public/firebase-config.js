// Firebase configuration WITHOUT storage
const firebaseConfig = {
  apiKey: "AIzaSyBr5kQpIGltxwbZtju1r3mYWR2wJix2hd4",
  authDomain: "favored-guided-engraving.firebaseapp.com",
  projectId: "favored-guided-engraving",
  messagingSenderId: "14707657229",
  appId: "1:14707657229:web:ba43ba5e88ad21ebc5e344",
  measurementId: "G-KWVLH7SP8R"
  // NOTE: Removed storageBucket line!
};

// Initialize Firebase WITHOUT storage
try {
  const app = firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  
  // Make available globally
  window.firebaseApp = app;
  window.firebaseAuth = auth;
  window.firebaseDb = db;
  
  console.log("✅ Firebase initialized (No storage)");
} catch (error) {
  console.error("❌ Firebase init error:", error);
}