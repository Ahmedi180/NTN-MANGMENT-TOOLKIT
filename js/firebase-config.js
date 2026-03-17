import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCS91N2NnsKU307UJ_IpZPgATNYaNSZ6g",
  authDomain: "ntn-mangment.firebaseapp.com",
  projectId: "ntn-mangment",
  storageBucket: "ntn-mangment.firebasestorage.app",
  messagingSenderId: "674992946367",
  appId: "1:674992946367:web:b39c2122d5206fc1f49a0a",
  databaseURL: "https://ntn-mangment-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };
