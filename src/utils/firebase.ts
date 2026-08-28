import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase 콘솔에서 복사한 본인의 웹 앱 설정값
const firebaseConfig = {
  apiKey: "AIzaSyD9mHc_bSt0w3rcYg-cQ25JOiCOKrqyxRc",
  authDomain: "attendance-system-8d42f.firebaseapp.com",
  projectId: "attendance-system-8d42f",
  storageBucket: "attendance-system-8d42f.firebasestorage.app",
  messagingSenderId: "841089806482",
  appId: "1:841089806482:web:281fab7238df4359bcf64b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
