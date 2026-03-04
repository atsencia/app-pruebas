import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import session from "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const CREDENTIALS = {
  username: "admin",
  password: "registro2024",
};

interface Registro {
  id: string;
  numeroRegistro: string;
  nombre: string;
  cedula: string;
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  fotosCount: number;
  videosCount: number;
  firma: string | null;
  creadoEn: string;
  creadoPor: string;
}

const registros: Registro[] = [];
let registroCounter = 1;

function generateRegistroNumber(): string {
  const year = new Date().getFullYear();
  const seq = String(registroCounter++).padStart(5, "0");
  return `REG-${year}-${seq}`;
}

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "No autenticado" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "registro-vecinal-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.post("/api/auth/login", (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (
      username === CREDENTIALS.username &&
      password === CREDENTIALS.password
    ) {
      req.session.userId = username;
      res.json({ success: true, user: { username } });
    } else {
      res.status(401).json({ message: "Usuario o contraseña incorrectos" });
    }
  });

  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (req.session.userId) {
      res.json({ username: req.session.userId });
    } else {
      res.status(401).json({ message: "No autenticado" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.post("/api/registros", requireAuth, (req: Request, res: Response) => {
    const { nombre, cedula, direccion, latitud, longitud, fotosCount, videosCount, firma } = req.body;

    if (!nombre || !cedula || !direccion) {
      return res
        .status(400)
        .json({ message: "Nombre, cédula y dirección son requeridos" });
    }

    const numeroRegistro = generateRegistroNumber();
    const registro: Registro = {
      id: Date.now().toString(),
      numeroRegistro,
      nombre,
      cedula,
      direccion,
      latitud: latitud ?? null,
      longitud: longitud ?? null,
      fotosCount: fotosCount ?? 0,
      videosCount: videosCount ?? 0,
      firma: firma ?? null,
      creadoEn: new Date().toISOString(),
      creadoPor: req.session.userId!,
    };

    registros.push(registro);
    res.status(201).json({ success: true, numeroRegistro, registro });
  });

  app.get("/api/registros", requireAuth, (_req: Request, res: Response) => {
    res.json(registros);
  });

  const httpServer = createServer(app);
  return httpServer;
}
