import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import Colors from "@/constants/colors";

const C = Colors.light;

interface Props {
  latitud: number | null;
  longitud: number | null;
  onLocationChange: (lat: number, lng: number) => void;
}

export default function MapPicker({ latitud, longitud, onLocationChange }: Props) {

 
const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied">(
  latitud !== null && longitud !== null ? "granted" : "idle"
);
const requestLocation = async () => {
  setLocationStatus("loading");
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocationStatus("denied");
      return;
    }

    // Intenta ubicación actual
    let loc = await Location.getLastKnownPositionAsync({
      maxAge: 60000, // acepta ubicación de hasta 1 minuto atrás
      requiredAccuracy: 100,
    });

    // Si no hay última ubicación, pide una nueva
    if (!loc) {
      loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    }

    onLocationChange(loc.coords.latitude, loc.coords.longitude);
    setLocationStatus("granted");
  } catch {
    setLocationStatus("denied");
  }
};

  return (
    <View style={styles.container}>

      {(locationStatus === "idle" || locationStatus === "denied") && (
        <View style={styles.geoPrompt}>
          <View style={styles.geoIconBg}>
            <MaterialIcons name="location-on" size={28} color={C.primary} />
          </View>
          <Text style={styles.geoPromptTitle}>Ubicación no capturada</Text>
          {locationStatus === "denied" && (
            <Text style={styles.geoPromptSub}>
              Permiso denegado. Habilítelo en configuración.
            </Text>
          )}
          <Pressable
            style={({ pressed }) => [styles.geoBtn, pressed && { opacity: 0.8 }]}
            onPress={requestLocation}
          >
            <Feather name="crosshair" size={14} color="#fff" />
            <Text style={styles.geoBtnText}>Obtener Ubicación Actual</Text>
          </Pressable>
        </View>
      )}

      {locationStatus === "loading" && (
        <View style={styles.geoLoading}>
          <ActivityIndicator color={C.primary} />
          <Text style={styles.geoLoadingText}>Obteniendo ubicación...</Text>
        </View>
      )}

      {locationStatus === "granted" && latitud !== null && longitud !== null && (
        <>
          {/* Preview estático con link a Google Maps */}
          <View style={styles.mapPlaceholder}>
            <MaterialIcons name="location-on" size={32} color={C.primary} />
            <Text style={styles.mapPlaceholderText}>Ubicación capturada</Text>
            <Pressable
              style={styles.retryBtn}
              onPress={requestLocation}
            >
              <Feather name="refresh-cw" size={12} color={C.primary} />
              <Text style={styles.retryText}>Recapturar</Text>
            </Pressable>
          </View>

          <View style={styles.coordsBox}>
            <View style={styles.coordItem}>
              <Text style={styles.coordLabel}>Latitud</Text>
              <Text style={styles.coordValue}>{latitud ? latitud.toFixed(6) : "-"}</Text>
            </View>
            <View style={styles.coordDivider} />
            <View style={styles.coordItem}>
              <Text style={styles.coordLabel}>Longitud</Text>
              <Text style={styles.coordValue}>{longitud.toFixed(6)}</Text>
            </View>
          </View>
        </>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  geoPrompt: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  geoIconBg: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: "#EFF3F8",
    justifyContent: "center", alignItems: "center", marginBottom: 2,
  },
  geoPromptTitle: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text,
  },
  geoPromptSub: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: C.error, textAlign: "center",
  },
  geoBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.primary, paddingHorizontal: 20,
    paddingVertical: 11, borderRadius: 12, marginTop: 4,
  },
  geoBtnText: {
    fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff",
  },
  geoLoading: {
    alignItems: "center", gap: 10, paddingVertical: 20,
  },
  geoLoadingText: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: C.textSecondary,
  },
  mapPlaceholder: {
    height: 140, borderRadius: 14,
    backgroundColor: "#EFF3F8",
    alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1.5, borderColor: C.border,
  },
  mapPlaceholderText: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.primary,
  },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: C.primary,
  },
  retryText: {
    fontSize: 12, fontFamily: "Inter_500Medium", color: C.primary,
  },
  coordsBox: {
    flexDirection: "row", backgroundColor: "#EFF3F8",
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
    alignItems: "center",
  },
  coordItem: { flex: 1, alignItems: "center", gap: 2 },
  coordLabel: {
    fontSize: 10, fontFamily: "Inter_600SemiBold",
    color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5,
  },
  coordValue: {
    fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.primary,
  },
  coordDivider: { width: 1, height: 32, backgroundColor: C.border },
});