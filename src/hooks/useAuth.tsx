import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface UserPermissions {
  modules?: Record<string, boolean>;
  actions?: {
    create?: boolean;
    edit?: boolean;
    delete?: boolean;
  };
}

interface UserProfile {
  id: string; // Added ID field
  nome: string;
  username?: string;
  role: 'superadmin' | 'admin' | 'assessor' | 'vereador' | 'consulta' | 'secretaria_parlamentar' | 'suporte_ti';
  email: string;
  cabinetId: string;
  photo_url?: string;
  biography?: string;
  ativo?: boolean;
  status?: 'online' | 'offline';
  requirePasswordChange?: boolean; // New field
  permissions?: UserPermissions; // Optional fine-grained permissions
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isOnline: boolean;
  isSuperAdmin: boolean;
  isCabinetOverridden: boolean;
  switchCabinet: (id: string | null) => void;
  hasModuleAccess: (moduleId: string) => boolean;
  canPerformAction: (action: 'create' | 'edit' | 'delete') => boolean;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true, 
  isOnline: true,
  isSuperAdmin: false,
  isCabinetOverridden: false,
  switchCabinet: () => {},
  hasModuleAccess: () => true,
  canPerformAction: () => true
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [overrideCabinetId, setOverrideCabinetId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('cabinetId');
  });
  const [domainCabinetId, setDomainCabinetId] = useState<string | null>(null);

  useEffect(() => {
    const resolveDomain = async () => {
      const hostname = window.location.hostname;
      // Skip for common dev/preview domains
      if (hostname.includes('.run.app') || hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        return;
      }

      try {
        // Try exact custom domain match
        const qCustom = query(collection(db, 'cabinets'), where('custom_domain', '==', hostname));
        const snapCustom = await getDocs(qCustom);
        if (!snapCustom.empty) {
          setDomainCabinetId(snapCustom.docs[0].id);
          return;
        }

        // Try subdomain match (assuming .gabinetedigital.app)
        if (hostname.endsWith('.gabinetedigital.app')) {
          const sub = hostname.split('.')[0];
          const qSub = query(collection(db, 'cabinets'), where('subdomain', '==', sub));
          const snapSub = await getDocs(qSub);
          if (!snapSub.empty) {
            setDomainCabinetId(snapSub.docs[0].id);
            return;
          }
        }
      } catch (err) {
        console.error("Domain resolution error:", err);
      }
    };
    resolveDomain();
  }, []);

  const isSuperAdmin = profile?.role === 'superadmin' || 
                      profile?.role === 'suporte_ti' ||
                      user?.email === 'cleciotecnologia@gmail.com' || 
                      user?.email === 'toutipetrolandia@gmail.com';

  const switchCabinet = (id: string | null) => {
    const url = new URL(window.location.protocol + '//' + window.location.host + window.location.pathname);
    if (id) {
      url.searchParams.set('cabinetId', id);
    } else {
      url.searchParams.delete('cabinetId');
    }
    window.location.href = url.toString();
  };

  const isCabinetOverridden = isSuperAdmin && !!overrideCabinetId;

  const activeProfile = profile ? {
    ...profile,
    id: user?.uid || profile.id, // Ensure ID is present
    cabinetId: isCabinetOverridden ? overrideCabinetId! : (domainCabinetId || profile.cabinetId)
  } : null;

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
            
            // Auto-correction for Lorena Gomes as requested
            const normalizedEmail = user.email?.toLowerCase().trim() || '';
            const isLorena = normalizedEmail === 'lorena.goamaral@gmail.com' || 
                             normalizedEmail === 'lorena.gomes@gmail.com';
            
            if (isLorena && (data.role === 'consulta' || data.nome === 'Usuário' || data.nome === 'Novo Usuário')) {
               console.log("Applying auto-correction for Lorena Gomes profile in useAuth...");
               const updates: any = {};
               if (data.role === 'consulta') updates.role = 'secretaria_parlamentar';
               if (data.nome === 'Usuário' || data.nome === 'Novo Usuário') updates.nome = 'Lorena Gomes';
               
               const updatedProfile = { ...data, id: user.uid, ...updates };
               setProfile(updatedProfile);
               updateDoc(docRef, updates).catch(err => console.error("Failed to update Lorena profile:", err));
            } else {
               setProfile({ ...data, id: user.uid });
            }
            
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
            const normalizedEmail = user.email?.toLowerCase().trim() || '';
            const q = query(collection(db, 'users'), where('email', '==', normalizedEmail));
            const querySnap = await getDocs(q);
            
            if (!querySnap.empty) {
              // Found a pre-created user! Migrate it to use the UID as ID
              const preCreatedDoc = querySnap.docs[0];
              const preCreatedData = preCreatedDoc.data();
              
              const migratedProfile = {
                ...preCreatedData,
                email: normalizedEmail, // Ensure normalized
                cabinetId: preCreatedData.cabinetId || 'default',
                status: 'online',
                last_seen: serverTimestamp(),
                updated_at: serverTimestamp(),
                migrated_from: preCreatedDoc.id // Track migration
              };

              await setDoc(docRef, migratedProfile);
              
              // Only delete if it's a different ID
              if (preCreatedDoc.id !== user.uid) {
                await deleteDoc(preCreatedDoc.ref);
              }
              
              setProfile(migratedProfile as any);
              
              const { logAction } = await import('../lib/audit');
              await logAction('Migração de Perfil', 'users', user.uid, {
                next: { mensagem: 'Perfil pré-criado vinculado ao UID do Firebase.' }
              });
            } else {
              // First time user? Let's check if we should create a profile
              const isSuper = normalizedEmail === 'cleciotecnologia@gmail.com';
              const isLorena = normalizedEmail === 'lorena.goamaral@gmail.com' || 
                               normalizedEmail === 'lorena.gomes@gmail.com';
              const isInitialAdmin = isSuper ||
                                     normalizedEmail === 'toutipetrolandia@gmail.com' || 
                                     isLorena;
              
              if (isInitialAdmin) {
                console.log("Initial Admin detected:", normalizedEmail);
              }

              const newProfile: UserProfile = {
                id: user.uid,
                nome: user.displayName || 'Novo Usuário',
                username: normalizedEmail.split('@')[0] || 'usuario',
                email: normalizedEmail,
                cabinetId: 'default',
                role: isSuper ? 'superadmin' : (isLorena ? 'secretaria_parlamentar' : (isInitialAdmin ? 'admin' : 'consulta')),
                ativo: isInitialAdmin ? true : false,
                status: 'online'
              };
              
              try {
                await setDoc(docRef, {
                  ...newProfile,
                  created_at: serverTimestamp(),
                  last_seen: serverTimestamp()
                });
                setProfile({ ...newProfile, id: user.uid });
              } catch (e) {
                console.error("Erro ao criar perfil inicial:", e);
                setProfile({ ...newProfile, id: user.uid });
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

  const hasModuleAccess = (moduleId: string): boolean => {
    if (!activeProfile) return false;
    
    const role = activeProfile.role as string;
    
    // Superadmins and Suporte TI can do anything
    if (role === 'superadmin' || role === 'suporte_ti') return true;
    
    // Vereadores can do anything
    if (role === 'vereador') return true;
    
    // Check custom permissions first if they are explicitly configured for this module
    if (activeProfile.permissions?.modules && activeProfile.permissions.modules[moduleId] !== undefined) {
      return activeProfile.permissions.modules[moduleId];
    }
    
    // Fallback to default role checks
    if (moduleId === 'saas') return false; // superadmin and support only (handled above)
    if (moduleId === 'history' || moduleId === 'config') {
      return role === 'admin' || role === 'vereador' || role === 'secretaria_parlamentar';
    }
    if (moduleId === 'indicacoes') {
      return role === 'vereador';
    }
    
    return true;
  };

  const canPerformAction = (action: 'create' | 'edit' | 'delete'): boolean => {
    if (!activeProfile) return false;
    
    const role = activeProfile.role as string;
    
    // Superadmins, Suporte TI and Vereadores have all permissions
    if (role === 'superadmin' || role === 'vereador' || role === 'suporte_ti') return true;
    
    // Check custom action permissions if explicitly defined
    if (activeProfile.permissions?.actions && activeProfile.permissions.actions[action] !== undefined) {
      return activeProfile.permissions.actions[action];
    }
    
    // Fallback to default role actions limits
    if (role === 'consulta') return false;
    
    if (action === 'delete') {
      return role === 'admin' || role === 'secretaria_parlamentar';
    }
    
    return true;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile: activeProfile, 
      loading, 
      isOnline, 
      isSuperAdmin,
      isCabinetOverridden,
      switchCabinet,
      hasModuleAccess,
      canPerformAction
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
