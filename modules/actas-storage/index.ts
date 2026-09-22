import { requireNativeModule } from 'expo-modules-core';

export interface CopiaEnArbol {
  uri: string;     // archivo creado dentro de la carpeta elegida (content://)
  dirUri: string;  // subcarpeta del acta (para borrarla al confirmar la carga)
  bytes: number;
}

interface ActasStorageNativo {
  tienePermiso(arbolUri: string): Promise<boolean>;
  nombreCarpeta(arbolUri: string): Promise<string | null>;
  copiarAArbol(origen: string, arbolUri: string, subcarpeta: string, nombre: string, mime: string): Promise<CopiaEnArbol>;
  copiarAArchivo(origen: string, destino: string): Promise<void>;
  eliminar(uri: string): Promise<boolean>;
  existe(uri: string): Promise<boolean>;
  tamano(uri: string): Promise<number>;
}

// null si el módulo nativo no está (build anterior a este cambio, Expo Go, web,
// iOS): quien lo use debe caer al respaldo privado en vez de romperse.
let modulo: ActasStorageNativo | null = null;
try {
  modulo = requireNativeModule<ActasStorageNativo>('ActasStorage');
} catch {
  modulo = null;
}

export default modulo;
