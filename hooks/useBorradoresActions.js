// hooks/useBorradoresActions.js
import { useCallback } from 'react';
import { useBorradores } from '@/store/zustand-state';
import { useUploadQueue } from '@/hooks/useUploadQueue';

export function useBorradoresActions() {
  const { guardarBorrador, eliminarBorrador, marcarEnCola, marcarSubido, borradores } = useBorradores();
  const { agregarALaCola } = useUploadQueue();

  // ── Guardar el form actual como borrador ─────────────────
  const guardar = useCallback((nombre, formData, templateId = null, idExistente = null) => {
    return guardarBorrador(nombre, formData, templateId, idExistente);
  }, [guardarBorrador]);

  // ── Enviar un borrador a la cola de subida ───────────────
  const enviarALaCola = useCallback(async (borrador) => {
    // Transformar el formData del borrador al formato que espera agregarALaCola
    // (mismo shape que handleSubmit en form.tsx)
    const formulario = {
      nombre:       (borrador.formData.nombre ?? '').trim(),
      apellido:     (borrador.formData.cedula  ?? '').trim(),
      direccion:    borrador.formData.direccion ?? '',
      georef:       { latitud: borrador.formData.latitud, longitud: borrador.formData.longitud },
      fotos:        borrador.formData.fotos        ?? [],
      fotosFachada: borrador.formData.fotosFachada ?? [],
      videos:       (borrador.formData.videos ?? []).map(v => ({ uri: v.uri })),
      extra:        borrador.formData,
      // registro_uuid: `borrador_${borrador.id}_${Date.now()}`,
    };

    marcarEnCola(borrador.id);

    try {
      await agregarALaCola(formulario);

      // Escuchar cuándo se completa es complejo desde aquí,
      // así que marcamos subido optimistamente — el worker
      // lo maneja igual que cualquier otro ítem de la cola
      marcarSubido(borrador.id);
    } catch (e) {
      // Si falla al encolar, revertir a borrador
      guardarBorrador(borrador.nombre, borrador.formData, borrador.templateId, borrador.id);
      throw e;
    }
  }, [agregarALaCola, marcarEnCola, marcarSubido, guardarBorrador]);

  // ── Enviar TODOS los borradores pendientes de una vez ────
  const enviarTodos = useCallback(async () => {
    const pendientes = borradores.filter(b => b.estado === 'borrador');
    for (const b of pendientes) {
      await enviarALaCola(b);
    }
  }, [borradores, enviarALaCola]);

  return {
    guardar,
    enviarALaCola,
    enviarTodos,
    borradores,
    pendientes:  borradores.filter(b => b.estado === 'borrador'),
    enCola:      borradores.filter(b => b.estado === 'en_cola'),
    subidos:     borradores.filter(b => b.estado === 'subido'),
    totalActivos: borradores.filter(b => b.estado !== 'subido').length,
  };
}