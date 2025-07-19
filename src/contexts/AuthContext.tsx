import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User } from '@/types';

interface AuthContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: 'judge' | 'spectator' | 'admin') => Promise<void>;
  adminLogin: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function login(email: string, password: string) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await loadUserData(result.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async function register(email: string, password: string, name: string, role: 'judge' | 'spectator' | 'admin') {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const userData: User = {
        id: result.user.uid,
        name,
        email,
        role
      };
      
      await setDoc(doc(db, 'users', result.user.uid), userData);
      setCurrentUser(userData);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async function logout() {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setFirebaseUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async function loadUserData(firebaseUser: FirebaseUser) {
    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (userDoc.exists()) {
        setCurrentUser(userDoc.data() as User);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadUserData(user);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function adminLogin(password: string) {
    // Hardcoded admin password: "admin2025ICTAS"
    if (password === "admin2025ICTAS") {
      const adminUser: User = {
        id: "admin",
        name: "System Administrator",
        email: "admin@ictas2025.com",
        role: "admin"
      };
      setCurrentUser(adminUser);
    } else {
      throw new Error("Invalid admin password");
    }
  }

  const value = {
    currentUser,
    firebaseUser,
    login,
    register,
    logout,
    adminLogin,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}