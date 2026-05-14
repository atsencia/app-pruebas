// hooks/useUploadQueue.js
// Hook que expone la cola y se suscribe a cambios del worker en tiempo real.
import { useState, useEffect, useCallback } from 'react';
import { encolar, obtenerEstadisticas, reintentarItem, limpiarCompletados } from '@/services/uploadQueue';
import { suscribir, forzarProcesar } from '@/services/queueWorker';

export function useUploadQueue() {
  const [stats, setStats] = useState({
    total: 0, pendientes: 0, subiendo: 0, completados: 0, errores: 0, items: [],
  });

  const refrescar = useCallback(async () => {
    const s = await obtenerEstadisticas();
    setStats(s);
  }, []);

  // Suscribirse a eventos del worker
  useEffect(() => {
    refrescar(); // carga inicial

    const unsub = suscribir(async (evento) => {
      // Cualquier evento del worker → refrescar estadísticas
      await refrescar();
    });

    return unsub;
  }, [refrescar]);

  const agregarALaCola = useCallback(async (formulario) => {
    const item = await encolar(formulario);
    await refrescar();
    forzarProcesar(); // intentar subir inmediatamente
    return item;
  }, [refrescar]);

  const reintentar = useCallback(async (id) => {
    await reintentarItem(id);
    await refrescar();
    forzarProcesar();
  }, [refrescar]);

  const limpiar = useCallback(async () => {
    await limpiarCompletados();
    await refrescar();
  }, [refrescar]);

  // Atajos nombrados para el QueueStatusBar
  const pendientes  = stats.items.filter(i => i.estado === 'pendiente');
  const subiendo    = stats.items.filter(i => i.estado === 'subiendo');
  const errores     = stats.items.filter(i => i.estado === 'error');
  const completados = stats.items.filter(i => i.estado === 'completado');
  const sinConexion = stats.subiendo === 0 && stats.pendientes > 0;

  return {
    ...stats,
    pendientes,
    subiendo,
    errores,
    completados,
    sinConexion,
    agregarALaCola,
    reintentar,
    limpiar,
    refrescar,
  };
}