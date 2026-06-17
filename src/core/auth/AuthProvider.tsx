// src/core/auth/AuthProvider.tsx
"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { apiGet } from "@/core/api/client";

interface AuthContextType {
  userWallet: string | null;
  isAuthorized: boolean;
  isLoading: boolean;
  selectedWalletName: string | null;
  login: (wallet: string, walletName: string) => void;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { disconnect } = useWallet();
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWalletName, setSelectedWalletName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedWallet = localStorage.getItem("selectedWallet");
      if (savedWallet) {
        setSelectedWalletName(savedWallet);
      }
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const data = await apiGet<{ authenticated: boolean; user?: { wallet: string } }>("/api/auth/me");
      if (data.authenticated && data.user?.wallet) {
        setIsAuthorized(true);
        setUserWallet(data.user.wallet);
      } else {
        setIsAuthorized(false);
        setUserWallet(null);
      }
    } catch {
      setIsAuthorized(false);
      setUserWallet(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const login = useCallback((wallet: string, walletName: string) => {
    setUserWallet(wallet);
    setIsAuthorized(true);
    setSelectedWalletName(walletName);
    localStorage.setItem("selectedWallet", walletName);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      await disconnect();
      setUserWallet(null);
      setIsAuthorized(false);
      setSelectedWalletName(null);
      localStorage.removeItem("selectedWallet");
    }
  }, [disconnect]);

  return (
    <AuthContext.Provider value={{
      userWallet,
      isAuthorized,
      isLoading,
      selectedWalletName,
      login,
      logout,
      refreshAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}