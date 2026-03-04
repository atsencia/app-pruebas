import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import SignaturePad from "@/components/SignaturePad";
import MapPicker from "@/components/MapPicker";
import PhotoPickerSection from "@/components/PhotoPickerSection";
import VideoPickerSection from "@/components/VideoPickerSection";
import Colors from "@/constants/colors";

const C = Colors.light;

interface VideoItem {
  uri: string;
  thumbnail: string | null;
  duration: number | null;
  filename: string;
}

interface FormData {
  nombre: string;
  cedula: string;
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  fotos: string[];
  videos: VideoItem[];
  firma: string | null;
}

interface FieldErrors {
  nombre?: string;
  cedula?: string;
  direccion?: string;
}

export default function FormScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const [form, setForm] = useState<FormData>({
    nombre: "",
    cedula: "",
    direccion: "",
    latitud: null,
    longitud: null,
    fotos: [],
    videos: [],
    firma: null,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const topPadding =
    Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPadding =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const validate = (): boolean => {
    const newErrors: FieldErrors = {};
    if (!form.nombre.trim()) newErrors.nombre = "El nombre es requerido";
    if (!form.cedula.trim()) newErrors.cedula = "La cédula es requerida";
    else if (!/^\d{6,12}$/.test(form.cedula.trim()))
      newErrors.cedula = "La cédula debe tener entre 6 y 12 dígitos";
    if (!form.direccion.trim())
      newErrors.direccion = "La dirección es requerida";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/registros", {
        nombre: form.nombre.trim(),
        cedula: form.cedula.trim(),
        direccion: form.direccion.trim(),
        latitud: form.latitud,
        longitud: form.longitud,
        fotosCount: form.fotos.length,
        videosCount: form.videos.length,
        firma: form.firma ? "captured" : null,
      });
      const data = await res.json();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: "/success",
        params: {
          numeroRegistro: data.numeroRegistro,
          nombre: form.nombre.trim(),
          fotosCount: String(form.fotos.length),
          videosCount: String(form.videos.length),
        },
      });
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", e.message || "No se pudo enviar el registro");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <View style={[styles.root, { backgroundColor: C.background }]}>
      <View
        style={[
          styles.topBar,
          { paddingTop: topPadding + 8, backgroundColor: C.primary },
        ]}
      >
        <View>
          <Text style={styles.topBarTitle}>Nuevo Registro</Text>
          <Text style={styles.topBarSub}>Operador: {user?.username}</Text>
        </View>
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutBtn,
            pressed && { opacity: 0.6 },
          ]}
          hitSlop={8}
        >
          <Feather name="log-out" size={18} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPadding + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Section icon="user" title="Datos del Vecino">
          <Field label="Nombre completo" error={errors.nombre}>
            <TextInput
              style={[styles.input, errors.nombre && styles.inputError]}
              placeholder="Ej. Juan García López"
              placeholderTextColor={C.textSecondary}
              value={form.nombre}
              onChangeText={(v) => {
                setForm((f) => ({ ...f, nombre: v }));
                if (errors.nombre)
                  setErrors((e) => ({ ...e, nombre: undefined }));
              }}
              returnKeyType="next"
            />
          </Field>

          <Field label="Cédula de identidad" error={errors.cedula}>
            <TextInput
              style={[styles.input, errors.cedula && styles.inputError]}
              placeholder="Ej. 12345678"
              placeholderTextColor={C.textSecondary}
              value={form.cedula}
              onChangeText={(v) => {
                setForm((f) => ({ ...f, cedula: v.replace(/\D/g, "") }));
                if (errors.cedula)
                  setErrors((e) => ({ ...e, cedula: undefined }));
              }}
              keyboardType="numeric"
              returnKeyType="next"
              maxLength={12}
            />
          </Field>

          <Field label="Dirección" error={errors.direccion}>
            <TextInput
              style={[
                styles.input,
                styles.inputMultiline,
                errors.direccion && styles.inputError,
              ]}
              placeholder="Calle, número, barrio, ciudad..."
              placeholderTextColor={C.textSecondary}
              value={form.direccion}
              onChangeText={(v) => {
                setForm((f) => ({ ...f, direccion: v }));
                if (errors.direccion)
                  setErrors((e) => ({ ...e, direccion: undefined }));
              }}
              multiline
              numberOfLines={3}
              returnKeyType="next"
            />
          </Field>
        </Section>

        <Section icon="map-pin" title="Georeferenciación">
          <MapPicker
            latitud={form.latitud}
            longitud={form.longitud}
            onLocationChange={(lat, lng) =>
              setForm((f) => ({ ...f, latitud: lat, longitud: lng }))
            }
          />
        </Section>

        <Section icon="camera" title="Fotografías">
          <PhotoPickerSection
            photos={form.fotos}
            onPhotosChange={(fotos) => setForm((f) => ({ ...f, fotos }))}
          />
        </Section>

        <Section icon="video" title="Videos">
          <VideoPickerSection
            videos={form.videos}
            onVideosChange={(videos) => setForm((f) => ({ ...f, videos }))}
          />
        </Section>

        <Section icon="edit-2" title="Firma del Vecino">
          <SignaturePad
            onSignatureChange={(sig) =>
              setForm((f) => ({ ...f, firma: sig }))
            }
          />
          {form.firma && (
            <View style={styles.sigConfirm}>
              <Feather name="check-circle" size={13} color={C.accent} />
              <Text style={styles.sigConfirmText}>Firma capturada</Text>
            </View>
          )}
        </Section>

        <View style={styles.summary}>
          <SummaryItem
            icon="user"
            label="Nombre"
            value={form.nombre.trim() || "—"}
            filled={!!form.nombre.trim()}
          />
          <SummaryItem
            icon="credit-card"
            label="Cédula"
            value={form.cedula.trim() || "—"}
            filled={!!form.cedula.trim()}
          />
          <SummaryItem
            icon="map-pin"
            label="Ubicación"
            value={form.latitud !== null ? "Capturada" : "Sin capturar"}
            filled={form.latitud !== null}
          />
          <SummaryItem
            icon="camera"
            label="Fotos"
            value={`${form.fotos.length} adjuntas`}
            filled={form.fotos.length > 0}
          />
          <SummaryItem
            icon="video"
            label="Videos"
            value={`${form.videos.length} adjuntos`}
            filled={form.videos.length > 0}
          />
          <SummaryItem
            icon="edit-2"
            label="Firma"
            value={form.firma ? "Capturada" : "Sin capturar"}
            filled={!!form.firma}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            pressed && styles.submitBtnPressed,
            isSubmitting && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="send" size={18} color="#fff" />
              <Text style={styles.submitText}>Enviar Registro</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconBg}>
          <Feather name={icon} size={14} color={C.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error && (
        <View style={styles.fieldError}>
          <Feather name="alert-circle" size={11} color={C.error} />
          <Text style={styles.fieldErrorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

function SummaryItem({
  icon,
  label,
  value,
  filled,
}: {
  icon: any;
  label: string;
  value: string;
  filled: boolean;
}) {
  return (
    <View style={styles.summaryItem}>
      <Feather
        name={icon}
        size={13}
        color={filled ? C.accent : C.textSecondary}
      />
      <Text style={styles.summaryLabel}>{label}:</Text>
      <Text
        style={[styles.summaryValue, filled && { color: C.text }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  topBarTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  topBarSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  section: {
    backgroundColor: C.card,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  sectionIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#EFF3F8",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: C.text,
    letterSpacing: 0.1,
  },
  sectionBody: {
    padding: 18,
    gap: 14,
  },
  fieldContainer: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: C.inputBg,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  inputError: {
    borderColor: C.error,
    backgroundColor: "#FEF2F2",
  },
  fieldError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  fieldErrorText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.error,
  },
  sigConfirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  sigConfirmText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: C.accent,
  },
  summary: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: C.textSecondary,
    width: 68,
  },
  summaryValue: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: 4,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  submitBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
});
