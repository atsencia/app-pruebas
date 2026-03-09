export interface FTPFormulario {
  nombre: string;
  apellido: string;
  direccion: string;
  georef?: { latitud?: number | null; longitud?: number | null };
  fotos?: Array<{ uri: string; nombre?: string }>;
  videos?: Array<{ uri: string; nombre?: string }>;
  // campos arbitrarios que se mezclarán en datos.json
  extra?: Record<string, any>;
}

export interface FTPResultado {
  success: boolean;
  id: string;
  mensaje: string;
}

export function subirFormularioFTP(
  formulario: FTPFormulario,
  onProgreso?: (porcentaje: number, mensaje: string) => void,
): Promise<FTPResultado>;
