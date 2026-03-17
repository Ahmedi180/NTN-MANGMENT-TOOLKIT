import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCS91N2NnsKU307UJ_IpZPgATNYaNSZ6g",
  authDomain: "ntn-mangment.firebaseapp.com",
  projectId: "ntn-mangment",
  storageBucket: "ntn-mangment.firebasestorage.app",
  messagingSenderId: "674992946367",
  appId: "1:674992946367:web:b39c2122d5206fc1f49a0a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
