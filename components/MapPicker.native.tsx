import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Feather, MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import Colors from "@/constants/colors";

const C = Colors.light;

interface Props {
  latitud: number | null;
  longitud: number | null;
  onLocationChange: (lat: number, lng: number) => void;
}

export default function MapPicker({ latitud, longitud, onLocationChange }: Props) {
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [mapRegion, setMapRegion] = useState({
    latitude: 4.7110,
    longitude: -74.0721,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const requestLocation = async () => {
    setLocationStatus("loading");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationStatus("denied");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;
      onLocationChange(latitude, longitude);
      setMapRegion({ latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 });
      setLocationStatus("granted");
    } catch {
      setLocationStatus("denied");
    }
  };

  const handleMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    onLocationChange(latitude, longitude);
    setMapRegion((r) => ({ ...r, latitude, longitude }));
    if (locationStatus === "idle") setLocationStatus("granted");
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

      {(locationStatus === "granted" || latitud !== null) && (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            region={mapRegion}
            onPress={handleMapPress}
            showsUserLocation={locationStatus === "granted"}
          >
            {latitud !== null && longitud !== null && (
              <Marker
                coordinate={{ latitude: latitud, longitude: longitud }}
                title="Ubicación del vecino"
                pinColor={C.accent}
              />
            )}
          </MapView>
          <View style={styles.mapOverlayHint}>
            <Feather name="info" size={11} color="#fff" />
            <Text style={styles.mapHintText}>Toca el mapa para ajustar</Text>
          </View>
        </View>
      )}

      {latitud !== null && longitud !== null && (
        <View style={styles.coordsBox}>
          <View style={styles.coordItem}>
            <Text style={styles.coordLabel}>Latitud</Text>
            <Text style={styles.coordValue}>{latitud.toFixed(6)}</Text>
          </View>
          <View style={styles.coordDivider} />
          <View style={styles.coordItem}>
            <Text style={styles.coordLabel}>Longitud</Text>
            <Text style={styles.coordValue}>{longitud.toFixed(6)}</Text>
          </View>
        </View>
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
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#EFF3F8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  geoPromptTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  geoPromptSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.error,
    textAlign: "center",
  },
  geoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 4,
  },
  geoBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  geoLoading: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
  },
  geoLoadingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  mapContainer: {
    borderRadius: 14,
    overflow: "hidden",
    height: 200,
    position: "relative",
  },
  map: { flex: 1 },
  mapOverlayHint: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mapHintText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#fff",
  },
  coordsBox: {
    flexDirection: "row",
    backgroundColor: "#EFF3F8",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  coordItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  coordLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  coordValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
  },
  coordDivider: {
    width: 1,
    height: 32,
    backgroundColor: C.border,
  },
});
