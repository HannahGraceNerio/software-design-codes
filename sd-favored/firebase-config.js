// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

// REPLACE THIS WITH YOUR ACTUAL CONFIG FROM FIREBASE CONSOLE
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


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export for use in app.js

export { auth, db, storage };

