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
import { fetch as expoFetch } from "expo/fetch";
import { File as ExpoFile } from "expo-file-system";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import SignaturePad from "@/components/SignaturePad";
import MapPicker from "@/components/MapPicker";
import PhotoPickerSection from "@/components/PhotoPickerSection";
import VideoPickerSection from "@/components/VideoPickerSection";
import ToggleField from "@/components/ToggleField";
import SelectButtonGroup from "@/components/SelectButtonGroup";
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
  tipoEdificacion: string;
  numeroNiveles: string;
  anioConstruccion: string;
  estaOcupada: boolean;
  fisurasCerradas: boolean;
  fisurasCerradasDesc: string;
  fisurasAbiertas: boolean;
  fisurasAbiertasDesc: string;
  grietas: boolean;
  grietasDesc: string;
  acabadosPisos: string;
  estadoFachada: string;
  verticalidad: boolean;
  verticalidadNotas: string;
  planTopografico: boolean;
  observacionesProfesional: string;
  fotos: string[];
  videos: VideoItem[];
  firma: string | null;
}

interface FieldErrors {
  nombre?: string;
  cedula?: string;
  direccion?: string;
}

const TIPO_OPTIONS = [
  { value: "vivienda", label: "Vivienda", icon: "home" },
  { value: "comercial", label: "Comercial", icon: "briefcase" },
  { value: "mixta", label: "Mixta", icon: "layers" },
];

export default function FormScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const [form, setForm] = useState<FormData>({
    nombre: "",
    cedula: "",
    direccion: "",
    latitud: null,
    longitud: null,
    tipoEdificacion: "",
    numeroNiveles: "",
    anioConstruccion: "",
    estaOcupada: false,
    fisurasCerradas: false,
    fisurasCerradasDesc: "",
    fisurasAbiertas: false,
    fisurasAbiertasDesc: "",
    grietas: false,
    grietasDesc: "",
    acabadosPisos: "",
    estadoFachada: "",
    verticalidad: false,
    verticalidadNotas: "",
    planTopografico: false,
    observacionesProfesional: "",
    fotos: [],
    videos: [],
    firma: null,
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPadding = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const niveles = parseInt(form.numeroNiveles, 10);
  const showVerticalidad = !isNaN(niveles) && niveles >= 4;

  const set = (key: keyof FormData, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const newErrors: FieldErrors = {};
    if (!form.nombre.trim()) newErrors.nombre = "El nombre es requerido";
    if (!form.cedula.trim()) newErrors.cedula = "La cédula es requerida";
    else if (!/^\d{6,12}$/.test(form.cedula.trim()))
      newErrors.cedula = "La cédula debe tener entre 6 y 12 dígitos";
    if (!form.direccion.trim()) newErrors.direccion = "La dirección es requerida";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildDatos = () => ({
    nombre: form.nombre.trim(),
    cedula: form.cedula.trim(),
    direccion: form.direccion.trim(),
    latitud: form.latitud,
    longitud: form.longitud,
    tipoEdificacion: form.tipoEdificacion,
    numeroNiveles: form.numeroNiveles,
    anioConstruccion: form.anioConstruccion,
    estaOcupada: form.estaOcupada,
    fisurasCerradas: form.fisurasCerradas,
    fisurasCerradasDesc: form.fisurasCerradasDesc,
    fisurasAbiertas: form.fisurasAbiertas,
    fisurasAbiertasDesc: form.fisurasAbiertasDesc,
    grietas: form.grietas,
    grietasDesc: form.grietasDesc,
    acabadosPisos: form.acabadosPisos,
    estadoFachada: form.estadoFachada,
    verticalidad: showVerticalidad ? form.verticalidad : null,
    verticalidadNotas: form.verticalidadNotas,
    planTopografico: form.planTopografico,
    observacionesProfesional: form.observacionesProfesional,
    fotosCount: form.fotos.length,
    videosCount: form.videos.length,
    firma: form.firma ? "captured" : null,
  });

  const submitWithFiles = async () => {
    const baseUrl = getApiUrl();
    const url = new URL("/api/registros/upload", baseUrl).toString();
    const formData = new FormData();
    formData.append("datos", JSON.stringify(buildDatos()));

    if (Platform.OS !== "web") {
      for (let i = 0; i < form.fotos.length; i++) {
        const file = new ExpoFile(form.fotos[i]);
        formData.append(`foto_${i}`, file as any, `foto_${i + 1}.jpg`);
      }
      for (let i = 0; i < form.videos.length; i++) {
        const file = new ExpoFile(form.videos[i].uri);
        formData.append(`video_${i}`, file as any, form.videos[i].filename);
      }
    }

    const res = await expoFetch(url, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
    return res.json();
  };

  const submitJson = async () => {
    const baseUrl = getApiUrl();
    const url = new URL("/api/registros", baseUrl).toString();
    const res = await expoFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildDatos()),
      credentials: "include",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Error ${res.status}`);
    }
    return res.json();
  };

  const handleSubmit = async () => {
    if (!validate()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setIsSubmitting(true);
    try {
      const hasMedia = form.fotos.length > 0 || form.videos.length > 0;
      const data = hasMedia && Platform.OS !== "web"
        ? await submitWithFiles()
        : await submitJson();

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
      <View style={[styles.topBar, { paddingTop: topPadding + 8, backgroundColor: C.primary }]}>
        <View>
          <Text style={styles.topBarTitle}>Nuevo Registro</Text>
          <Text style={styles.topBarSub}>Operador: {user?.username}</Text>
        </View>
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <Feather name="log-out" size={18} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 24 }]}
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
              onChangeText={(v) => { set("nombre", v); if (errors.nombre) setErrors((e) => ({ ...e, nombre: undefined })); }}
              returnKeyType="next"
            />
          </Field>
          <Field label="Cédula de identidad" error={errors.cedula}>
            <TextInput
              style={[styles.input, errors.cedula && styles.inputError]}
              placeholder="Ej. 12345678"
              placeholderTextColor={C.textSecondary}
              value={form.cedula}
              onChangeText={(v) => { set("cedula", v.replace(/\D/g, "")); if (errors.cedula) setErrors((e) => ({ ...e, cedula: undefined })); }}
              keyboardType="numeric"
              maxLength={12}
            />
          </Field>
          <Field label="Dirección" error={errors.direccion}>
            <TextInput
              style={[styles.input, styles.inputMultiline, errors.direccion && styles.inputError]}
              placeholder="Calle, número, barrio, ciudad..."
              placeholderTextColor={C.textSecondary}
              value={form.direccion}
              onChangeText={(v) => { set("direccion", v); if (errors.direccion) setErrors((e) => ({ ...e, direccion: undefined })); }}
              multiline
              numberOfLines={3}
            />
          </Field>
        </Section>

        <Section icon="home" title="Características de la Edificación">
          <Field label="Tipo de edificación y uso">
            <SelectButtonGroup
              options={TIPO_OPTIONS}
              value={form.tipoEdificacion}
              onChange={(v) => set("tipoEdificacion", v)}
            />
          </Field>

          <View style={styles.row}>
            <View style={styles.rowHalf}>
              <Field label="Número de niveles">
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 3"
                  placeholderTextColor={C.textSecondary}
                  value={form.numeroNiveles}
                  onChangeText={(v) => set("numeroNiveles", v.replace(/\D/g, ""))}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </Field>
            </View>
            <View style={styles.rowHalf}>
              <Field label="Año de construcción">
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 1998"
                  placeholderTextColor={C.textSecondary}
                  value={form.anioConstruccion}
                  onChangeText={(v) => set("anioConstruccion", v.replace(/\D/g, ""))}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </Field>
            </View>
          </View>

          <View style={styles.divider} />
          <ToggleField
            label="¿Está ocupada actualmente?"
            value={form.estaOcupada}
            onChange={(v) => set("estaOcupada", v)}
          />
        </Section>

        <Section icon="alert-triangle" title="Evaluación Estructural">
          <InfoBox
            text="Las fisuras son discontinuidades en muros, vigas, columnas, losas y placas de entrepiso."
          />

          <View style={styles.structuralItem}>
            <ToggleField
              label="Fisuras cerradas"
              description="Discontinuidad cerrada que no afecta la calidad estructural."
              value={form.fisurasCerradas}
              onChange={(v) => set("fisurasCerradas", v)}
            />
            {form.fisurasCerradas && (
              <TextInput
                style={[styles.input, styles.inputMultilineSmall, styles.inputIndented]}
                placeholder="Descripción de ubicación y alcance..."
                placeholderTextColor={C.textSecondary}
                value={form.fisurasCerradasDesc}
                onChangeText={(v) => set("fisurasCerradasDesc", v)}
                multiline
                numberOfLines={2}
              />
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.structuralItem}>
            <ToggleField
              label="Fisuras abiertas"
              description="Discontinuidad abierta (0.2–2.0 mm) que puede afectar la estabilidad."
              value={form.fisurasAbiertas}
              onChange={(v) => set("fisurasAbiertas", v)}
            />
            {form.fisurasAbiertas && (
              <TextInput
                style={[styles.input, styles.inputMultilineSmall, styles.inputIndented]}
                placeholder="Descripción de ubicación y alcance..."
                placeholderTextColor={C.textSecondary}
                value={form.fisurasAbiertasDesc}
                onChangeText={(v) => set("fisurasAbiertasDesc", v)}
                multiline
                numberOfLines={2}
              />
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.structuralItem}>
            <ToggleField
              label="Grietas"
              description="Discontinuidad abierta (>2.0 mm, prof. >10 mm) que afecta estabilidad."
              value={form.grietas}
              onChange={(v) => set("grietas", v)}
            />
            {form.grietas && (
              <TextInput
                style={[styles.input, styles.inputMultilineSmall, styles.inputIndented]}
                placeholder="Descripción de ubicación y alcance..."
                placeholderTextColor={C.textSecondary}
                value={form.grietasDesc}
                onChangeText={(v) => set("grietasDesc", v)}
                multiline
                numberOfLines={2}
              />
            )}
          </View>
        </Section>

        <Section icon="grid" title="Acabados y Fachada">
          <Field label="Tipo de acabados en pisos y su estado">
            <TextInput
              style={[styles.input, styles.inputMultilineSmall]}
              placeholder="Ej. Cerámica — buen estado, sin grietas visibles"
              placeholderTextColor={C.textSecondary}
              value={form.acabadosPisos}
              onChangeText={(v) => set("acabadosPisos", v)}
              multiline
              numberOfLines={2}
            />
          </Field>
          <Field label="Estado de la fachada">
            <TextInput
              style={[styles.input, styles.inputMultilineSmall]}
              placeholder="Ej. Pintura — buen estado, con mantenimiento reciente"
              placeholderTextColor={C.textSecondary}
              value={form.estadoFachada}
              onChangeText={(v) => set("estadoFachada", v)}
              multiline
              numberOfLines={2}
            />
          </Field>
        </Section>

        {showVerticalidad && (
          <Section icon="bar-chart-2" title="Verticalidad (≥4 niveles)">
            <InfoBox
              text="Verificar por topografía la verticalidad a lo largo de un vértice de la edificación."
            />
            <ToggleField
              label="¿Se evidencia variación de verticalidad?"
              value={form.verticalidad}
              onChange={(v) => set("verticalidad", v)}
            />
            <Field label="Notas y observaciones topográficas">
              <TextInput
                style={[styles.input, styles.inputMultilineSmall]}
                placeholder="Descripción del resultado del levantamiento topográfico..."
                placeholderTextColor={C.textSecondary}
                value={form.verticalidadNotas}
                onChangeText={(v) => set("verticalidadNotas", v)}
                multiline
                numberOfLines={2}
              />
            </Field>
          </Section>
        )}

        <Section icon="file-text" title="Documentación Adicional">
          <ToggleField
            label="Plano de ubicación topográfica radicado"
            description="Incluye predios, vías y demás zonas involucradas en la actividad."
            value={form.planTopografico}
            onChange={(v) => set("planTopografico", v)}
          />
          <View style={styles.divider} />
          <Field label="Observaciones del profesional">
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Cualquier observación adicional que el profesional considere relevante..."
              placeholderTextColor={C.textSecondary}
              value={form.observacionesProfesional}
              onChangeText={(v) => set("observacionesProfesional", v)}
              multiline
              numberOfLines={4}
            />
          </Field>
        </Section>

        <Section icon="map-pin" title="Georeferenciación">
          <MapPicker
            latitud={form.latitud}
            longitud={form.longitud}
            onLocationChange={(lat, lng) => setForm((f) => ({ ...f, latitud: lat, longitud: lng }))}
          />
        </Section>

        <Section icon="camera" title="Fotografías">
          <PhotoPickerSection
            photos={form.fotos}
            onPhotosChange={(fotos) => set("fotos", fotos)}
          />
        </Section>

        <Section icon="video" title="Videos">
          <VideoPickerSection
            videos={form.videos}
            onVideosChange={(videos) => set("videos", videos)}
          />
        </Section>

        <Section icon="edit-2" title="Firma del Vecino">
          <SignaturePad
            onSignatureChange={(sig) => set("firma", sig)}
          />
          {form.firma && (
            <View style={styles.sigConfirm}>
              <Feather name="check-circle" size={13} color={C.accent} />
              <Text style={styles.sigConfirmText}>Firma capturada</Text>
            </View>
          )}
        </Section>

        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Resumen del Registro</Text>
          <SummaryItem icon="user" label="Nombre" value={form.nombre.trim() || "—"} filled={!!form.nombre.trim()} />
          <SummaryItem icon="credit-card" label="Cédula" value={form.cedula.trim() || "—"} filled={!!form.cedula.trim()} />
          <SummaryItem icon="home" label="Edificación" value={form.tipoEdificacion ? `${form.tipoEdificacion} — ${form.numeroNiveles || "?"} niveles` : "—"} filled={!!form.tipoEdificacion} />
          <SummaryItem icon="map-pin" label="Ubicación" value={form.latitud !== null ? "Capturada" : "Sin capturar"} filled={form.latitud !== null} />
          <SummaryItem icon="camera" label="Fotos" value={`${form.fotos.length} adjuntas`} filled={form.fotos.length > 0} />
          <SummaryItem icon="video" label="Videos" value={`${form.videos.length} adjuntos`} filled={form.videos.length > 0} />
          <SummaryItem icon="edit-2" label="Firma" value={form.firma ? "Capturada" : "Sin capturar"} filled={!!form.firma} />
          <View style={styles.uploadNote}>
            <Feather name="upload-cloud" size={12} color={C.textSecondary} />
            <Text style={styles.uploadNoteText}>
              Los archivos se depositarán en el servidor FTP en /uploads/{"{"}REG-XXXXX{"}"}
            </Text>
          </View>
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
              <Feather name="upload-cloud" size={18} color="#fff" />
              <Text style={styles.submitText}>Enviar Registro</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Section({ icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
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

function InfoBox({ text }: { text: string }) {
  return (
    <View style={styles.infoBox}>
      <Feather name="info" size={13} color={C.primary} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

function SummaryItem({ icon, label, value, filled }: { icon: any; label: string; value: string; filled: boolean }) {
  return (
    <View style={styles.summaryItem}>
      <Feather name={icon} size={13} color={filled ? C.accent : C.textSecondary} />
      <Text style={styles.summaryLabel}>{label}:</Text>
      <Text style={[styles.summaryValue, filled && { color: C.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  topBarTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  topBarSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 2 },
  logoutBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
  },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16 },
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
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: "#EFF3F8",
    justifyContent: "center", alignItems: "center",
  },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.text, letterSpacing: 0.1 },
  sectionBody: { padding: 18, gap: 14 },
  fieldContainer: { gap: 6 },
  fieldLabel: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5,
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
    minHeight: 80, textAlignVertical: "top", paddingTop: 12,
  },
  inputMultilineSmall: {
    minHeight: 56, textAlignVertical: "top", paddingTop: 12,
  },
  inputIndented: {
    marginTop: 10,
    borderColor: C.primary + "44",
    borderLeftWidth: 3,
    borderRadius: 8,
    backgroundColor: "#F0F4FB",
  },
  inputError: { borderColor: C.error, backgroundColor: "#FEF2F2" },
  fieldError: { flexDirection: "row", alignItems: "center", gap: 4 },
  fieldErrorText: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.error },
  row: { flexDirection: "row", gap: 12 },
  rowHalf: { flex: 1 },
  divider: { height: 1, backgroundColor: C.border },
  structuralItem: { gap: 0 },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#EFF3F8",
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: C.primary,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 18,
  },
  sigConfirm: { flexDirection: "row", alignItems: "center", gap: 5 },
  sigConfirmText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.accent },
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
  summaryTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: C.text,
    marginBottom: 4,
  },
  summaryItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textSecondary, width: 72 },
  summaryValue: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary },
  uploadNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#EFF3F8",
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  uploadNoteText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 16,
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
  submitBtnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  submitBtnDisabled: { opacity: 0.65 },
  submitText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff" },
});
