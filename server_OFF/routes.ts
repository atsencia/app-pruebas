import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import session from "express-session";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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
  tipoEdificacion: string;
  numeroNiveles: number | null;
  anioConstruccion: number | null;
  estaOcupada: boolean;
  fisurasCerradas: boolean;
  fisurasCerradasDesc: string;
  fisurasAbiertas: boolean;
  fisurasAbiertasDesc: string;
  grietas: boolean;
  grietasDesc: string;
  acabadosPisos: string;
  estadoFachada: string;
  verticalidad: boolean | null;
  verticalidadNotas: string;
  planTopografico: boolean;
  observacionesProfesional: string;
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

const upload = multer({ storage: multer.memoryStorage() });

async function startFtpServer(uploadsDir: string) {
  try {
    const FtpSrv = (await import("ftp-srv")).default;

    const host = process.env.REPLIT_DEV_DOMAIN || "0.0.0.0";
    const ftpServer = new FtpSrv({
      url: "ftp://0.0.0.0:2121",
      anonymous: true,
      pasv_url: host,
      pasv_min: 30000,
      pasv_max: 30010,
    });

    ftpServer.on("login", (_data: any, resolve: any) => {
      resolve({ root: uploadsDir, cwd: "/" });
    });

    await ftpServer.listen();
    console.log(`FTP server running on port 2121 → root: ${uploadsDir}`);
  } catch (err: any) {
    console.warn("FTP server could not start:", err.message);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  await startFtpServer(UPLOADS_DIR);

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

  app.post(
    "/api/registros/upload",
    requireAuth,
    upload.any(),
    async (req: Request, res: Response) => {
      try {
        let datos: any = {};
        try {
          datos = JSON.parse(req.body?.datos || "{}");
        } catch {
          datos = req.body || {};
        }

        const { nombre, cedula, direccion } = datos;
        if (!nombre || !cedula || !direccion) {
          return res
            .status(400)
            .json({ message: "Nombre, cédula y dirección son requeridos" });
        }

        const numeroRegistro = generateRegistroNumber();
        const registroDir = path.join(UPLOADS_DIR, numeroRegistro);
        fs.mkdirSync(registroDir, { recursive: true });

        const files = (req.files as Express.Multer.File[]) || [];
        let fotosCount = 0;
        let videosCount = 0;

        for (const file of files) {
          const ext = path.extname(file.originalname || file.fieldname) || "";
          let filename = file.originalname || file.fieldname;

          if (file.fieldname.startsWith("foto")) {
            fotosCount++;
            filename = `foto_${fotosCount}${ext || ".jpg"}`;
          } else if (file.fieldname.startsWith("video")) {
            videosCount++;
            filename = `video_${videosCount}${ext || ".mp4"}`;
          } else if (file.fieldname === "firma") {
            filename = "firma.svg";
          }

          fs.writeFileSync(path.join(registroDir, filename), file.buffer);
        }

        if (datos.firma && typeof datos.firma === "string" && datos.firma !== "captured") {
          fs.writeFileSync(path.join(registroDir, "firma.svg"), datos.firma);
        }

        const registro: Registro = {
          id: Date.now().toString(),
          numeroRegistro,
          nombre,
          cedula,
          direccion,
          latitud: datos.latitud ?? null,
          longitud: datos.longitud ?? null,
          tipoEdificacion: datos.tipoEdificacion ?? "",
          numeroNiveles: datos.numeroNiveles ? Number(datos.numeroNiveles) : null,
          anioConstruccion: datos.anioConstruccion ? Number(datos.anioConstruccion) : null,
          estaOcupada: datos.estaOcupada === true || datos.estaOcupada === "true",
          fisurasCerradas: datos.fisurasCerradas === true || datos.fisurasCerradas === "true",
          fisurasCerradasDesc: datos.fisurasCerradasDesc ?? "",
          fisurasAbiertas: datos.fisurasAbiertas === true || datos.fisurasAbiertas === "true",
          fisurasAbiertasDesc: datos.fisurasAbiertasDesc ?? "",
          grietas: datos.grietas === true || datos.grietas === "true",
          grietasDesc: datos.grietasDesc ?? "",
          acabadosPisos: datos.acabadosPisos ?? "",
          estadoFachada: datos.estadoFachada ?? "",
          verticalidad: datos.verticalidad !== undefined && datos.verticalidad !== null
            ? datos.verticalidad === true || datos.verticalidad === "true"
            : null,
          verticalidadNotas: datos.verticalidadNotas ?? "",
          planTopografico: datos.planTopografico === true || datos.planTopografico === "true",
          observacionesProfesional: datos.observacionesProfesional ?? "",
          fotosCount: datos.fotosCount ? Number(datos.fotosCount) : fotosCount,
          videosCount: datos.videosCount ? Number(datos.videosCount) : videosCount,
          firma: datos.firma ? "captured" : null,
          creadoEn: new Date().toISOString(),
          creadoPor: req.session.userId!,
        };

        const jsonPath = path.join(registroDir, "datos.json");
        fs.writeFileSync(jsonPath, JSON.stringify(registro, null, 2), "utf-8");

        registros.push(registro);

        console.log(
          `[UPLOAD] ${numeroRegistro} → ${registroDir} (${files.length} archivos)`
        );

        res.status(201).json({ success: true, numeroRegistro, registro });
      } catch (err: any) {
        console.error("Upload error:", err);
        res.status(500).json({ message: "Error al procesar el registro" });
      }
    }
  );

  app.post("/api/registros", requireAuth, (req: Request, res: Response) => {
    const {
      nombre, cedula, direccion, latitud, longitud,
      tipoEdificacion, numeroNiveles, anioConstruccion, estaOcupada,
      fisurasCerradas, fisurasCerradasDesc, fisurasAbiertas, fisurasAbiertasDesc,
      grietas, grietasDesc, acabadosPisos, estadoFachada,
      verticalidad, verticalidadNotas, planTopografico, observacionesProfesional,
      fotosCount, videosCount, firma,
    } = req.body;

    if (!nombre || !cedula || !direccion) {
      return res.status(400).json({ message: "Nombre, cédula y dirección son requeridos" });
    }

    const numeroRegistro = generateRegistroNumber();
    const registroDir = path.join(UPLOADS_DIR, numeroRegistro);
    fs.mkdirSync(registroDir, { recursive: true });

    const registro: Registro = {
      id: Date.now().toString(),
      numeroRegistro, nombre, cedula, direccion,
      latitud: latitud ?? null, longitud: longitud ?? null,
      tipoEdificacion: tipoEdificacion ?? "",
      numeroNiveles: numeroNiveles ? Number(numeroNiveles) : null,
      anioConstruccion: anioConstruccion ? Number(anioConstruccion) : null,
      estaOcupada: !!estaOcupada,
      fisurasCerradas: !!fisurasCerradas, fisurasCerradasDesc: fisurasCerradasDesc ?? "",
      fisurasAbiertas: !!fisurasAbiertas, fisurasAbiertasDesc: fisurasAbiertasDesc ?? "",
      grietas: !!grietas, grietasDesc: grietasDesc ?? "",
      acabadosPisos: acabadosPisos ?? "", estadoFachada: estadoFachada ?? "",
      verticalidad: verticalidad !== undefined && verticalidad !== null ? !!verticalidad : null,
      verticalidadNotas: verticalidadNotas ?? "",
      planTopografico: !!planTopografico,
      observacionesProfesional: observacionesProfesional ?? "",
      fotosCount: fotosCount ?? 0, videosCount: videosCount ?? 0,
      firma: firma ?? null,
      creadoEn: new Date().toISOString(), creadoPor: req.session.userId!,
    };

    fs.writeFileSync(path.join(registroDir, "datos.json"), JSON.stringify(registro, null, 2));
    registros.push(registro);
    res.status(201).json({ success: true, numeroRegistro, registro });
  });

  app.get("/api/registros", requireAuth, (_req: Request, res: Response) => {
    res.json(registros);
  });

  const httpServer = createServer(app);
  return httpServer;
}
