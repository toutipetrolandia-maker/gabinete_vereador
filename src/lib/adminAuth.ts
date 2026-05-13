import { initializeApp, deleteApp, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Creates a new user with a password using a secondary Firebase app instance.
 * This prevents the current session (admin) from being logged out.
 */
export async function createNewUserWithPassword(email: string, pass: string): Promise<string> {
  const secondaryAppName = `secondary-app-${Date.now()}`;
  let secondaryApp: FirebaseApp;
  
  try {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    
    // Create user in Auth
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    const uid = userCredential.user.uid;
    
    // Immediately sign out from the secondary app to clean up
    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);
    
    return uid;
  } catch (error: any) {
    // Attempt to cleanup if something fails
    try {
      const app = getApp(secondaryAppName);
      if (app) {
        await deleteApp(app);
      }
    } catch (e) {}
    
    throw error;
  }
}
