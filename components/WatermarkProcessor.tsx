import React, { useRef } from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import ViewShot from "react-native-view-shot";

interface Props {
  photoUri: string;
  companyName: string;
  logoUri?: number; // require('../assets/logo.png')
  onCapture: (uri: string) => void;
}

 
export default function WatermarkProcessor({ photoUri, companyName, logoUri, onCapture }: Props) {
  const shotRef = useRef<ViewShot>(null);
  const layoutDone = useRef(false);   // ← agrega
  const imageDone  = useRef(false);   // ← agrega

  const now = new Date();
  const fechaHora = now.toLocaleDateString("es-CO", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }) + "  " + now.toLocaleTimeString("es-CO", {
    hour: "2-digit", minute: "2-digit",
  });

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
  setTimeout(intentarCaptura, 400); // ← espera que renderice
  };

  return (
    <ViewShot ref={shotRef} style={styles.offscreen} options={{ format: "jpg", quality: 0.85 }}>
      <View onLayout={handleLayout} style={styles.container}>
        <Image
          source={{ uri: photoUri }}
          style={styles.photo}
          resizeMode="cover"
          onLoad={handleImageLoad}   // ← agrega esto
        />
        <View style={styles.watermark}>
          {logoUri && (
            <Image source={logoUri} style={styles.logo} resizeMode="contain" />
          )}
          <View style={styles.textBlock}>
            <Text style={styles.company}>{companyName}</Text>
            <Text style={styles.fecha}>{fechaHora}</Text>
          </View>
        </View>
      </View>
    </ViewShot>
  );
}
const styles = StyleSheet.create({
  // Fuera de pantalla pero con dimensiones reales
  offscreen: {
    position: "absolute",
    top: -9999,
    left: -9999,
    width: 1080,
    height: 1440,
  },
  container: { width: 1080, height: 1440 },
  photo: { width: "100%", height: "100%" },

  // Posición: esquina superior derecha
      watermark: {
        position: "absolute",
        bottom: 40,        // ← abajo queda mejor visualmente
        left: 24,
        right: 24,         // ← ocupa todo el ancho
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        backgroundColor: "rgba(0,0,0,0.55)",
        borderRadius: 16,
        paddingHorizontal: 24,
        paddingVertical: 20,
      },
      logo: { width: 72, height: 72, borderRadius: 8 },   // ← más grande
      textBlock: { gap: 4 },
      company: {
        fontSize: 36,      // ← de 18 a 36
        fontWeight: "700",
        color: "#fff",
        letterSpacing: 0.3,
      },
      fecha: {
        fontSize: 26,      // ← de 13 a 26
        color: "rgba(255,255,255,0.85)",
      },
});