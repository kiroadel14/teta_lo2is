import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDT-OoWWZ8MviKJ1EtqAUXWNkEbzPzfmDg",
  authDomain: "teta-lo2is.firebaseapp.com",
  projectId: "teta-lo2is",
  storageBucket: "teta-lo2is.firebasestorage.app",
  messagingSenderId: "972736004764",
  appId: "1:972736004764:web:d03410318575ac3e2be359"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app); // السطر ده اللي كان ناقص

export default app;