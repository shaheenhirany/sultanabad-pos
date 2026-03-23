import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  projectId: "canteen-sultanabad",
  appId: "1:830730117248:web:11f747d1118263a56cc665",
  // Use default Firebase Storage bucket for this project
  storageBucket: "canteen-sultanabad.appspot.com",
  apiKey: "AIzaSyA78_5X0CMk4r-cBwe17AeHvkhBg32u5Cw",
  authDomain: "canteen-sultanabad.firebaseapp.com",
  messagingSenderId: "830730117248",
  measurementId: "G-Q9QWSM7H89"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
