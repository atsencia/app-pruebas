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
  token?: string;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Al arrancar, recupera el token guardado
  useEffect(() => {
    const loadToken = async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) {
          setUser({ username: "usuario", token });
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadToken();
  }, []);

  const login = async (documento: string, password: string, data?: any) => {
    if (data) {
      const token = data.token || data.accessToken || data.access_token;
      if (token) {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
      setUser({
        username: data.username || data.nombre || data.documento || documento,
        token,
      });
      return;
    }

    const response = await fetch("http://187.33.154.112:3000/logueo/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documento, password }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || "Credenciales incorrectas");
    }

    const result = await response.json();
    const token = result.token || result.accessToken || result.access_token;

    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }

    setUser({
      username: result.username || result.nombre || result.documento || documento,
      token,
    });
  };

  const loginLocal = (username: string) => {
    setUser({ username });
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
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