export interface FTPFormulario {
  nombre: string;
  apellido: string;
  direccion: string;
  georef?: { latitud?: number | null; longitud?: number | null };
  fotos?: Array<{ uri: string; nombre?: string; descripcion?: string }>;
  fotosFachada?: Array<{ uri: string; nombre?: string; descripcion?: string }>;
  videos?: Array<{ uri: string; nombre?: string; descripcion?: string }>;
  registro_uuid: string | undefined;
  revisado_por: string | null;
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
