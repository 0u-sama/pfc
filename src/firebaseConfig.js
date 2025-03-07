// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDoLf2ZzMYiGFZiuYA50mWr_xFrXlyuw9o",
  authDomain: "anti-poaching-a00de.firebaseapp.com",
  projectId: "anti-poaching-a00de",
  storageBucket: "anti-poaching-a00de.firebasestorage.app",
  messagingSenderId: "61475017383",
  appId: "1:61475017383:web:0bccefd0f3f052d8e10182",
  measurementId: "G-CGBDFXDZWL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export default app
