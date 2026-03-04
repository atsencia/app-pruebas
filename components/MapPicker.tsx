import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.light;

interface Props {
  latitud: number | null;
  longitud: number | null;
  onLocationChange: (lat: number, lng: number) => void;
}

export default function MapPicker({ latitud, longitud }: Props) {
  return (
    <View style={styles.container}>
      <Feather name="map" size={24} color={C.textSecondary} />
      <Text style={styles.text}>
        Georeferenciación disponible en la app móvil
      </Text>
      {latitud !== null && longitud !== null && (
        <View style={styles.coordsBox}>
          <Text style={styles.coordText}>
            {latitud.toFixed(6)}, {longitud.toFixed(6)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 20,
  },
  text: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
  },
  coordsBox: {
    backgroundColor: "#EFF3F8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  coordText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
  },
});
