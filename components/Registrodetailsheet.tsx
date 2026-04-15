import React, { useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { Registro } from "@/app/search";
// import { getApiUrl } from "@/lib/query-client"; // descomenta cuando uses fetch real

interface Props {
  visible: boolean;
  registro: Registro | null;
  onClose: () => void;
}

const TIPO_CONFIG = {
  inicio: { label: "Inicio", bg: "#EFF6FF", text: "#1D4ED8" },
  seguimiento: { label: "Seguimiento", bg: "#FFFBEB", text: "#92400E" },
  fin: { label: "Fin", bg: "#F0FDF4", text: "#166534" },
};

export default function RegistroDetailSheet({ visible, registro, onClose }: Props) {
  const [sending, setSending] = React.useState<"prop" | "inter" | null>(null);

  const handleEnviar = useCallback(
    async (firmante: "propietario" | "interventoria") => {
      if (!registro) return;

      const key = firmante === "propietario" ? "prop" : "inter";
      setSending(key);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        // ── Cuando tengas el backend, reemplaza el timeout por esto: ──
        // const res = await fetch(
        //   `${getApiUrl()}/api/registros/${registro.carpeta}/enviar-firma`,
        //   {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     credentials: "include",
        //     body: JSON.stringify({ firmante }),
        //   }
        // );
        // if (!res.ok) throw new Error("Error al enviar");

        await new Promise((r) => setTimeout(r, 1200)); // simula delay

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const correo =
          firmante === "propietario" ? registro.propCorreo : registro.interCorreo;
        Alert.alert(
          "Link enviado",
          `El link de firma fue enviado a:\n${correo}`,
          [{ text: "Ok", onPress: onClose }]
        );
      } catch (e: any) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Error", e.message || "No se pudo enviar el link");
      } finally {
        setSending(null);
      }
    },
    [registro, onClose]
  );

  if (!registro) return null;

  const tipo =
    TIPO_CONFIG[registro.tipoActa as keyof typeof TIPO_CONFIG] ?? {
      label: registro.tipoActa,
      bg: "#F3F4F6",
      text: "#374151",
    };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Close */}
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
          <Feather name="x" size={18} color="#6B7280" />
        </Pressable>

        {/* Badge + tipo */}
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: tipo.bg }]}>
            <Text style={[styles.badgeText, { color: tipo.text }]}>
              {tipo.label}
            </Text>
          </View>
        </View>

        {/* Nombre y doc */}
        <Text style={styles.nombre}>{registro.nombre}</Text>
        <Text style={styles.doc}>Doc. {registro.cedula}</Text>

        <View style={styles.divider} />

        {/* Campos */}
        <InfoRow icon="map-pin" label="Dirección" value={registro.direccion} />
        <InfoRow icon="file-text" label="Tipo acta" value={tipo.label} />
        <InfoRow
          icon="folder"
          label="Carpeta"
          value={registro.carpeta}
          mono
        />
        <InfoRow
          icon="mail"
          label="Correo prop."
          value={registro.propCorreo}
        />
        <InfoRow
          icon="mail"
          label="Correo inter."
          value={registro.interCorreo}
        />

        <View style={styles.divider} />

        {/* Botones */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.btnProp,
              pressed && { opacity: 0.85 },
              sending === "prop" && { opacity: 0.7 },
            ]}
            onPress={() => handleEnviar("propietario")}
            disabled={sending !== null}
          >
            {sending === "prop" ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="send" size={16} color="#fff" />
            )}
            <Text style={styles.btnPropText}>
              {sending === "prop" ? "Enviando..." : "Enviar link al dueño del predio"}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.btnInter,
              pressed && { opacity: 0.85 },
              sending === "inter" && { opacity: 0.7 },
            ]}
            onPress={() => handleEnviar("interventoria")}
            disabled={sending !== null}
          >
            {sending === "inter" ? (
              <ActivityIndicator size="small" color="#1a3a6b" />
            ) : (
              <Feather name="send" size={16} color="#1a3a6b" />
            )}
            <Text style={styles.btnInterText}>
              {sending === "inter" ? "Enviando..." : "Enviar link a interventoría"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: any;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={rowStyles.row}>
      <Feather name={icon} size={13} color="#9CA3AF" style={rowStyles.icon} />
      <Text style={rowStyles.label}>{label}</Text>
      <Text
        style={[rowStyles.value, mono && rowStyles.mono]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 5,
  },
  icon: { marginTop: 2, width: 14 },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#9CA3AF",
    width: 80,
    paddingTop: 1,
  },
  value: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#111827",
    lineHeight: 18,
  },
  mono: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 20,
    padding: 4,
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  nombre: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    marginBottom: 2,
  },
  doc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    marginBottom: 4,
  },
  divider: {
    height: 0.5,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
  },
  btnProp: {
    backgroundColor: "#1a3a6b",
  },
  btnPropText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  btnInter: {
    backgroundColor: "#F3F4F6",
    borderWidth: 0.5,
    borderColor: "#D1D5DB",
  },
  btnInterText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#1a3a6b",
  },
});