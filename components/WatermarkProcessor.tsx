import React, { useEffect, useRef, useState } from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import ViewShot from "react-native-view-shot";

interface Props {
  photoUri: string;
  logoUri?: number; // require('../media/logo.png') — logo de Consorcio C.C.A.
  onCapture: (uri: string) => void;
}

const LOGO_ALTO = 88;

// El lienzo toma la proporción real de la foto (vertical u horizontal) con su
// lado largo en LADO_LARGO px. Así la foto no se recorta y la marca queda
// siempre en la misma esquina de la foto, sin importar cómo se sostuvo el
// celular. Una foto vertical 3:4 da 1080×1440, igual que antes.
const LADO_LARGO = 1440;
const TAM_POR_DEFECTO = { ancho: 1080, alto: 1440 };

const calcularTamano = (w: number, h: number) => {
  if (!w || !h) return TAM_POR_DEFECTO;
  const escala = LADO_LARGO / Math.max(w, h);
  return { ancho: Math.round(w * escala), alto: Math.round(h * escala) };
};

// dd/mm/aaaa  hh:mm:ss (24 h). A mano en vez de toLocale*String para que el
// texto sea idéntico en cualquier dispositivo o idioma.
const dos = (n: number) => String(n).padStart(2, "0");
const formatearMomento = (d: Date) =>
  `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}  ` +
  `${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;

export default function WatermarkProcessor({ photoUri, logoUri, onCapture }: Props) {
  const shotRef = useRef<ViewShot>(null);
  const layoutDone = useRef(false);
  const imageDone  = useRef(false);

  // Tamaño real de la foto (con su orientación) antes de armar el lienzo.
  const [tam, setTam] = useState<{ ancho: number; alto: number } | null>(null);
  useEffect(() => {
    let vivo = true;
    Image.getSize(
      photoUri,
      (w, h) => { if (vivo) setTam(calcularTamano(w, h)); },
      () => { if (vivo) setTam(TAM_POR_DEFECTO); },
    );
    return () => { vivo = false; };
  }, [photoUri]);

  // Momento en que la foto se carga al formulario (no cuando se tomó).
  const fechaHora = useRef(formatearMomento(new Date())).current;

  // El logo tiene fondo transparente: se dimensiona por su proporción real.
  const logoSrc = logoUri ? Image.resolveAssetSource(logoUri) : null;
  const logoAncho = logoSrc?.width && logoSrc?.height
    ? Math.round(LOGO_ALTO * (logoSrc.width / logoSrc.height))
    : LOGO_ALTO;

  // ✅ Captura solo cuando AMBOS están listos
  const intentarCaptura = async () => {
    if (!layoutDone.current || !imageDone.current) return;
    try {
      const uri = await shotRef.current?.capture?.();
      if (uri) onCapture(uri);
    } catch (e) {
      console.warn("WatermarkProcessor error:", e);
      onCapture(photoUri);
    }
  };

  const handleLayout = () => {
    layoutDone.current = true;
  };

  const handleImageLoad = () => {
    imageDone.current = true;
    setTimeout(intentarCaptura, 400); // espera que renderice
  };

  if (!tam) return null;

  return (
    <ViewShot
      ref={shotRef}
      style={[styles.offscreen, { width: tam.ancho, height: tam.alto }]}
      options={{ format: "jpg", quality: 0.85 }}
    >
      <View onLayout={handleLayout} style={{ width: tam.ancho, height: tam.alto }}>
        <Image
          source={{ uri: photoUri }}
          style={styles.photo}
          resizeMode="cover"
          onLoad={handleImageLoad}
        />

        {/* Marca en la esquina inferior derecha: logo sobre tarjeta blanca (el
            logo es azul/verde oscuro y no se lee sobre fotos oscuras) y la
            fecha/hora en una píldora oscura. */}
        <View style={styles.watermark}>
          {logoUri && (
            <View style={styles.logoCard}>
              <Image
                source={logoUri}
                style={{ width: logoAncho, height: LOGO_ALTO }}
                resizeMode="contain"
              />
            </View>
          )}
          <View style={styles.fechaPill}>
            <Text style={styles.fecha}>{fechaHora}</Text>
          </View>
        </View>
      </View>
    </ViewShot>
  );
}

const styles = StyleSheet.create({
  // Fuera de pantalla pero con dimensiones reales (el tamaño lo pone el render)
  offscreen: {
    position: "absolute",
    top: -9999,
    left: -9999,
  },
  photo: { width: "100%", height: "100%" },

  watermark: {
    position: "absolute",
    right: 32,
    bottom: 32,
    alignItems: "flex-end",
    gap: 10,
  },
  logoCard: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  fechaPill: {
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  fecha: {
    fontSize: 30,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: 0.3,
  },
});
