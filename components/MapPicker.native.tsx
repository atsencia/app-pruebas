import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, DeviceEventEmitter,
  Modal, TouchableOpacity, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import NativeOsmMap from "./MapPicker_OFF/NativeOsmMap";
import { StatusBar } from "react-native"; // agregar al import


const C = Colors.light;

interface Props {
  latitud: number | null;
  longitud: number | null;
  onLocationChange: (lat: number, lng: number) => void;
}

export default function MapPicker({ latitud, longitud, onLocationChange }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      "onOsmLocationSelected",
      ({ lat, lng }: { lat: number; lng: number }) => {
        setPendingCoords({ lat, lng });
      }
    );
    return () => sub.remove();
  }, []);

  const handleConfirm = () => {
    if (pendingCoords) {
      onLocationChange(pendingCoords.lat, pendingCoords.lng);
    }
    setModalVisible(false);
  };

  const handleOpen = () => {
    setPendingCoords(
      latitud !== null && longitud !== null
        ? { lat: latitud, lng: longitud }
        : null
    );
    setModalVisible(true);
  };

  const displayCoords = pendingCoords ?? (
    latitud !== null && longitud !== null ? { lat: latitud, lng: longitud } : null
  );

  return (
    <View style={styles.container}>

      {/* Botón trigger */}
      <TouchableOpacity style={styles.triggerButton} onPress={handleOpen}>
        <Feather name="map-pin" size={16} color={C.primary} />
        <Text style={styles.triggerText}>
          {latitud !== null && longitud !== null
            ? "Cambiar ubicación"
            : "Seleccionar en mapa"}
        </Text>
        <Feather name="chevron-right" size={16} color={C.textSecondary} />
      </TouchableOpacity>

      {/* Coordenadas actuales (cuando ya hay una seleccionada) */}
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

      {/* Modal con el mapa */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"   // iOS: sheet desde abajo
        statusBarTranslucent={false} 
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>

          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.headerBtn}>
              <Feather name="x" size={20} color={C.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Seleccionar ubicación</Text>
            <TouchableOpacity
              onPress={handleConfirm}
              style={[styles.headerBtn, styles.confirmBtn, !displayCoords && styles.confirmBtnDisabled]}
              disabled={!displayCoords}
            >
              <Text style={[styles.confirmText, !displayCoords && styles.confirmTextDisabled]}>
                Confirmar
              </Text>
            </TouchableOpacity>
          </View>

          {/* Hint */}
          <View style={styles.hintBar}>
            <Feather name="info" size={13} color={C.textSecondary} />
            <Text style={styles.hintText}>Toca el mapa para colocar el marcador</Text>
          </View>

          {/* Mapa nativo — ocupa todo el espacio restante */}
          <NativeOsmMap
            style={styles.fullMap}
            initialLocation={
              displayCoords
                ? { lat: displayCoords.lat, lng: displayCoords.lng }
                : undefined
            }
          />

          {/* Preview de coordenadas dentro del modal */}
          {displayCoords && (
            <View style={styles.floatingCoords}>
              <Feather name="map-pin" size={13} color={C.primary} />
              <Text style={styles.floatingText}>
                {displayCoords.lat.toFixed(6)}, {displayCoords.lng.toFixed(6)}
              </Text>
            </View>
          )}

        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },

  /* Trigger */
  triggerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#EFF3F8",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  triggerText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: C.text,
  },

  /* Coords inline */
  coordsBox: {
    flexDirection: "row",
    backgroundColor: "#EFF3F8",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  coordItem: { flex: 1, alignItems: "center", gap: 2 },
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
  coordDivider: { width: 1, height: 32, backgroundColor: C.border },

  /* Modal */
 modalContainer: {
  flex: 1,
  backgroundColor: "#fff",
  paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
},
modalHeader: {
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 16,
  paddingVertical: 12,
  paddingTop: Platform.OS === "ios" ? 16 : 12,  // extra en iOS si falla SafeArea
  borderBottomWidth: 1,
  borderBottomColor: "#E8ECF0",
  backgroundColor: "#fff",
  zIndex: 10,  // asegura que quede encima del mapa
},
  modalTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  headerBtn: {
    padding: 6,
    minWidth: 70,
    alignItems: "center",
  },
  confirmBtn: {
    backgroundColor: C.primary + "18",
    borderRadius: 8,
  },
  confirmBtnDisabled: {
    backgroundColor: "transparent",
  },
  confirmText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
  },
  confirmTextDisabled: {
    color: C.textSecondary,
  },

  /* Hint bar */
  hintBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F8F9FB",
    borderBottomWidth: 1,
    borderBottomColor: "#E8ECF0",
  },
  hintText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },

  /* Mapa fullscreen dentro del modal */
  fullMap: {
    flex: 1,
    width: "100%",
  },

  /* Coordenadas flotantes sobre el mapa */
  floatingCoords: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: C.text,
  },
});