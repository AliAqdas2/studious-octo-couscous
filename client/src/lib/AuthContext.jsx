import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { base44, setAccessToken } from "@/api/base44Client";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const applySession = useCallback((nextUser) => {
    setUser(nextUser);
    setIsAuthenticated(!!nextUser);
    setAuthError(null);
  }, []);

  const bootstrap = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      await base44.auth.refresh();
      const currentUser = await base44.auth.me();
      applySession(currentUser);
    } catch {
      setAccessToken(null);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
    }
  }, [applySession]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (email, password) => {
    const result = await base44.auth.login({ email, password });
    const currentUser = result.user ?? (await base44.auth.me());
    applySession(currentUser);
    return currentUser;
  };

  const logout = async () => {
    try {
      await base44.auth.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        appPublicSettings: null,
        login,
        logout,
        navigateToLogin,
        checkAppState: bootstrap,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
