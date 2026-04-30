import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface UserProfile {
  nome: string;
  role: 'admin' | 'atendente' | 'vereador' | 'consulta';
  email: string;
  ativo?: boolean;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDoc(doc(db, '_connection_test', 'ping'));
      } catch (error: any) {
        if (error?.message?.includes('offline')) {
          console.error("Firebase is offline. Check configuration.");
        }
      }
    };
    testConnection();

    return onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // First time user? Let's check if we should create a profile
            // For this app, we'll create a default profile
            const isInitialAdmin = user.email === 'toutipetrolandia@gmail.com';
            const newProfile: UserProfile = {
              nome: user.displayName || 'Novo Usuário',
              email: user.email || '',
              role: isInitialAdmin ? 'admin' : 'consulta',
              ativo: isInitialAdmin ? true : false
            };
            
            try {
              // Note: This might fail if security rules are strict, 
              // but we'll try to set it up so the user can at least see the app.
              await setDoc(docRef, {
                ...newProfile,
                created_at: new Date().toISOString()
              });
              setProfile(newProfile);
            } catch (e) {
              console.error("Erro ao criar perfil inicial:", e);
              // Fallback to minimal profile if setDoc fails (rules)
              setProfile(newProfile);
            }
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Auth error:", error);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
