import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env['FIREBASE_PROJECT_ID'] as string,
      clientEmail: process.env['FIREBASE_CLIENT_EMAIL'] as string,
      privateKey: (process.env['FIREBASE_PRIVATE_KEY'] as string)?.replace(/\\n/g, '\n'),
    }),
  });
}

export const firebaseAuth = getAuth();
