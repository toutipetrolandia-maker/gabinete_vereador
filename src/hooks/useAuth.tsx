import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc, getDocFromServer } from 'firebase/firestore';
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
        console.log("Testing Firestore connection...");
        const docRef = doc(db, '_connection_test', 'ping');
        await getDocFromServer(docRef);
        console.log("Firestore connection: OK");
        setIsOnline(true);
      } catch (error: any) {
        console.warn("Firestore connection check failed:", error.code, error.message);
        // "unavailable" or "offline" in message indicates real network issues with Firestore
        if (error?.message?.includes('offline') || error?.code === 'unavailable' || error?.code === 'deadline-exceeded') {
          setIsOnline(false);
        } else {
          // If it's a permission error (e.g. 403) or document not found, we are online
          setIsOnline(navigator.onLine);
        }
      }
    };
    testConnection();

    // Re-check every 30 seconds if we are offline
    const interval = setInterval(() => {
      if (!isOnline && navigator.onLine) {
        testConnection();
      }
    }, 30000);

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
            // Check if there is a pre-created profile with the same email
            const { collection, query, where, getDocs, deleteDoc } = await import('firebase/firestore');
            const q = query(collection(db, 'users'), where('email', '==', user.email));
            const querySnap = await getDocs(q);
            
            if (!querySnap.empty) {
              // Found a pre-created user! Migrate it to use the UID as ID
              const preCreatedDoc = querySnap.docs[0];
              const preCreatedData = preCreatedDoc.data();
              
              await setDoc(docRef, {
                ...preCreatedData,
                status: 'online',
                last_seen: serverTimestamp(),
                updated_at: serverTimestamp(),
                migrated_from: preCreatedDoc.id // Track migration
              });
              
              // Only delete if it's a different ID
              if (preCreatedDoc.id !== user.uid) {
                await deleteDoc(preCreatedDoc.ref);
              }
              
              setProfile(preCreatedData as UserProfile);
              
              const { logAction } = await import('../lib/audit');
              await logAction('Migração de Perfil', 'users', user.uid, {
                next: { mensagem: 'Perfil pré-criado vinculado ao UID do Firebase.' }
              });
            } else {
              // First time user? Let's check if we should create a profile
              const isInitialAdmin = user.email === 'toutipetrolandia@gmail.com' || user.email === 'cleciotecnologia@gmail.com' || user.email === 'lorena.goamaral@gmail.com';
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
      clearInterval(interval);
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
