import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import { apiRequest, getQueryFn } from "@/lib/query-client";

interface User {
  username: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginLocal: (username: string) => void; // set user directly without network
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // credenciales integradas para use local
  const LOCAL_CREDENTIALS = { username: "admin", password: "registro2024" };

  useEffect(() => {
    // Si no quieres contacto con servidor, puedes omitir esta comprobación
    const fetchMe = getQueryFn<User | null>({ on401: "returnNull" });
    fetchMe({ queryKey: ["/api/auth/me"] } as any)
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    // primero intentar correspondencia local
    if (
      username === LOCAL_CREDENTIALS.username &&
      password === LOCAL_CREDENTIALS.password
    ) {
      setUser({ username });
      return;
    }

    // en caso de que quieras seguir usando el servidor remoto
    const res = await apiRequest("POST", "/api/auth/login", {
      username,
      password,
    });
    const data = await res.json();
    setUser(data.user);
  };

  const loginLocal = (username: string) => {
    setUser({ username });
  };

  const logout = async () => {
    await apiRequest("POST", "/api/auth/logout");
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
