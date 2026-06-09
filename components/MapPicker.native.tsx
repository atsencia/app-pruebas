import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, DeviceEventEmitter } from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import NativeOsmMap from "./MapPicker_OFF/NativeOsmMap";

const C = Colors.light;

interface Props {
  latitud: number | null;
  longitud: number | null;
  onLocationChange: (lat: number, lng: number) => void;
}

export default function MapPicker({ latitud, longitud, onLocationChange }: Props) {
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      "onOsmLocationSelected",
      ({ lat, lng }: { lat: number; lng: number }) => {
        onLocationChange(lat, lng);
      }
    );
    return () => sub.remove();
  }, [onLocationChange]);

  return (
    <View style={styles.container}>
      <NativeOsmMap
        style={styles.map}
        initialLocation={
          latitud !== null && longitud !== null
            ? { lat: latitud, lng: longitud }
            : undefined
        }
      />
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
  container: { gap: 12 },
  map: { width: "100%", height: 260, borderRadius: 14, overflow: "hidden" },
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