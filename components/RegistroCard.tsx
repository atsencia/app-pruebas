import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { Registro } from "@/app/search";

interface Props {
  registro: Registro;
  onEnviarLink: () => void;
}

const TIPO_CONFIG = {
  inicio: { label: "Inicio", bg: "#EFF6FF", text: "#1D4ED8" },
  seguimiento: { label: "Seguimiento", bg: "#FFFBEB", text: "#92400E" },
  fin: { label: "Fin", bg: "#F0FDF4", text: "#166534" },
};

export default function RegistroCard({ registro, onEnviarLink }: Props) {
  const tipo = TIPO_CONFIG[registro.tipoActa as keyof typeof TIPO_CONFIG] ?? {
    label: registro.tipoActa,
    bg: "#F3F4F6",
    text: "#374151",
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.nombre} numberOfLines={1}>
          {registro.nombre}
        </Text>
        <View style={[styles.badge, { backgroundColor: tipo.bg }]}>
          <Text style={[styles.badgeText, { color: tipo.text }]}>
            {tipo.label}
          </Text>
        </View>
      </View>

      {/* Documento */}
      <View style={styles.row}>
        <Feather name="credit-card" size={12} color="#9CA3AF" />
        <Text style={styles.docText}>Doc. {registro.cedula}</Text>
      </View>

      {/* Dirección */}
      <View style={styles.row}>
        <Feather name="map-pin" size={12} color="#9CA3AF" />
        <Text style={styles.dirText} numberOfLines={2}>
          {registro.direccion}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.carpetaWrap}>
          <Feather name="folder" size={11} color="#9CA3AF" />
          <Text style={styles.carpetaText} numberOfLines={1}>
            {registro.carpeta}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.enviarBtn,
            pressed && { opacity: 0.8 },
          ]}
          onPress={onEnviarLink}
        >
          <Feather name="send" size={12} color="#fff" />
          <Text style={styles.enviarText}>Enviar link</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: "#E5E7EB",
    padding: 16,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  nombre: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#111827",
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  docText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
  },
  dirText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#374151",
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  carpetaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    marginRight: 8,
  },
  carpetaText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    flexShrink: 1,
  },
  enviarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1a3a6b",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  enviarText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});