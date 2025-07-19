import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDkqha2lfDvtuFhDhTR84SzauPtOlQRnbE",
  authDomain: "presentscore-5068b.firebaseapp.com",
  projectId: "presentscore-5068b",
  storageBucket: "presentscore-5068b.firebasestorage.app",
  messagingSenderId: "54064814647",
  appId: "1:54064814647:web:b6a89104282f466c627db2",
  measurementId: "G-QG21FNLV1V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

export default app;