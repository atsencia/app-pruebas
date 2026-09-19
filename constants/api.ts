// Única fuente de verdad para la URL del backend. Todo el código que
// necesite hablarle al backend debe importar API_BASE de acá — nunca
// hardcodear la URL de nuevo, porque entonces cambiar de servidor
// (ej: al URL oficial de producción) exige tocar archivo por archivo
// en vez de una sola variable de entorno.
//
// Se puede pisar con EXPO_PUBLIC_API_BASE (ver .env.local) para apuntar
// a un backend local durante desarrollo. Sin esa variable, cae al
// backend real por defecto.
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE || "https://vecindad.sencia.com.co:9000";
