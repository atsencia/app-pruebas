import React, { useState, useRef } from "react";
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
  Animated,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { subirFormularioFTP } from "@/services/FtpuploadServices";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import SignaturePad from "@/components/SignaturePad";
import MapPicker from "@/components/MapPicker";
import PhotoPickerSection from "@/components/PhotoPickerSection";
import VideoPickerSection from "@/components/VideoPickerSection";
import ToggleField from "@/components/ToggleField";
import Colors from "@/constants/colors";

const C           = Colors.light;
const SIDEBAR_WIDTH = 260;

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

export interface FirmaPersona {
  nombre: string;
  cedula: string;
  cargo:  string;
  firma:  string | null;
}

export interface VideoItem {
  uri:       string;
  thumbnail: string | null;
  duration:  number | null;
  filename:  string;
}

export interface FormData {
  tipoActa: "inicio" | "seguimiento" | "cierre" | "";

  nombre:     string;
  cedula:     string;
  direccion:  string;
  telefono:   string;
  propCorreo: string;
  interCorreo: string;

  firmaConcesionario: FirmaPersona;
  firmaProfesional:   FirmaPersona;

  latitud:  number | null;
  longitud: number | null;

  longitudFrenteYFondo: string;
  numeroPisos:          string;
  estrato:              string;
  anioConstruccion:     string;
  estaOcupada:          boolean;

  servicioAgua:           string;
  servicioAlcantarillado: string;
  servicioEnergia:        string;
  servicioTelefono:       string;
  servicioGas:            string;
  servicioOtros:          string;

  usoResidencial:   string;
  usoComercial:     string;
  usoIndustrial:    string;
  usoInstitucional: string;
  usoRecreacional:  string;
  usoBaldio:        string;
  usoBIC:           string;
  usoMixto:         string;
  usoOtro:          string;

  tieneGaraje:          boolean;
  cantidadGarajes:      string;
  usoGaraje:            string;
  usoGarajeComercial:   string;
  usoGarajeResidencial: string;
  anchoAccesoVehicular: string;

  fisurasCerradas:     boolean;
  fisurasCerradasDesc: string;
  fisurasAbiertas:     boolean;
  fisurasAbiertasDesc: string;
  grietas:             boolean;
  grietasDesc:         string;

  acabadosPisos: string;
  estadoFachada: string;

  verticalidad:      boolean;
  verticalidadNotas: string;

  planTopografico:          boolean;
  observacionesProfesional: string;

  // ── Multimedia ────────────────────────────
  fotos:        string[];        // fotos generales (URIs)
  fotosFachada: string[];        // ← NUEVO: fotos específicas de la fachada
  videos:       VideoItem[];
}

interface FieldErrors {
  nombre?:    string;
  cedula?:    string;
  direccion?: string;
}

// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────

const TIPO_ACTA_OPTIONS: { value: FormData["tipoActa"]; label: string }[] = [
  { value: "inicio",      label: "Inicio",      },
  { value: "seguimiento", label: "Seguimiento"  },
  { value: "cierre",      label: "Cierre" },
];

const SERVICIOS = [
  { key: "servicioAgua",           label: "Agua"           },
  { key: "servicioAlcantarillado", label: "Alcantarillado" },
  { key: "servicioEnergia",        label: "Energía"        },
  { key: "servicioTelefono",       label: "Teléfono"       },
  { key: "servicioGas",            label: "Gas"            },
  { key: "servicioOtros",          label: "Otros"          },
] as const;

const USOS_ACTUALES = [
  { key: "usoResidencial",   label: "Residencial"              },
  { key: "usoComercial",     label: "Comercial"                },
  { key: "usoIndustrial",    label: "Industrial"               },
  { key: "usoInstitucional", label: "Institucional"            },
  { key: "usoRecreacional",  label: "Recreacional"             },
  { key: "usoBaldio",        label: "Baldío"                   },
  { key: "usoBIC",           label: "Bien de Interés Cultural" },
  { key: "usoMixto",         label: "Mixto"                    },
  { key: "usoOtro",          label: "Otro ¿cuál?"              },
] as const;

const SIDEBAR_ITEMS: { icon: any; label: string; route: string; description: string }[] = [
  { icon: "search",   label: "Buscar registros",   route: "/search",         description: "Consultar actas existentes" },
  { icon: "users",    label: "Crear usuario",       route: "/createUser",     description: "Solo administradores"       },
  { icon: "settings", label: "Gestionar usuarios",  route: "/userManagement", description: "Solo administradores"       },
];

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────

export default function FormScreen() {
  const insets           = useSafeAreaInsets();
  const { user, logout } = useAuth();

  // ── Sidebar ──────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.spring(sidebarAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  };

  const closeSidebar = () => {
    Animated.timing(sidebarAnim, { toValue: -SIDEBAR_WIDTH, duration: 220, useNativeDriver: true })
      .start(() => setSidebarOpen(false));
  };

  const navigateTo = (route: string) => {
    closeSidebar();
    setTimeout(() => router.push(route as any), 240);
  };

  // ── Estado del formulario ──────────────────
  const [form, setForm] = useState<FormData>({
    tipoActa: "",
    nombre: "", cedula: "", direccion: "", telefono: "", propCorreo: "",
    interCorreo: "",
    firmaConcesionario: { nombre: "", cedula: "", cargo: "", firma: null },
    firmaProfesional:   { nombre: "", cedula: "", cargo: "", firma: null },
    latitud: null, longitud: null,
    longitudFrenteYFondo: "", numeroPisos: "", estrato: "", anioConstruccion: "",
    estaOcupada: false,
    servicioAgua: "", servicioAlcantarillado: "", servicioEnergia: "",
    servicioTelefono: "", servicioGas: "", servicioOtros: "",
    usoResidencial: "", usoComercial: "", usoIndustrial: "", usoInstitucional: "",
    usoRecreacional: "", usoBaldio: "", usoBIC: "", usoMixto: "", usoOtro: "",
    tieneGaraje: false, cantidadGarajes: "", usoGaraje: "",
    usoGarajeComercial: "", usoGarajeResidencial: "", anchoAccesoVehicular: "",
    fisurasCerradas: false, fisurasCerradasDesc: "",
    fisurasAbiertas: false, fisurasAbiertasDesc: "",
    grietas: false, grietasDesc: "",
    acabadosPisos: "", estadoFachada: "",
    verticalidad: false, verticalidadNotas: "",
    planTopografico: false, observacionesProfesional: "",
    fotos: [],
    fotosFachada: [],   // ← NUEVO
    videos: [],
  });

  const [errors,       setErrors]      = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const topPadding    = Platform.OS === "web" ? Math.max(insets.top, 67)    : insets.top;
  const bottomPadding = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const pisos            = parseInt(form.numeroPisos, 10);
  const showVerticalidad = !isNaN(pisos) && pisos >= 4;

  const set = (key: keyof FormData, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setFirma = (
    who: "firmaConcesionario" | "firmaProfesional",
    field: keyof FirmaPersona,
    value: any
  ) => setForm((f) => ({ ...f, [who]: { ...f[who], [field]: value } }));

  // ── Validación ──────────────────────────────
  const validate = (): boolean => {
    const e: FieldErrors = {};
    if (!form.nombre.trim())    e.nombre    = "El nombre es requerido";
    if (!form.cedula.trim())    e.cedula    = "La cédula es requerida";
    else if (!/^\d{6,12}$/.test(form.cedula.trim()))
      e.cedula = "La cédula debe tener entre 6 y 12 dígitos";
    if (!form.direccion.trim()) e.direccion = "La dirección es requerida";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── JSON objetivo ───────────────────────────
  const buildDatos = () => ({
    tipoActa:  form.tipoActa,
    nombre:    form.nombre.trim(),
    cedula:    form.cedula.trim(),
    direccion: form.direccion.trim(),
    telefono:  form.telefono.trim(),
    georef:    { latitud: form.latitud, longitud: form.longitud },
    latitud:   form.latitud,
    longitud:  form.longitud,
    longitudFrenteYFondo: form.longitudFrenteYFondo,
    numeroPisos:          form.numeroPisos,
    estrato:              form.estrato,
    anioConstruccion:     form.anioConstruccion,
    estaOcupada:          form.estaOcupada,
    servicioAgua:           form.servicioAgua,
    servicioAlcantarillado: form.servicioAlcantarillado,
    servicioEnergia:        form.servicioEnergia,
    servicioTelefono:       form.servicioTelefono,
    servicioGas:            form.servicioGas,
    servicioOtros:          form.servicioOtros,
    usoResidencial:   form.usoResidencial   || "NA",
    usoComercial:     form.usoComercial     || "NA",
    usoIndustrial:    form.usoIndustrial    || "NA",
    usoInstitucional: form.usoInstitucional || "NA",
    usoRecreacional:  form.usoRecreacional  || "NA",
    usoBaldio:        form.usoBaldio        || "NA",
    usoBIC:           form.usoBIC           || "NA",
    usoMixto:         form.usoMixto         || "NA",
    usoOtro:          form.usoOtro          || "NA",
    tieneGaraje:          form.tieneGaraje,
    cantidadGarajes:      form.cantidadGarajes,
    usoGaraje:            form.usoGaraje,
    usoGarajeComercial:   form.usoGarajeComercial,
    usoGarajeResidencial: form.usoGarajeResidencial,
    anchoAccesoVehicular: form.anchoAccesoVehicular,
    fisurasCerradas:     form.fisurasCerradas,
    fisurasCerradasDesc: form.fisurasCerradasDesc,
    fisurasAbiertas:     form.fisurasAbiertas,
    fisurasAbiertasDesc: form.fisurasAbiertasDesc,
    grietas:             form.grietas,
    grietasDesc:         form.grietasDesc,
    acabadosPisos:  form.acabadosPisos,
    estadoFachada:  form.estadoFachada,
    verticalidad:      showVerticalidad ? form.verticalidad : null,
    verticalidadNotas: form.verticalidadNotas,
    planTopografico:          form.planTopografico,
    planTopograficoArchivo:   null,
    observacionesProfesional: form.observacionesProfesional,
    firmaPropietario: {
      nombre: form.nombre.trim(),
      cedula: form.cedula.trim(),
      cargo:  "",
      firma:  null,
      correo: form.propCorreo.trim(),
    },
    firmaInterventoria: {
      nombre: "", cedula: "", cargo: "", firma: null,
      correo: form.interCorreo.trim(),
    },
    firmaConcesionario: form.firmaConcesionario,
    firmaProfesional:   form.firmaProfesional,
    fotosCount:        form.fotos.length,
    fotosFachadaCount: form.fotosFachada.length,   // ← NUEVO
    videosCount:       form.videos.length,
  });

  // ── Submit ──────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setIsSubmitting(true);
    try {
      const resultado = await subirFormularioFTP(
        {
          nombre:    form.nombre.trim(),
          apellido: form.cedula.trim(), // o el valor correcto que quieras usar
          direccion: form.direccion.trim(),
          georef:    { latitud: form.latitud, longitud: form.longitud },
          fotos:        form.fotos.map((uri) => ({ uri })),
          fotosFachada: form.fotosFachada.map((uri) => ({ uri })),  // ← NUEVO
          videos:       form.videos.map((v) => ({ uri: v.uri })),
          extra:        buildDatos(),
        },
        (porcentaje: any, mensaje: any) => console.log(`[FTP] ${porcentaje}% — ${mensaje}`)
      );
      if (!resultado.success) throw new Error(resultado.mensaje);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: "/success",
        params: {
          numeroRegistro:     resultado.id,
          nombre:             form.nombre.trim(),
          fotosCount:         String(form.fotos.length),
          fotosFachadaCount:  String(form.fotosFachada.length),  // ← NUEVO
          videosCount:        String(form.videos.length),
        },
      });
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", e.message || "No se pudo enviar el registro");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => { await logout(); router.replace("/login"); };

  // ── Render ──────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: C.background }]}>

      {/* TOP BAR */}
      <View style={[styles.topBar, { paddingTop: topPadding + 10, backgroundColor: C.primary }]}>
        <Pressable
          onPress={openSidebar}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          hitSlop={10}
        >
          <Feather name="menu" size={20} color="#fff" />
        </Pressable>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Nuevo Registro</Text>
          <Text style={styles.topBarSub}>Operador: {user?.username}</Text>
        </View>
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          hitSlop={10}
        >
          <Feather name="log-out" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* FORMULARIO */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* 0. TIPO DE ACTA */}
        <View style={styles.tipoActaCard}>
          <Text style={styles.tipoActaLabel}>TIPO DE ACTA</Text>
          <View style={styles.tipoActaRow}>
            {TIPO_ACTA_OPTIONS.map((opt) => {
              const active = form.tipoActa === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={({ pressed }) => [
                    styles.tipoActaBtn,
                    active && styles.tipoActaBtnActive,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => set("tipoActa", opt.value)}
                >
                  <Text style={[styles.tipoActaBtnText, active && styles.tipoActaBtnTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 1. DATOS DEL VECINO / PROPIETARIO */}
        <Section icon="user" title="Datos del Vecino / Propietario">
          <Field label="Nombre completo" error={errors.nombre}>
            <TextInput
              style={[styles.input, errors.nombre && styles.inputError]}
              placeholder="Ej. Juan García López"
              placeholderTextColor={C.textSecondary}
              value={form.nombre}
              onChangeText={(v) => { set("nombre", v); if (errors.nombre) setErrors((e) => ({ ...e, nombre: undefined })); }}
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
          <View style={styles.row}>
            <View style={styles.rowHalf}>
              <Field label="Teléfono">
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 3001234567"
                  placeholderTextColor={C.textSecondary}
                  value={form.telefono}
                  onChangeText={(v) => set("telefono", v.replace(/\D/g, ""))}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </Field>
            </View>
          </View>
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
          <View style={styles.divider} />
          <View style={styles.emailHint}>
            <Feather name="mail" size={13} color={C.primary} />
            <Text style={styles.emailHintText}>
              Se enviará un enlace a este correo para que el propietario complete y firme el acta.
            </Text>
          </View>
          <Field label="Correo del propietario">
            <TextInput
              style={styles.input}
              placeholder="propietario@correo.com"
              placeholderTextColor={C.textSecondary}
              value={form.propCorreo}
              onChangeText={(v) => set("propCorreo", v.trim())}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Field>
        </Section>

        {/* 2. INTERVENTORÍA */}
        <Section icon="briefcase" title="Interventoría">
          <InfoBox text="Solo se requiere el correo del representante delegado. Recibirá un enlace para completar sus datos y firmar." />
          <Field label="Correo del delegado de interventoría">
            <TextInput
              style={styles.input}
              placeholder="interventoria@correo.com"
              placeholderTextColor={C.textSecondary}
              value={form.interCorreo}
              onChangeText={(v) => set("interCorreo", v.trim())}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Field>
        </Section>

        {/* 3. DATOS DEL PREDIO */}
        <Section icon="home" title="Datos del Predio">
          <View style={styles.row}>
            <View style={styles.rowHalf}>
              <Field label="Frente y fondo (m)">
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 20"
                  placeholderTextColor={C.textSecondary}
                  value={form.longitudFrenteYFondo}
                  onChangeText={(v) => set("longitudFrenteYFondo", v)}
                  keyboardType="decimal-pad"
                />
              </Field>
            </View>
            <View style={styles.rowHalf}>
              <Field label="No. de pisos">
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 2"
                  placeholderTextColor={C.textSecondary}
                  value={form.numeroPisos}
                  onChangeText={(v) => set("numeroPisos", v.replace(/\D/g, ""))}
                  keyboardType="numeric"
                  maxLength={2}
                />
              </Field>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.rowHalf}>
              <Field label="Estrato">
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 3"
                  placeholderTextColor={C.textSecondary}
                  value={form.estrato}
                  onChangeText={(v) => set("estrato", v.replace(/\D/g, ""))}
                  keyboardType="numeric"
                  maxLength={1}
                />
              </Field>
            </View>
            <View style={styles.rowHalf}>
              <Field label="Año construcción">
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

        {/* 4. SERVICIOS PÚBLICOS */}
        <Section icon="zap" title="Servicios Públicos">
          <InfoBox text="Indique el estado de cada servicio (ej. Si, No, Bueno, Malo, NA)." />
          <View style={styles.servicesGrid}>
            {SERVICIOS.map(({ key, label }) => (
              <View key={key} style={styles.serviceItem}>
                <Text style={styles.serviceLabel}>{label}</Text>
                <TextInput
                  style={[styles.input, styles.serviceInput]}
                  placeholder="Ej. Si"
                  placeholderTextColor={C.textSecondary}
                  value={(form as any)[key]}
                  onChangeText={(v) => set(key as keyof FormData, v)}
                />
              </View>
            ))}
          </View>
        </Section>

        {/* 5. USO ACTUAL */}
        <Section icon="layers" title="Uso Actual del Predio">
          <InfoBox text="Describa el uso. Si no aplica, deje en blanco (se enviará como 'NA')." />
          {USOS_ACTUALES.map(({ key, label }) => (
            <View key={key} style={styles.usoRow}>
              <Text style={styles.usoLabel}>{label}</Text>
              <View style={styles.usoInputContainer}>
                <TextInput
                  style={[styles.input, styles.usoInput]}
                  placeholder="NA"
                  placeholderTextColor={C.textSecondary}
                  value={(form as any)[key]}
                  onChangeText={(v) => set(key as keyof FormData, v)}
                />
              </View>
            </View>
          ))}
        </Section>

        {/* 6. ACCESO VEHICULAR */}
        <Section icon="truck" title="Acceso Vehicular">
          <ToggleField
            label="¿Tiene garaje?"
            value={form.tieneGaraje}
            onChange={(v) => set("tieneGaraje", v)}
          />
          {form.tieneGaraje && (
            <>
              <View style={styles.row}>
                <View style={styles.rowHalf}>
                  <Field label="Cantidad de garajes">
                    <TextInput
                      style={styles.input}
                      placeholder="Ej. 1"
                      placeholderTextColor={C.textSecondary}
                      value={form.cantidadGarajes}
                      onChangeText={(v) => set("cantidadGarajes", v.replace(/\D/g, ""))}
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  </Field>
                </View>
                <View style={styles.rowHalf}>
                  <Field label="Se usa como">
                    <TextInput
                      style={styles.input}
                      placeholder="Ej. Tienda"
                      placeholderTextColor={C.textSecondary}
                      value={form.usoGaraje}
                      onChangeText={(v) => set("usoGaraje", v)}
                    />
                  </Field>
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.rowHalf}>
                  <Field label="Uso comercial">
                    <TextInput
                      style={styles.input}
                      placeholder="Ej. Tienda"
                      placeholderTextColor={C.textSecondary}
                      value={form.usoGarajeComercial}
                      onChangeText={(v) => set("usoGarajeComercial", v)}
                    />
                  </Field>
                </View>
                <View style={styles.rowHalf}>
                  <Field label="Uso residencial">
                    <TextInput
                      style={styles.input}
                      placeholder="Ej. Sí"
                      placeholderTextColor={C.textSecondary}
                      value={form.usoGarajeResidencial}
                      onChangeText={(v) => set("usoGarajeResidencial", v)}
                    />
                  </Field>
                </View>
              </View>
            </>
          )}
          <Field label="Ancho de acceso vehicular (m)">
            <TextInput
              style={styles.input}
              placeholder="Ej. 3.5"
              placeholderTextColor={C.textSecondary}
              value={form.anchoAccesoVehicular}
              onChangeText={(v) => set("anchoAccesoVehicular", v)}
              keyboardType="decimal-pad"
            />
          </Field>
        </Section>

        {/* 7. EVALUACIÓN ESTRUCTURAL */}
        <Section icon="alert-triangle" title="Evaluación Estructural">
          <InfoBox text="Las fisuras son discontinuidades en muros, vigas, columnas, losas y placas de entrepiso." />

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
              multiline numberOfLines={2}
            />
          )}

          <View style={styles.divider} />

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
              multiline numberOfLines={2}
            />
          )}

          <View style={styles.divider} />

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
              multiline numberOfLines={2}
            />
          )}
        </Section>

        {/* 8. ACABADOS Y FACHADA */}
        <Section icon="grid" title="Acabados y Fachada">
          <Field label="Tipo de acabados en pisos y su estado">
            <TextInput
              style={[styles.input, styles.inputMultilineSmall]}
              placeholder="Ej. Cerámica — buen estado, sin grietas visibles"
              placeholderTextColor={C.textSecondary}
              value={form.acabadosPisos}
              onChangeText={(v) => set("acabadosPisos", v)}
              multiline numberOfLines={2}
            />
          </Field>
          <Field label="Estado de la fachada">
            <TextInput
              style={[styles.input, styles.inputMultilineSmall]}
              placeholder="Ej. Pintura — buen estado, con mantenimiento reciente"
              placeholderTextColor={C.textSecondary}
              value={form.estadoFachada}
              onChangeText={(v) => set("estadoFachada", v)}
              multiline numberOfLines={2}
            />
          </Field>
        </Section>

        {/* 9. VERTICALIDAD */}
        {showVerticalidad && (
          <Section icon="bar-chart-2" title="Verticalidad (≥4 niveles)">
            <InfoBox text="Verificar por topografía la verticalidad a lo largo de un vértice de la edificación." />
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
                multiline numberOfLines={2}
              />
            </Field>
          </Section>
        )}

        {/* 10. DOCUMENTACIÓN ADICIONAL */}
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
              placeholder="Cualquier observación adicional..."
              placeholderTextColor={C.textSecondary}
              value={form.observacionesProfesional}
              onChangeText={(v) => set("observacionesProfesional", v)}
              multiline numberOfLines={4}
            />
          </Field>
        </Section>

        {/* 11. GEOREFERENCIACIÓN */}
        <Section icon="map-pin" title="Georeferenciación">
          <MapPicker
            latitud={form.latitud}
            longitud={form.longitud}
            onLocationChange={(lat, lng) => setForm((f) => ({ ...f, latitud: lat, longitud: lng }))}
          />
        </Section>

        {/* 12. FOTOGRAFÍAS GENERALES */}
        <Section icon="camera" title="Fotografías Generales">
          <InfoBox text="Fotos del interior, estructura, y demás elementos del predio." />
          <PhotoPickerSection
            photos={form.fotos}
            onPhotosChange={(fotos) => set("fotos", fotos)}
          />
        </Section>

        {/* 13. FOTOGRAFÍAS DE FACHADA ← NUEVO */}
        <Section icon="image" title="Fotografías de Fachada">
          <InfoBox text="Fotos específicas de la fachada exterior del predio. Se guardarán como fachada_001.jpg, fachada_002.jpg, etc." />
          <PhotoPickerSection
            photos={form.fotosFachada}
            onPhotosChange={(fotos) => set("fotosFachada", fotos)}
          />
        </Section>

        {/* 14. VIDEOS */}
        <Section icon="video" title="Videos">
          <VideoPickerSection
            videos={form.videos}
            onVideosChange={(videos) => set("videos", videos)}
          />
        </Section>

        {/* 15. FIRMA — CONCESIONARIO */}
        <Section icon="award" title="Representante Delegado Sencia S.A.S.">
          <InfoBox text="Datos y firma del representante delegado del concesionario." />
          <View style={styles.row}>
            <View style={styles.rowHalf}>
              <Field label="Nombre completo">
                <TextInput
                  style={styles.input}
                  placeholder="Nombre y apellidos"
                  placeholderTextColor={C.textSecondary}
                  value={form.firmaConcesionario.nombre}
                  onChangeText={(v) => setFirma("firmaConcesionario", "nombre", v)}
                />
              </Field>
            </View>
            <View style={styles.rowHalf}>
              <Field label="Cédula">
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 12345678"
                  placeholderTextColor={C.textSecondary}
                  value={form.firmaConcesionario.cedula}
                  onChangeText={(v) => setFirma("firmaConcesionario", "cedula", v.replace(/\D/g, ""))}
                  keyboardType="numeric"
                />
              </Field>
            </View>
          </View>
          <Field label="Cargo">
            <TextInput
              style={styles.input}
              placeholder="Ej. Ingeniero Residente"
              placeholderTextColor={C.textSecondary}
              value={form.firmaConcesionario.cargo}
              onChangeText={(v) => setFirma("firmaConcesionario", "cargo", v)}
            />
          </Field>
          <Field label="Firma">
            <SignaturePad onSignatureChange={(sig) => setFirma("firmaConcesionario", "firma", sig)} />
          </Field>
          {form.firmaConcesionario.firma && (
            <View style={styles.sigConfirm}>
              <Feather name="check-circle" size={13} color={C.accent} />
              <Text style={styles.sigConfirmText}>Firma capturada</Text>
            </View>
          )}
        </Section>

        {/* 16. FIRMA — PROFESIONAL TÉCNICO */}
        <Section icon="tool" title="Profesional Técnico">
          <InfoBox text="Datos y firma del profesional técnico que diligencia el acta." />
          <View style={styles.row}>
            <View style={styles.rowHalf}>
              <Field label="Nombre completo">
                <TextInput
                  style={styles.input}
                  placeholder="Nombre y apellidos"
                  placeholderTextColor={C.textSecondary}
                  value={form.firmaProfesional.nombre}
                  onChangeText={(v) => setFirma("firmaProfesional", "nombre", v)}
                />
              </Field>
            </View>
            <View style={styles.rowHalf}>
              <Field label="Cédula">
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 12345678"
                  placeholderTextColor={C.textSecondary}
                  value={form.firmaProfesional.cedula}
                  onChangeText={(v) => setFirma("firmaProfesional", "cedula", v.replace(/\D/g, ""))}
                  keyboardType="numeric"
                />
              </Field>
            </View>
          </View>
          <Field label="Cargo">
            <TextInput
              style={styles.input}
              placeholder="Ej. Ingeniero Civil"
              placeholderTextColor={C.textSecondary}
              value={form.firmaProfesional.cargo}
              onChangeText={(v) => setFirma("firmaProfesional", "cargo", v)}
            />
          </Field>
          <Field label="Firma">
            <SignaturePad onSignatureChange={(sig) => setFirma("firmaProfesional", "firma", sig)} />
          </Field>
          {form.firmaProfesional.firma && (
            <View style={styles.sigConfirm}>
              <Feather name="check-circle" size={13} color={C.accent} />
              <Text style={styles.sigConfirmText}>Firma capturada</Text>
            </View>
          )}
        </Section>

        {/* RESUMEN */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Resumen del Registro</Text>
          <SummaryItem icon="file-text"   label="Tipo acta"       value={form.tipoActa ? form.tipoActa.charAt(0).toUpperCase() + form.tipoActa.slice(1) : "—"} filled={!!form.tipoActa} />
          <SummaryItem icon="user"        label="Nombre"          value={form.nombre.trim()       || "—"} filled={!!form.nombre.trim()} />
          <SummaryItem icon="credit-card" label="Cédula"          value={form.cedula.trim()       || "—"} filled={!!form.cedula.trim()} />
          <SummaryItem icon="mail"        label="Prop. correo"    value={form.propCorreo.trim()   || "—"} filled={!!form.propCorreo.trim()} />
          <SummaryItem icon="mail"        label="Inter. correo"   value={form.interCorreo.trim()  || "—"} filled={!!form.interCorreo.trim()} />
          <SummaryItem icon="home"        label="Pisos"           value={form.numeroPisos ? `${form.numeroPisos} pisos — estrato ${form.estrato || "?"}` : "—"} filled={!!form.numeroPisos} />
          <SummaryItem icon="map-pin"     label="Ubicación"       value={form.latitud !== null ? "Capturada" : "Sin capturar"} filled={form.latitud !== null} />
          <SummaryItem icon="camera"      label="Fotos generales" value={`${form.fotos.length} adjuntas`}         filled={form.fotos.length > 0} />
          <SummaryItem icon="image"       label="Fotos fachada"   value={`${form.fotosFachada.length} adjuntas`}  filled={form.fotosFachada.length > 0} />
          <SummaryItem icon="video"       label="Videos"          value={`${form.videos.length} adjuntos`}        filled={form.videos.length > 0} />
          <SummaryItem icon="award"       label="Conc. firma"     value={form.firmaConcesionario.firma ? "Capturada" : "Sin capturar"} filled={!!form.firmaConcesionario.firma} />
          <SummaryItem icon="tool"        label="Prof. firma"     value={form.firmaProfesional.firma   ? "Capturada" : "Sin capturar"} filled={!!form.firmaProfesional.firma} />
          <View style={styles.uploadNote}>
            <Feather name="upload-cloud" size={12} color={C.textSecondary} />
            <Text style={styles.uploadNoteText}>

      Los archivos se depositarán en el servidor FTP en /uploads/[ID del registro]            
</Text>
          </View>
        </View>

        {/* ENVIAR */}
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

      {/* OVERLAY */}
      {sidebarOpen && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={closeSidebar}
        />
      )}

      {/* SIDEBAR */}
      <Animated.View
        style={[
          styles.sidebar,
          { paddingTop: topPadding + 8 },
          { transform: [{ translateX: sidebarAnim }] },
        ]}
      >
        <View style={styles.sidebarHeader}>
          <View style={styles.sidebarLogoRow}>
            <View style={styles.sidebarLogoBadge}>
              <Text style={styles.sidebarLogoText}>S</Text>
            </View>
            <View>
              <Text style={styles.sidebarAppName}>Sencia</Text>
              <Text style={styles.sidebarAppSub}>Actas de Vecindad</Text>
            </View>
          </View>
          <Pressable onPress={closeSidebar} hitSlop={8} style={styles.sidebarClose}>
            <Feather name="x" size={18} color={C.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.sidebarDivider} />

        <View style={[styles.sidebarItem, styles.sidebarItemActive]}>
          <View style={[styles.sidebarItemIcon, styles.sidebarItemIconActive]}>
            <Feather name="plus-circle" size={16} color="#fff" />
          </View>
          <View style={styles.sidebarItemText}>
            <Text style={[styles.sidebarItemLabel, styles.sidebarItemLabelActive]}>Nuevo Registro</Text>
            <Text style={styles.sidebarItemDesc}>Formulario actual</Text>
          </View>
        </View>

        {SIDEBAR_ITEMS.map((item) => (
          <Pressable
            key={item.route}
            style={({ pressed }) => [styles.sidebarItem, pressed && { opacity: 0.7 }]}
            onPress={() => navigateTo(item.route)}
          >
            <View style={styles.sidebarItemIcon}>
              <Feather name={item.icon} size={16} color={C.primary} />
            </View>
            <View style={styles.sidebarItemText}>
              <Text style={styles.sidebarItemLabel}>{item.label}</Text>
              <Text style={styles.sidebarItemDesc}>{item.description}</Text>
            </View>
            <Feather name="chevron-right" size={14} color={C.textSecondary} />
          </Pressable>
        ))}

        <View style={styles.sidebarDivider} />

        <View style={styles.sidebarFooter}>
          <View style={styles.sidebarUserRow}>
            <View style={styles.sidebarUserAvatar}>
              <Text style={styles.sidebarUserAvatarText}>
                {user?.username?.charAt(0).toUpperCase() ?? "U"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sidebarUserName}>{user?.username}</Text>
              <Text style={styles.sidebarUserRole}>Operador</Text>
            </View>
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [styles.sidebarLogoutBtn, pressed && { opacity: 0.6 }]}
              hitSlop={8}
            >
              <Feather name="log-out" size={16} color={C.error} />
            </Pressable>
          </View>
        </View>
      </Animated.View>

    </View>
  );
}

// ─────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────

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
      <View style={[styles.summaryIconWrap, filled && styles.summaryIconWrapFilled]}>
        <Feather name={icon} size={12} color={filled ? C.accent : C.textSecondary} />
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, filled && styles.summaryValueFilled]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// ESTILOS
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Top bar ─────────────────────────────────
  topBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 18, gap: 12,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center", alignItems: "center",
  },
  topBarCenter: { flex: 1 },
  topBarTitle:  { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.3 },
  topBarSub:    { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 1 },

  // ── Scroll / layout ─────────────────────────
  scroll:  { flex: 1 },
  content: { padding: 16, gap: 14 },

  // ── Tipo de acta ─────────────────────────────
  tipoActaCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 18, gap: 14,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  tipoActaLabel: {
    fontSize: 10, fontFamily: "Inter_700Bold",
    color: C.textSecondary, letterSpacing: 1.2, textTransform: "uppercase",
  },
  tipoActaRow:           { flexDirection: "row", gap: 10 },
  tipoActaBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 13, borderRadius: 13,
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.inputBg,
  },
  tipoActaBtnActive:     { backgroundColor: C.primary, borderColor: C.primary },
  tipoActaBtnText:       { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  tipoActaBtnTextActive: { color: "#fff" },

  // ── Sección genérica ─────────────────────────
  section: {
    backgroundColor: C.card, borderRadius: 20, overflow: "hidden",
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 18, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.card,
  },
  sectionIconBg: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: C.primary + "15",
    justifyContent: "center", alignItems: "center",
  },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.text, letterSpacing: -0.1 },
  sectionBody:  { padding: 18, gap: 14 },

  // ── Campos ───────────────────────────────────
  fieldContainer: { gap: 7 },
  fieldLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.6,
  },
  input: {
    backgroundColor: C.inputBg, borderRadius: 13,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, fontFamily: "Inter_400Regular", color: C.text,
  },
  inputMultiline:      { minHeight: 82,  textAlignVertical: "top", paddingTop: 13 },
  inputMultilineSmall: { minHeight: 58,  textAlignVertical: "top", paddingTop: 13 },
  inputIndented: {
    marginTop: 8, borderLeftWidth: 3,
    borderLeftColor: C.primary + "55", borderRadius: 10,
    backgroundColor: C.primary + "08",
  },
  inputError:     { borderColor: C.error, backgroundColor: C.error + "0A" },
  fieldError:     { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  fieldErrorText: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.error },

  // ── Hint correo ──────────────────────────────
  emailHint: {
    flexDirection: "row", alignItems: "flex-start", gap: 9,
    backgroundColor: C.primary + "0D", borderRadius: 11, padding: 12,
    borderLeftWidth: 3, borderLeftColor: C.primary,
  },
  emailHintText: {
    flex: 1, fontSize: 12, fontFamily: "Inter_400Regular",
    color: C.textSecondary, lineHeight: 18,
  },

  // ── InfoBox ──────────────────────────────────
  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 9,
    backgroundColor: C.primary + "0D", borderRadius: 11, padding: 12,
    borderLeftWidth: 3, borderLeftColor: C.primary,
  },
  infoText: {
    flex: 1, fontSize: 12, fontFamily: "Inter_400Regular",
    color: C.textSecondary, lineHeight: 18,
  },

  // ── Layout helpers ───────────────────────────
  row:     { flexDirection: "row", gap: 12 },
  rowHalf: { flex: 1 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 2 },

  // ── Servicios ────────────────────────────────
  servicesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  serviceItem:  { width: "47%", gap: 6 },
  serviceLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5,
  },
  serviceInput: { paddingVertical: 11, fontSize: 14 },

  // ── Uso actual ───────────────────────────────
  usoRow:           { flexDirection: "row", alignItems: "center", gap: 12 },
  usoLabel:         { width: 130, fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  usoInputContainer:{ flex: 1 },
  usoInput:         { paddingVertical: 10, fontSize: 14 },

  // ── Firma confirmación ───────────────────────
  sigConfirm:     { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  sigConfirmText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.accent },

  // ── Resumen ──────────────────────────────────
  summary: {
    backgroundColor: C.card, borderRadius: 20, padding: 18, gap: 10,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  summaryTitle: {
    fontSize: 13, fontFamily: "Inter_700Bold",
    color: C.text, marginBottom: 6, letterSpacing: -0.1,
  },
  summaryItem:            { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryIconWrap:        { width: 24, height: 24, borderRadius: 7, backgroundColor: C.border, justifyContent: "center", alignItems: "center" },
  summaryIconWrapFilled:  { backgroundColor: C.accent + "18" },
  summaryLabel:           { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textSecondary, width: 100 },
  summaryValue:           { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary },
  summaryValueFilled:     { color: C.text, fontFamily: "Inter_500Medium" },
  uploadNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 7,
    backgroundColor: C.inputBg, borderRadius: 10, padding: 10, marginTop: 4,
    borderWidth: 1, borderColor: C.border,
  },
  uploadNoteText: {
    flex: 1, fontSize: 11, fontFamily: "Inter_400Regular",
    color: C.textSecondary, lineHeight: 16,
  },

  // ── Botón enviar ─────────────────────────────
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: C.accent, borderRadius: 16, paddingVertical: 19, marginTop: 4,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  submitBtnPressed:  { opacity: 0.85, transform: [{ scale: 0.985 }] },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:        { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.2 },

  // ── Sidebar ──────────────────────────────────
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.38)", zIndex: 10 },
  sidebar: {
    position: "absolute", top: 0, left: 0, bottom: 0,
    width: SIDEBAR_WIDTH, backgroundColor: C.card, zIndex: 20,
    shadowColor: "#000", shadowOffset: { width: 5, height: 0 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 24,
  },
  sidebarHeader:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 16 },
  sidebarLogoRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  sidebarLogoBadge:  { width: 38, height: 38, borderRadius: 11, backgroundColor: C.primary, justifyContent: "center", alignItems: "center" },
  sidebarLogoText:   { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  sidebarAppName:    { fontSize: 15, fontFamily: "Inter_700Bold", color: C.text, letterSpacing: -0.2 },
  sidebarAppSub:     { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary },
  sidebarClose:      { width: 32, height: 32, borderRadius: 9, backgroundColor: C.inputBg, justifyContent: "center", alignItems: "center" },
  sidebarDivider:    { height: 1, backgroundColor: C.border, marginHorizontal: 18, marginVertical: 6 },

  sidebarItem:            { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 13 },
  sidebarItemActive:      { backgroundColor: C.primary + "10", borderRadius: 13, marginHorizontal: 8 },
  sidebarItemIcon:        { width: 34, height: 34, borderRadius: 10, backgroundColor: C.inputBg, justifyContent: "center", alignItems: "center" },
  sidebarItemIconActive:  { backgroundColor: C.primary },
  sidebarItemText:        { flex: 1 },
  sidebarItemLabel:       { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  sidebarItemLabelActive: { color: C.primary },
  sidebarItemDesc:        { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary, marginTop: 1 },

  sidebarFooter:         { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16 },
  sidebarUserRow:        { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.inputBg, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border },
  sidebarUserAvatar:     { width: 34, height: 34, borderRadius: 17, backgroundColor: C.primary, justifyContent: "center", alignItems: "center" },
  sidebarUserAvatarText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  sidebarUserName:       { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.text },
  sidebarUserRole:       { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary },
  sidebarLogoutBtn:      { width: 32, height: 32, borderRadius: 9, backgroundColor: C.error + "15", justifyContent: "center", alignItems: "center" },
});