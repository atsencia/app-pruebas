import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const C = Colors.light;

export default function SuccessScreen() {
  const insets = useSafeAreaInsets();
  const { numeroRegistro, nombre, fotosCount, videosCount } = useLocalSearchParams<{
    numeroRegistro: string;
    nombre: string;
    fotosCount: string;
    videosCount: string;
  }>();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 6,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const topPadding =
    Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPadding =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const handleNewForm = () => {
    router.replace("/form");
  };

  return (
    <View
      style={[
        styles.root,
        { paddingTop: topPadding, paddingBottom: bottomPadding },
      ]}
    >
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      <View style={styles.center}>
        <Animated.View
          style={[styles.successIcon, { transform: [{ scale: scaleAnim }] }]}
        >
          <View style={styles.iconRing}>
            <Feather name="check" size={42} color="#fff" />
          </View>
        </Animated.View>

        <Animated.View style={[styles.textBlock, { opacity: fadeAnim }]}>
          <Text style={styles.successLabel}>¡Registro Exitoso!</Text>
          <Text style={styles.nombreText}>
            {nombre || "Vecino"} ha sido registrado correctamente.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.registroCard, { opacity: fadeAnim }]}>
          <Text style={styles.registroLabel}>Número de Registro</Text>
          <Text style={styles.registroNumber}>{numeroRegistro}</Text>
          <View style={styles.registroMeta}>
            <Feather name="clock" size={12} color={C.textSecondary} />
            <Text style={styles.registroDate}>
              {new Date().toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>
          <View style={styles.registerDivider} />
          <View style={styles.mediaRow}>
            <View style={styles.mediaBadge}>
              <Feather name="camera" size={13} color={C.primary} />
              <Text style={styles.mediaBadgeText}>
                {fotosCount || "0"} foto{Number(fotosCount) !== 1 ? "s" : ""}
              </Text>
            </View>
            <View style={styles.mediaBadge}>
              <Feather name="video" size={13} color={C.primary} />
              <Text style={styles.mediaBadgeText}>
                {videosCount || "0"} video{Number(videosCount) !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
          <View style={styles.registerDivider} />
          <View style={styles.registroHint}>
            <Feather name="info" size={12} color={C.textSecondary} />
            <Text style={styles.registroHintText}>
              Guarde este número como comprobante del registro
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
          <Pressable
            style={({ pressed }) => [
              styles.newBtn,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleNewForm}
          >
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.newBtnText}>Nuevo Registro</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.primary,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  bgCircle1: {
    position: "absolute",
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "rgba(255,255,255,0.04)",
    top: -100,
    right: -100,
  },
  bgCircle2: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(39,174,96,0.15)",
    bottom: -50,
    left: -60,
  },
  center: {
    alignItems: "center",
    paddingHorizontal: 28,
    gap: 24,
    width: "100%",
  },
  successIcon: {
    marginBottom: 4,
  },
  iconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.accent,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  textBlock: {
    alignItems: "center",
    gap: 8,
  },
  successLabel: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  nombreText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    lineHeight: 22,
  },
  registroCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    alignItems: "center",
    gap: 8,
    shadowColor: "rgba(0,0,0,0.3)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
  registroLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  registroNumber: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: C.primary,
    letterSpacing: 1,
    marginTop: 4,
  },
  registroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  registroDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  registerDivider: {
    width: "100%",
    height: 1,
    backgroundColor: C.border,
    marginVertical: 8,
  },
  mediaRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  mediaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EFF3F8",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  mediaBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
  },
  registroHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingHorizontal: 8,
  },
  registroHintText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  actions: {
    width: "100%",
    gap: 12,
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  newBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
});
