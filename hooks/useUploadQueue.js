// hooks/useUploadQueue.js
// Hook que expone la cola y se suscribe a cambios del worker en tiempo real.
import { useState, useEffect, useCallback } from 'react';
import { encolar, obtenerEstadisticas, reintentarItem, limpiarCompletados } from '@/services/uploadQueue';
import { suscribir, forzarProcesar } from '@/services/queueWorker';
import { asegurarCarpetaRespaldo, resguardarArchivos, liberarOriginales, borrarRespaldo } from '@/services/respaldoLocal';
import { useAuth } from '@/contexts/AuthContext'; // ← falta este import


export function useUploadQueue() {
  const { user } = useAuth(); // ← falta esta línea

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
    // Los archivos se copian a una carpeta persistente (no a la caché, que
    // Android puede vaciar) y ahí viven hasta que el backend confirme la carga.
    // Si aún no hay carpeta elegida en el teléfono, se ofrece elegirla (una vez por sesión).
    await asegurarCarpetaRespaldo();
    const { formulario: conRespaldo, originales } = await resguardarArchivos(formulario);

    let item;
    try {
      item = await encolar(conRespaldo, user?.token);  // ← pasar token
    } catch (e) {
      await borrarRespaldo(conRespaldo);   // no se encoló: no dejar la copia huérfana
      throw e;
    }

    if (item) await liberarOriginales(originales);
    else      await borrarRespaldo(conRespaldo);  // ya estaba en la cola: la copia sobra

    await refrescar();
    forzarProcesar(); // intentar subir inmediatamente
    return item;
  }, [refrescar, user?.token]); 

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
  const verificando = stats.items.filter(i => i.estado === 'verificando');
  const errores     = stats.items.filter(i => i.estado === 'error');
  const completados = stats.items.filter(i => i.estado === 'completado');
  const sinConexion = stats.subiendo === 0 && stats.pendientes > 0;

  return {
    ...stats,
    pendientes,
    subiendo,
    verificando,
    errores,
    completados,
    sinConexion,
    agregarALaCola,
    reintentar,
    limpiar,
    refrescar,
  };
}