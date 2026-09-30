import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDa4JUdowCgB-FuoQAlxxcMHmVbTN92plw',
  authDomain: 'tripmate-d1bcf.firebaseapp.com',
  projectId: 'tripmate-d1bcf',
  storageBucket: 'tripmate-d1bcf.firebasestorage.app',
  messagingSenderId: '161772981274',
  appId: '1:161772981274:web:5fea275afb86622e7ed5a3',
};

const app = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
