import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";

interface User {
  username: string;
  nombre?: string;
  token?: string;
  isAdmin?: boolean;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (documento: string, password: string, data?: any) => Promise<void>;
  loginLocal: (username: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "auth_token";
const USER_KEY  = "auth_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Al arrancar, recupera sesión guardada
  useEffect(() => {
    const loadSession = async () => {
      try {
        const [token, userJson] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        if (token && userJson) {
          const savedUser = JSON.parse(userJson);
          setUser({ ...savedUser, token });
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const login = async (documento: string, password: string, data?: any) => {
    if (data) {
      const token   = data.token || data.accessToken || data.access_token;
      const nombre  = data.usuario?.nombre  || data.nombre  || documento;
      const isAdmin = data.usuario?.is_admin === 1 || data.is_admin === 1;

      const newUser: User = {
        username: data.usuario?.documento || documento,
        nombre,
        token,
        isAdmin,
      };

      if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(newUser));
      setUser(newUser);
      return;
    }

    // Fallback fetch directo
    const response = await fetch("https://187.33.154.112.sslip.io/backend/logueo/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documento, password }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || "Credenciales incorrectas");
    }

    const result = await response.json();
    const token   = result.token || result.accessToken || result.access_token;
    const nombre  = result.usuario?.nombre  || result.nombre  || documento;
    const isAdmin = result.usuario?.is_admin === 1;

    const newUser: User = {
      username: result.usuario?.documento || documento,
      nombre,
      token,
      isAdmin,
    };

    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(newUser));
    setUser(newUser);
  };

  const loginLocal = (username: string) => {
    setUser({ username });
  };

  const logout = async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, isLoading, login, loginLocal, logout }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}