import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface UserProfile {
  nome: string;
  role: 'admin' | 'assessor' | 'vereador' | 'consulta';
  email: string;
  ativo?: boolean;
  status?: 'online' | 'offline';
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isOnline: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true, isOnline: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const testConnection = async () => {
      try {
        await getDoc(doc(db, '_connection_test', 'ping'));
      } catch (error: any) {
        if (error?.message?.includes('offline')) {
          console.error("Firebase is offline. Check configuration.");
          setIsOnline(false);
        }
      }
    };
    testConnection();

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile & { primeiro_acesso_concluido?: boolean };
            setProfile(data);
            
            // Check for First Access
            if (!data.primeiro_acesso_concluido) {
              const { logAction } = await import('../lib/audit');
              await logAction('Primeiro Acesso', 'users', user.uid, { 
                next: { 
                  mensagem: 'Usuário realizou o primeiro acesso ao sistema.',
                  timestamp: new Date().toISOString()
                } 
              });
              await updateDoc(docRef, { primeiro_acesso_concluido: true });
            }

            // Update online status
            await updateDoc(docRef, {
              status: 'online',
              last_seen: serverTimestamp()
            }).catch(() => {}); // Ignore if rules block

            // Log session start
            const { logAction } = await import('../lib/audit');
            await logAction('Início de Sessão', 'sistema', user.uid, {
              next: { login_metodo: user.providerData[0]?.providerId || 'google' }
            });
          } else {
            // First time user? Let's check if we should create a profile
            const isInitialAdmin = user.email === 'toutipetrolandia@gmail.com' || user.email === 'cleciotecnologia@gmail.com';
            const newProfile: UserProfile = {
              nome: user.displayName || 'Novo Usuário',
              email: user.email || '',
              role: isInitialAdmin ? 'admin' : 'consulta',
              ativo: isInitialAdmin ? true : false,
              status: 'online'
            };
            
            try {
              await setDoc(docRef, {
                ...newProfile,
                created_at: serverTimestamp(),
                last_seen: serverTimestamp()
              });
              setProfile(newProfile);
            } catch (e) {
              console.error("Erro ao criar perfil inicial:", e);
              setProfile(newProfile);
            }
          }
        } else {
          // If we have a user ID from previous state, we could mark offline
          // But on signout, user is gone. We'd usually do this via session, 
          // or just assume if no auth, they are offline.
          setProfile(null);
        }
      } catch (error) {
        console.error("Auth error:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubAuth();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isOnline }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
