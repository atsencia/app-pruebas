import React, { useState, useRef, useEffect } from "react";
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
import { useLocalSearchParams } from "expo-router";
import { useFormStore } from '../store/zustand-state';



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

export interface FirmaPropietarioPredio {
  nombre:   string;
  correo:   string;
  celular:  string;
  firma:    string | null;
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

  // Campo extra UI — zona/apartamento (se concatena a direccion al enviar)
  tieneZona:  boolean;
  zonaDesc:   string;

  // Interventoría — campos completos en observaciones
  interCorreo: string;
  interNombre: string;
  interCargo:  string;

  firmaConcesionario: FirmaPersona;
  firmaProfesional:   FirmaPersona;

  // Firma del dueño del predio
  firmaPropietarioPredio: FirmaPropietarioPredio;

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

  fotos:        { uri: string; descripcion: string }[];
  fotosFachada: { uri: string; descripcion: string }[];
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
  { value: "inicio",      label: "Inicio"      },
  { value: "seguimiento", label: "Seguimiento" },
  { value: "cierre",      label: "Cierre"      },
];

const SERVICIOS = [
  { key: "servicioAgua",           label: "Agua"           },
  { key: "servicioAlcantarillado", label: "Alcantarillado" },
  { key: "servicioEnergia",        label: "Energía"        },
  { key: "servicioTelefono",       label: "Teléfono"       },
  { key: "servicioGas",            label: "Gas"            },
] as const;

// "Otros" en servicios es campo libre — se maneja aparte

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

// Opciones dropdown
const SERVICIO_OPTIONS = ["Si", "No", "No Aplica"];
const USO_OPTIONS      = ["Si", "No", "N/A"];

// ─────────────────────────────────────────────
// COMPONENTE: SELECT FIELD (dropdown nativo)
// ─────────────────────────────────────────────

interface SelectFieldProps {
  label:    string;
  value:    string;
  options:  string[];
  onChange: (v: string) => void;
  defaultEmpty?: string; // valor a mostrar si está vacío (placeholder)
}

function SelectField({ label, value, options, onChange, defaultEmpty }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const displayValue = value || defaultEmpty || options[0];

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        style={[styles.input, styles.selectBtn]}
        onPress={() => setOpen(!open)}
      >
        <Text style={[styles.selectBtnText, !value && { color: C.textSecondary }]}>
          {displayValue}
        </Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={C.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.selectDropdown}>
          {options.map((opt) => (
            <Pressable
              key={opt}
              style={[styles.selectOption, value === opt && styles.selectOptionActive]}
              onPress={() => { onChange(opt); setOpen(false); }}
            >
              <Text style={[styles.selectOptionText, value === opt && styles.selectOptionTextActive]}>
                {opt}
              </Text>
              {value === opt && <Feather name="check" size={13} color={C.primary} />}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE: SECCIÓN COLAPSABLE DE FIRMA
// ─────────────────────────────────────────────

interface FirmaSectionProps {
  icon: any;
  title: string;
  signed: boolean;
  children: React.ReactNode;
}

function FirmaSection({ icon, title, signed, children }: FirmaSectionProps) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    const toValue = open ? 0 : 1;
    setOpen(!open);
    Animated.timing(anim, { toValue, duration: 220, useNativeDriver: false }).start();
  };

  const bgColor = signed ? "#E6F4EA" : C.card;
  const borderColor = signed ? "#4CAF50" : C.border;
  const iconBgColor = signed ? "#C8E6C9" : C.primary + "15";
  const iconColor   = signed ? "#2E7D32" : C.primary;
  const chevron = open ? "chevron-up" : "chevron-down";

  return (
    <View style={[styles.section, { backgroundColor: bgColor, borderWidth: signed ? 1.5 : 0, borderColor }]}>
      <Pressable
        style={styles.sectionHeader}
        onPress={toggle}
        android_ripple={{ color: "rgba(0,0,0,0.05)" }}
      >
        <View style={[styles.sectionIconBg, { backgroundColor: iconBgColor }]}>
          <Feather name={icon} size={14} color={iconColor} />
        </View>
        <Text style={[styles.sectionTitle, signed && { color: "#2E7D32" }]}>{title}</Text>
        {signed && (
          <View style={styles.sigBadge}>
            <Feather name="check-circle" size={13} color="#2E7D32" />
            <Text style={styles.sigBadgeText}>Firmado</Text>
          </View>
        )}
        <Feather name={chevron} size={16} color={signed ? "#2E7D32" : C.textSecondary} style={{ marginLeft: "auto" }} />
      </Pressable>
      {open && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────

export default function FormScreen() {

  const form      = useFormStore((state) => state.formData);
  const setField  = useFormStore((state) => state.setField);
  const clearForm = useFormStore((state) => state.clearForm);

  const { registro_uuid } = useLocalSearchParams<{ registro_uuid?: string }>();
  const isEditing = !!registro_uuid;
  const [loadingActa, setLoadingActa] = useState(false);

  const insets           = useSafeAreaInsets();
  const { user, logout } = useAuth();

  // ── Sidebar ──────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!registro_uuid) return;

    const cargarActa = async () => {
      setLoadingActa(true);
      try {
        const response = await fetch(
          `https://187.33.154.112.sslip.io/backend/api/registros/${registro_uuid}/acta`,
          { headers: { "Authorization": `Bearer ${user?.token}` } }
        );
        if (!response.ok) throw new Error("No se pudo cargar el acta");
        const data = await response.json();

        const f = data.acta;
          setField("tipoActa",    f.tipoActa    ?? "");
          setField("nombre",      f.nombre      ?? "");
          setField("cedula",      f.cedula      ?? "");
          setField("direccion",   f.direccion   ?? "");
          setField("telefono",    f.telefono    ?? "");
          setField("propCorreo",  f.firmaPropietario?.correo   ?? "");
          setField("interCorreo", f.firmaInterventoria?.correo ?? "");
          setField("interNombre", f.firmaInterventoria?.nombre ?? "");
          setField("interCargo",  f.firmaInterventoria?.cargo  ?? "");
          setField("latitud",     f.georef?.latitud  ?? f.latitud  ?? null);
          setField("longitud",    f.georef?.longitud ?? f.longitud ?? null);
          setField("numeroPisos",          f.numeroPisos          ?? "");
          setField("estrato",              f.estrato              ?? "");
          setField("anioConstruccion",     f.anioConstruccion     ?? "");
          setField("longitudFrenteYFondo", f.longitudFrenteYFondo ??  "");
          setField("estaOcupada",          f.estaOcupada          ??  false);
          setField("servicioAgua",           f.servicioAgua           ??  "");
          setField("servicioAlcantarillado", f.servicioAlcantarillado ??  "");
          setField("servicioEnergia",        f.servicioEnergia        ??  "");
          setField("servicioTelefono",       f.servicioTelefono       ?? "");
          setField("servicioGas",            f.servicioGas            ?? "");
          setField("servicioOtros",          f.servicioOtros          ?? "");
          setField("tieneGaraje",          f.tieneGaraje          ?? false);
          setField("cantidadGarajes",      f.cantidadGarajes      ?? "");
          setField("anchoAccesoVehicular", f.anchoAccesoVehicular ?? "");
          setField("fisurasCerradas",     f.fisurasCerradas     ?? false);
          setField("fisurasCerradasDesc", f.fisurasCerradasDesc ?? "");
          setField("fisurasAbiertas",     f.fisurasAbiertas     ?? false);
          setField("fisurasAbiertasDesc", f.fisurasAbiertasDesc ?? "");
          setField("grietas",             f.grietas             ?? false);
          setField("grietasDesc",         f.grietasDesc         ?? "");
          setField("acabadosPisos",  f.acabadosPisos  ?? "");
          setField("estadoFachada",  f.estadoFachada  ?? "");
          setField("verticalidad",      f.verticalidad      ?? false);
          setField("verticalidadNotas", f.verticalidadNotas ?? "");
          setField("planTopografico",          f.planTopografico          ?? false);
          setField("observacionesProfesional", f.observacionesProfesional ?? "");
          setField("firmaConcesionario",     f.firmaConcesionario     ?? { nombre: "", cedula: "", cargo: "", firma: null });
          setField("firmaProfesional",       f.firmaProfesional       ?? { nombre: "", cedula: "", cargo: "", firma: null });
          setField("firmaPropietarioPredio", f.firmaPropietarioPredio ?? { nombre: "", correo: "", celular: "", firma: null });
          setField("fotos", data.multimedia?.fotos?.map((ff: any) => ({
            uri: ff.url, descripcion: ff.descripcion ?? "",
          })) ?? []);
          setField("fotosFachada", data.multimedia?.fotosFachada?.map((ff: any) => ({
            uri: ff.url, descripcion: ff.descripcion ?? "",
          })) ?? []);
          setField("videos", data.multimedia?.videos?.map((v: any) => ({
            uri: v.url, thumbnail: null, duration: null, filename: v.nombre,
          })) ?? []);
      } catch (e: any) {
        Alert.alert("Error", "No se pudo cargar el acta para editar");
      } finally {
        setLoadingActa(false);
      }
    };

    cargarActa();
  }, [registro_uuid, user?.token]);

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

  const [errors,       setErrors]      = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const topPadding    = Platform.OS === "web" ? Math.max(insets.top, 67)    : insets.top;
  const bottomPadding = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const pisos            = parseInt(form.numeroPisos, 10);
  const showVerticalidad = !isNaN(pisos) && pisos >= 4;

  const set = (key: keyof FormData, value: any) => setField(key, value);

  const setFirma = (
    who: "firmaConcesionario" | "firmaProfesional",
    field: keyof FirmaPersona,
    value: any
  ) => setField(who, { ...form[who], [field]: value });

  const setFirmaProp = (field: keyof FirmaPropietarioPredio, value: any) =>
    setField("firmaPropietarioPredio", { ...form.firmaPropietarioPredio, [field]: value });

  // Dirección final concatenada con zona (para enviar al backend)
const direccionFinal = (): string => {
  const base = (form.direccion ?? "").trim();
  if (form.tieneZona && (form.zonaDesc ?? "").trim()) {
    return `${base}, ${(form.zonaDesc ?? "").trim()}`;
  }
  return base;
};

  // ── Validación ──────────────────────────────
  const validate = (): boolean => {
    const e: FieldErrors = {};  
    if (!(form.nombre   ?? "").trim()) e.nombre    = "El nombre es requerido";
    if (!(form.cedula ?? "").trim()) {
      e.cedula = "La cédula es requerida";
    } else if (!/^\d{6,12}$/.test((form.cedula ?? "").trim())) {
      e.cedula = "La cédula debe tener entre 6 y 12 dígitos";
    }    
  if (!(form.direccion ?? "").trim()) e.direccion = "La dirección es requerida";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── JSON objetivo ───────────────────────────
  const buildDatos = () => ({
    tipoActa:  form.tipoActa,
    nombre:    (form.nombre      ?? "").trim(),
    cedula:    (form.cedula      ?? "").trim(),
    direccion: direccionFinal(),   // ← dirección con zona concatenada
    telefono:  (form.telefono    ?? "").trim(),
    georef:    { latitud: form.latitud, longitud: form.longitud },
    latitud:   form.latitud,
    longitud:  form.longitud,
    longitudFrenteYFondo: form.longitudFrenteYFondo,
    numeroPisos:          form.numeroPisos,
    estrato:              form.estrato,
    anioConstruccion:     form.anioConstruccion,
    estaOcupada:          form.estaOcupada,
    servicioAgua:           form.servicioAgua           || "No Aplica",
    servicioAlcantarillado: form.servicioAlcantarillado || "No Aplica",
    servicioEnergia:        form.servicioEnergia        || "No Aplica",
    servicioTelefono:       form.servicioTelefono       || "No Aplica",
    servicioGas:            form.servicioGas            || "No Aplica",
    servicioOtros:          form.servicioOtros,
    usoResidencial:   form.usoResidencial   || "N/A",
    usoComercial:     form.usoComercial     || "N/A",
    usoIndustrial:    form.usoIndustrial    || "N/A",
    usoInstitucional: form.usoInstitucional || "N/A",
    usoRecreacional:  form.usoRecreacional  || "N/A",
    usoBaldio:        form.usoBaldio        || "N/A",
    usoBIC:           form.usoBIC           || "N/A",
    usoMixto:         form.usoMixto         || "N/A",
    usoOtro:          form.usoOtro          || "N/A",
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
      nombre: (form.nombre ?? "").trim(),
      cedula: (form.cedula ?? "").trim(),
      cargo:  "",
      firma:  null,
      correo: (form.propCorreo  ?? "").trim(),
    },
    firmaInterventoria: {
      nombre: (form.interNombre ?? "").trim(),
      cedula: "",
      cargo:  (form.interCargo  ?? "").trim(),
      firma:  null,
      correo: (form.interCorreo ?? "").trim(),
    },
    firmaConcesionario:    form.firmaConcesionario,
    firmaProfesional:      form.firmaProfesional,
    firmaPropietarioPredio: form.firmaPropietarioPredio,
    fotosCount:        form.fotos.length,
    fotosFachadaCount: form.fotosFachada.length,
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
          nombre:   (form.nombre ?? "").trim(),
          apellido:  (form.cedula ?? "").trim(),
          direccion: direccionFinal(),
          georef:    { latitud: form.latitud, longitud: form.longitud },
          fotos:        form.fotos,
          fotosFachada: form.fotosFachada,
          videos:       form.videos.map((v: any) => ({ uri: v.uri })),
          extra:        buildDatos(),
          registro_uuid: isEditing ? registro_uuid : undefined,
          revisado_por: user?.username ?? null,
        },
        (porcentaje: any, mensaje: any) => console.log(`[FTP] ${porcentaje}% — ${mensaje}`)
      );
      if (!resultado.success) throw new Error(resultado.mensaje);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: "/success",
        params: {
          numeroRegistro:     resultado.id,
          nombre:             (form.nombre ?? "").trim(),
          fotosCount:         String(form.fotos.length),
          fotosFachadaCount:  String(form.fotosFachada.length),
          videosCount:        String(form.videos.length),
        },
      });

      clearForm();

    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", e.message || "No se pudo enviar el registro");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => { await logout(); router.replace("/login"); };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
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
          <Text style={styles.topBarTitle}>
            {isEditing ? "Editar Registro" : "Nuevo Registro"}
          </Text>
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

          {/* ── ZONA / APARTAMENTO ────────────────────── */}
          <ToggleField
            label="¿El predio se divide en zonas / apartamentos?"
            value={form.tieneZona ?? false}
            onChange={(v) => {
              set("tieneZona", v);
              if (!v) set("zonaDesc", "");
            }}
          />
          {(form.tieneZona) && (
            <View style={styles.zonaContainer}>
              {/* <Feather name="layers" size={13} color={C.primary} style={{ marginTop: 2 }} /> */}
              <View style={{ flex: 1, gap: 6 }}>
                <TextInput
                  style={[styles.input, styles.zonaInput]}
                  placeholder="Ej. Torre 1 Apto 234 / Zona B"
                  placeholderTextColor={C.textSecondary}
                  value={form.zonaDesc ?? ""}
                  onChangeText={(v) => set("zonaDesc", v)}
                />
                {form.zonaDesc?.trim() ? (
                  <View style={styles.zonaPreview}>
                    <Feather name="eye" size={11} color={C.primary} />
                    <Text style={styles.zonaPreviewText} numberOfLines={2}>
                      Se enviará como: {form.direccion.trim()
                        ? `${form.direccion.trim()}, ${form.zonaDesc.trim()}`
                        : form.zonaDesc.trim()}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}
          {/* ────────────────────────────────────────────── */}

        </Section>

        {/* 2. INTERVENTORÍA */}
        <Section icon="briefcase" title="Interventoría">
          <InfoBox text="Datos del representante delegado. Esta información se guardará en observaciones del acta." />
          <Field label="Nombre del delegado">
            <TextInput
              style={styles.input}
              placeholder="Nombre y apellidos"
              placeholderTextColor={C.textSecondary}
              value={form.interNombre}
              onChangeText={(v) => set("interNombre", v)}
            />
          </Field>
          <Field label="Cargo">
            <TextInput
              style={styles.input}
              placeholder="Ej. Ingeniero Inspector"
              placeholderTextColor={C.textSecondary}
              value={form.interCargo}
              onChangeText={(v) => set("interCargo", v)}
            />
          </Field>
          <Field label="Correo del delegado">
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
          <InfoBox text="Seleccione el estado de cada servicio. En 'Otros' describa servicios adicionales." />
          <View style={styles.servicesGrid}>
            {SERVICIOS.map(({ key, label }) => (
              <View key={key} style={styles.serviceItem}>
                <SelectField
                  label={label}
                  value={(form as any)[key]}
                  options={SERVICIO_OPTIONS}
                  onChange={(v) => set(key as keyof FormData, v)}
                  defaultEmpty="No Aplica"
                />
              </View>
            ))}
            {/* Otros — campo libre */}
            <View style={styles.serviceItem}>
              <Field label="Otros">
                <TextInput
                  style={[styles.input, styles.serviceInput]}
                  placeholder="Describa cuál..."
                  placeholderTextColor={C.textSecondary}
                  value={form.servicioOtros}
                  onChangeText={(v) => set("servicioOtros", v)}
                />
              </Field>
            </View>
          </View>
        </Section>

        {/* 5. USO ACTUAL */}
        <Section icon="layers" title="Uso Actual del Predio">
          <InfoBox text="Seleccione el uso. Sin selección se enviará como 'N/A'." />
          {USOS_ACTUALES.map(({ key, label }) => (
            <View key={key} style={styles.usoRow}>
              <Text style={styles.usoLabel}>{label}</Text>
              <View style={styles.usoInputContainer}>
                <SelectField
                  label=""
                  value={(form as any)[key]}
                  options={USO_OPTIONS}
                  onChange={(v) => set(key as keyof FormData, v)}
                  defaultEmpty="N/A"
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

        {/* 8. VERTICALIDAD (condicional) */}
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

        {/* 9. DOCUMENTACIÓN ADICIONAL */}
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

        {/* ══════════════════════════════════════════════
            10. SECCIÓN FACHADA — Georef + Acabados + Fotos
            ══════════════════════════════════════════════ */}
        <Section icon="map" title="Inspección de Fachada y Ubicación">
          <InfoBox text="Registra la ubicación del predio, el estado exterior, y adjunta las fotografías de fachada." />

          {/* Georeferenciación */}
          <View style={styles.fachadaSubHeader}>
            <View style={styles.fachadaSubIconBg}>
              <Feather name="map-pin" size={12} color={C.primary} />
            </View>
            <Text style={styles.fachadaSubTitle}>Georeferenciación</Text>
          </View>
          <MapPicker
            latitud={form.latitud}
            longitud={form.longitud}
            onLocationChange={(lat, lng) => {
              setField("latitud", lat);
              setField("longitud", lng);
            }}
          />

          <View style={styles.fachadaDivider} />

          {/* Acabados y Fachada */}
          <View style={styles.fachadaSubHeader}>
            <View style={styles.fachadaSubIconBg}>
              <Feather name="grid" size={12} color={C.primary} />
            </View>
            <Text style={styles.fachadaSubTitle}>Acabados y Estado de Fachada</Text>
          </View>
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

          <View style={styles.fachadaDivider} />

          {/* Fotografías de Fachada */}
          <View style={styles.fachadaSubHeader}>
            <View style={styles.fachadaSubIconBg}>
              <Feather name="image" size={12} color={C.primary} />
            </View>
            <Text style={styles.fachadaSubTitle}>Fotografías de Fachada</Text>
          </View>
          <Text style={styles.fachadaSubDesc}>
            Fotos del exterior del predio. Se guardarán como fachada_001.jpg, fachada_002.jpg, etc.
          </Text>
           
          <PhotoPickerSection
            photos={form.fotosFachada}
            onPhotosChange={(fotos) => set("fotosFachada", fotos)}
              />
        </Section>

        {/* 11. FOTOGRAFÍAS GENERALES */}
        <Section icon="camera" title="Fotografías Generales">
          <InfoBox text="Fotos del interior, estructura, y demás elementos del predio." />
         <PhotoPickerSection
            photos={form.fotos}
            onPhotosChange={(fotos) => set("fotos", fotos)}
            showDescription={true}
          maxPhotos={15}
              />
        </Section>

        {/* 12. VIDEOS */}
        <Section icon="video" title="Videos">
          <VideoPickerSection
            videos={form.videos}
            onVideosChange={(videos) => set("videos", videos)}
          />
        </Section>

        {/* 13. FIRMA — DUEÑO DEL PREDIO (colapsable) */}
        <FirmaSection
          icon="home"
          title="Firma del Dueño del Predio"
          signed={!!form.firmaPropietarioPredio.firma}
        >
          <InfoBox text="Datos de contacto y firma manuscrita del propietario o residente del predio." />
          <View style={styles.row}>
            <View style={styles.rowHalf}>
              <Field label="Nombre completo">
                <TextInput
                  style={styles.input}
                  placeholder="Nombre y apellidos"
                  placeholderTextColor={C.textSecondary}
                  value={form.firmaPropietarioPredio.nombre}
                  onChangeText={(v) => setFirmaProp("nombre", v)}
                />
              </Field>
            </View>
            <View style={styles.rowHalf}>
              <Field label="Celular">
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 3001234567"
                  placeholderTextColor={C.textSecondary}
                  value={form.firmaPropietarioPredio.celular}
                  onChangeText={(v) => setFirmaProp("celular", v.replace(/\D/g, ""))}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </Field>
            </View>
          </View>
          <Field label="Correo electrónico">
            <TextInput
              style={styles.input}
              placeholder="propietario@correo.com"
              placeholderTextColor={C.textSecondary}
              value={form.firmaPropietarioPredio.correo}
              onChangeText={(v) => setFirmaProp("correo", v.trim())}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Field>
          <View style={styles.emailHint}>
            <Feather name="mail" size={13} color={C.primary} />
            <Text style={styles.emailHintText}>
              Se enviará un enlace a este correo para que el propietario complete y firme el acta.
            </Text>
          </View>
          <Field label="Firma">
            <SignaturePad
              onSignatureChange={(sig) => setFirmaProp("firma", sig)}
            />
          </Field>
          {form.firmaPropietarioPredio.firma && (
            <View style={styles.sigConfirm}>
              <Feather name="check-circle" size={13} color="#2E7D32" />
              <Text style={[styles.sigConfirmText, { color: "#2E7D32" }]}>Firma capturada</Text>
            </View>
          )}
        </FirmaSection>

        {/* 14. FIRMA — CONCESIONARIO (colapsable) */}
        <FirmaSection
          icon="award"
          title="Representante Delegado Sencia S.A.S."
          signed={!!form.firmaConcesionario.firma}
        >
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
              <Feather name="check-circle" size={13} color="#2E7D32" />
              <Text style={[styles.sigConfirmText, { color: "#2E7D32" }]}>Firma capturada</Text>
            </View>
          )}
        </FirmaSection>

        {/* 15. FIRMA — PROFESIONAL TÉCNICO (colapsable) */}
        <FirmaSection
          icon="tool"
          title="Profesional Técnico"
          signed={!!form.firmaProfesional.firma}
        >
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
              <Feather name="check-circle" size={13} color="#2E7D32" />
              <Text style={[styles.sigConfirmText, { color: "#2E7D32" }]}>Firma capturada</Text>
            </View>
          )}
        </FirmaSection>

        {/* RESUMEN */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Resumen del Registro</Text>
          <SummaryItem icon="file-text"   label="Tipo acta"       value={form.tipoActa ? form.tipoActa.charAt(0).toUpperCase() + form.tipoActa.slice(1) : "—"} filled={!!form.tipoActa} />
          <SummaryItem icon="user"        label="Nombre"          value={(form.nombre      ?? "").trim() || "—"}  filled={!!(form.nombre      ?? "").trim()} />
          <SummaryItem icon="credit-card" label="Cédula"          value={(form.cedula      ?? "").trim() || "—"}  filled={!!(form.cedula      ?? "").trim()} />
          <SummaryItem icon="map-pin"     label="Dirección"       value={direccionFinal()         || "—"} filled={!!direccionFinal()} />
          <SummaryItem icon="briefcase"   label="Inter. nombre"   value={(form.interNombre ?? "").trim() || "—"}  filled={!!(form.interNombre ?? "").trim()} />
          <SummaryItem icon="mail"        label="Inter. correo"   value={(form.interCorreo ?? "").trim() || "—"}  filled={!!(form.interCorreo ?? "").trim()} />
          <SummaryItem icon="home"        label="Pisos"           value={form.numeroPisos ? `${form.numeroPisos} pisos — estrato ${form.estrato || "?"}` : "—"} filled={!!form.numeroPisos} />
          <SummaryItem icon="map-pin"     label="Ubicación"       value={form.latitud !== null ? "Capturada" : "Sin capturar"} filled={form.latitud !== null} />
          <SummaryItem icon="camera"      label="Fotos generales" value={`${form.fotos.length} adjuntas`}        filled={form.fotos.length > 0} />
          <SummaryItem icon="image"       label="Fotos fachada"   value={`${form.fotosFachada.length} adjuntas`} filled={form.fotosFachada.length > 0} />
          <SummaryItem icon="video"       label="Videos"          value={`${form.videos.length} adjuntos`}       filled={form.videos.length > 0} />
          <SummaryItem icon="home"        label="Firma propiet."  value={form.firmaPropietarioPredio.firma ? "Capturada" : "Sin capturar"} filled={!!form.firmaPropietarioPredio.firma} />
          <SummaryItem icon="award"       label="Conc. firma"     value={form.firmaConcesionario.firma ? "Capturada" : "Sin capturar"} filled={!!form.firmaConcesionario.firma} />
          <SummaryItem icon="tool"        label="Prof. firma"     value={form.firmaProfesional.firma   ? "Capturada" : "Sin capturar"} filled={!!form.firmaProfesional.firma} />
          <View style={styles.uploadNote}>
            <Feather name="upload-cloud" size={12} color={C.textSecondary} />
            <Text style={styles.uploadNoteText}>
              Los archivos se depositarán en el servidor FTP en /uploads/[ID del registro]
            </Text>
          </View>
        </View>

        {Object.keys(errors).length > 0 && (
          <View style={styles.errorSummary}>
            <View style={styles.errorSummaryHeader}>
              <Feather name="alert-circle" size={16} color="#E53E3E" />
              <Text style={styles.errorSummaryTitle}>
                Hay {Object.keys(errors).length} campo{Object.keys(errors).length > 1 ? "s" : ""} con error
              </Text>
            </View>
            {errors.nombre    && <Text style={styles.errorSummaryItem}>• Nombre: {errors.nombre}</Text>}
            {errors.cedula    && <Text style={styles.errorSummaryItem}>• Cédula: {errors.cedula}</Text>}
            {errors.direccion && <Text style={styles.errorSummaryItem}>• Dirección: {errors.direccion}</Text>}
          </View>
        )}

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
              <Feather name={isEditing ? "edit-2" : "upload-cloud"} size={18} color="#fff" />
              <Text style={styles.submitText}>
                {isEditing ? "Guardar Cambios" : "Enviar Registro"}
              </Text>
            </>
          )}
        </Pressable>

      </ScrollView>

      {/* OVERLAY */}
      {sidebarOpen && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeSidebar} />
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
                {(user?.nombre ?? user?.username)?.charAt(0).toUpperCase() ?? "U"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sidebarUserName}>{user?.nombre ?? user?.username}</Text>
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

      {loadingActa && (
        <View style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(255,255,255,0.85)", zIndex: 50,
          justifyContent: "center", alignItems: "center", gap: 12,
        }}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: C.textSecondary }}>
            Cargando datos del registro...
          </Text>
        </View>
      )}
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
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
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

  scroll:  { flex: 1 },
  content: { padding: 16, gap: 14 },

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

  // Badge "Firmado"
  sigBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#E6F4EA", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
    marginLeft: 8,
  },
  sigBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#2E7D32" },

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

  // Zona / Apartamento
  zonaContainer: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: C.primary + "08", borderRadius: 12,
    borderWidth: 1.5, borderColor: C.primary + "30",
    padding: 12, marginTop: 4,
  },
  zonaInput: { marginBottom: 0 },
  zonaPreview: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: C.primary + "12", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  zonaPreviewText: {
    flex: 1, fontSize: 12, fontFamily: "Inter_400Regular",
    color: C.primary, lineHeight: 17,
  },

  // Select dropdown
  selectBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  selectBtnText: {
    fontSize: 15, fontFamily: "Inter_400Regular", color: C.text, flex: 1,
  },
  selectDropdown: {
    backgroundColor: C.card, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
    overflow: "hidden", marginTop: 2,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 4,
  },
  selectOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  selectOptionActive:     { backgroundColor: C.primary + "10" },
  selectOptionText:       { fontSize: 15, fontFamily: "Inter_400Regular", color: C.text },
  selectOptionTextActive: { fontFamily: "Inter_600SemiBold", color: C.primary },

  emailHint: {
    flexDirection: "row", alignItems: "flex-start", gap: 9,
    backgroundColor: C.primary + "0D", borderRadius: 11, padding: 12,
    borderLeftWidth: 3, borderLeftColor: C.primary,
  },
  emailHintText: {
    flex: 1, fontSize: 12, fontFamily: "Inter_400Regular",
    color: C.textSecondary, lineHeight: 18,
  },

  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 9,
    backgroundColor: C.primary + "0D", borderRadius: 11, padding: 12,
    borderLeftWidth: 3, borderLeftColor: C.primary,
  },
  infoText: {
    flex: 1, fontSize: 12, fontFamily: "Inter_400Regular",
    color: C.textSecondary, lineHeight: 18,
  },

  row:     { flexDirection: "row", gap: 12 },
  rowHalf: { flex: 1 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 2 },

  servicesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  serviceItem:  { width: "47%" },
  serviceLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5,
  },
  serviceInput: { paddingVertical: 11, fontSize: 14 },

  usoRow:           { flexDirection: "row", alignItems: "center", gap: 12 },
  usoLabel:         { width: 130, fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  usoInputContainer:{ flex: 1 },
  usoInput:         { paddingVertical: 10, fontSize: 14 },

  // Fachada sub-sección (dentro de la sección unificada)
  fachadaDivider: {
    height: 1, backgroundColor: C.border, marginVertical: 6,
  },
  fachadaSubHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4,
  },
  fachadaSubIconBg: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: C.primary + "18",
    justifyContent: "center", alignItems: "center",
  },
  fachadaSubTitle: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: C.text, letterSpacing: -0.1,
  },
  fachadaSubDesc: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: C.textSecondary, lineHeight: 17, marginBottom: 8,
    marginLeft: 34,
  },

  sigConfirm:     { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  sigConfirmText: { fontSize: 12, fontFamily: "Inter_500Medium", color: C.accent },

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

  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: C.accent, borderRadius: 16, paddingVertical: 19, marginTop: 4,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  submitBtnPressed:  { opacity: 0.85, transform: [{ scale: 0.985 }] },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:        { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.2 },

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

  errorSummary: {
    backgroundColor: "#FFF5F5", borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: "#FEB2B2", gap: 8,
  },
  errorSummaryHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  errorSummaryTitle:  { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#E53E3E" },
  errorSummaryItem:   { fontSize: 13, fontFamily: "Inter_400Regular", color: "#C53030", paddingLeft: 4 },
});