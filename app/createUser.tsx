import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Rol = "inspector" | "admin" | "interventoria" | "";

interface FormState {
  nombre: string;
  documento: string;
  rol: Rol;
  password: string;
  password2: string;
  activo: boolean;
  esAdmin: boolean;
}

interface FormErrors {
  nombre?: string;
  documento?: string;
  rol?: string;
  password?: string;
  password2?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(nombre: string): string {
  const parts = nombre.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const map = [
    { label: "Ingresa una contraseña", color: C.border },
    { label: "Muy débil", color: "#E24B4A" },
    { label: "Débil", color: "#EF9F27" },
    { label: "Aceptable", color: "#639922" },
    { label: "Segura", color: C.primary },
  ];

  return { score, ...map[score] };
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (form.nombre.trim().length < 3)
    errors.nombre = "Ingresa el nombre completo";
  if (form.documento.trim().length < 5)
    errors.documento = "Documento inválido";
  if (!form.rol) errors.rol = "Selecciona un rol";
  if (form.password.length < 8)
    errors.password = "Mínimo 8 caracteres";
  if (form.password !== form.password2)
    errors.password2 = "Las contraseñas no coinciden";
  return errors;
}

// ─── Paleta (espeja Colors.light de tu proyecto) ─────────────────────────────

const C = {
  primary: "#185FA5",
  primaryLight: "#E6F1FB",
  primaryBorder: "#B5D4F4",
  background: "#F5F5F0",
  surface: "#FFFFFF",
  surfaceAlt: "#F1EFE8",
  text: "#1A1A1A",
  textSecondary: "#6B6A66",
  textTertiary: "#9B9A96",
  border: "#D3D1C7",
  borderStrong: "#B4B2A9",
  success: "#EAF3DE",
  successText: "#27500A",
  successBorder: "#97C459",
  danger: "#FCEBEB",
  dangerText: "#501313",
  dangerBorder: "#F09595",
};

// ─── Opciones de rol ──────────────────────────────────────────────────────────

const ROLES: { value: Rol; label: string }[] = [
  { value: "inspector", label: "Inspector" },
  { value: "admin", label: "Administrador" },
  { value: "interventoria", label: "Interventoría" },
];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CreateUserScreen() {
  const [form, setForm] = useState<FormState>({
    nombre: "",
    documento: "",
    rol: "",
    password: "",
    password2: "",
    activo: true,
    esAdmin: false,
  });

  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [loading, setLoading] = useState(false);

  const errors = validate(form);
  const isValid = Object.keys(errors).length === 0;

  const strength = getPasswordStrength(form.password);

  const set = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const touch = (key: keyof FormState) =>
    setTouched((prev) => ({ ...prev, [key]: true }));

  // ── Simula llamada al backend ──────────────────────────────────────────────
  // TODO: reemplazar por fetch real a POST /api/usuarios
  async function handleSubmit() {
    setTouched({
      nombre: true,
      documento: true,
      rol: true,
      password: true,
      password2: true,
    });

    if (!isValid) return;

    setLoading(true);
    try {
      await new Promise((res) => setTimeout(res, 1600));

      // Simula ~65% éxito / ~35% error
      const exito = Math.random() > 0.35;

      if (exito) {
        Alert.alert(
          "Usuario creado",
          `${form.nombre} ya puede iniciar sesión en el sistema.`,
          [{ text: "Aceptar", onPress: () => router.back() }]
        );
      } else {
        Alert.alert(
          "Error al crear usuario",
          "El número de documento ya existe o el servidor no respondió. Intenta de nuevo.",
          [{ text: "Entendido" }]
        );
      }
    } catch {
      Alert.alert("Error de red", "No se pudo conectar al servidor.");
    } finally {
      setLoading(false);
    }
  }

  const initials = getInitials(form.nombre);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Crear usuario</Text>
          <Text style={styles.headerSub}>Nuevo acceso al sistema</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar ── */}
        <View style={styles.avatarArea}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeIcon}>+</Text>
            </View>
          </View>
          <Text style={styles.avatarHint}>Iniciales generadas automáticamente</Text>
        </View>

        {/* ── Sección: Identificación ── */}
        <SectionLabel>Identificación</SectionLabel>

        <Field
          label="Nombre completo"
          error={touched.nombre ? errors.nombre : undefined}
        >
          <TextInput
            style={[styles.input, touched.nombre && errors.nombre ? styles.inputError : null]}
            placeholder="Ej. Carlos Rodríguez"
            placeholderTextColor={C.textTertiary}
            value={form.nombre}
            onChangeText={(v) => set("nombre", v)}
            onBlur={() => touch("nombre")}
            autoCapitalize="words"
          />
        </Field>

        <View style={styles.row}>
          <Field
            label="N.º documento"
            error={touched.documento ? errors.documento : undefined}
            style={{ flex: 1 }}
          >
            <TextInput
              style={[styles.input, touched.documento && errors.documento ? styles.inputError : null]}
              placeholder="Cédula"
              placeholderTextColor={C.textTertiary}
              value={form.documento}
              onChangeText={(v) => set("documento", v)}
              onBlur={() => touch("documento")}
              keyboardType="number-pad"
            />
          </Field>

          <Field
            label="Rol"
            error={touched.rol ? errors.rol : undefined}
            style={{ width: 140 }}
          >
            {/* Selector de rol como botones de opción */}
            <RolSelector
              value={form.rol}
              options={ROLES}
              hasError={!!(touched.rol && errors.rol)}
              onChange={(v) => { set("rol", v); touch("rol"); }}
            />
          </Field>
        </View>

        {/* ── Sección: Seguridad ── */}
        <SectionLabel>Seguridad</SectionLabel>

        <Field
          label="Contraseña"
          error={touched.password ? errors.password : undefined}
        >
          <TextInput
            style={[styles.input, touched.password && errors.password ? styles.inputError : null]}
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor={C.textTertiary}
            value={form.password}
            onChangeText={(v) => set("password", v)}
            onBlur={() => touch("password")}
            secureTextEntry
          />
          {/* Barra de fortaleza */}
          {form.password.length > 0 && (
            <View style={styles.strengthRow}>
              <View style={styles.strengthTrack}>
                <View
                  style={[
                    styles.strengthFill,
                    {
                      width: `${strength.score * 25}%` as any,
                      backgroundColor: strength.color,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>
                {strength.label}
              </Text>
            </View>
          )}
        </Field>

        <Field
          label="Confirmar contraseña"
          error={touched.password2 ? errors.password2 : undefined}
        >
          <TextInput
            style={[styles.input, touched.password2 && errors.password2 ? styles.inputError : null]}
            placeholder="Repite la contraseña"
            placeholderTextColor={C.textTertiary}
            value={form.password2}
            onChangeText={(v) => set("password2", v)}
            onBlur={() => touch("password2")}
            secureTextEntry
          />
        </Field>

        {/* ── Sección: Permisos ── */}
        <SectionLabel>Permisos</SectionLabel>

        <View style={styles.card}>
          <ToggleRow
            label="Usuario activo"
            subtitle="Puede iniciar sesión"
            value={form.activo}
            onChange={(v) => set("activo", v)}
            isLast={false}
          />
          <ToggleRow
            label="Administrador"
            subtitle="Acceso completo al panel"
            value={form.esAdmin}
            onChange={(v) => set("esAdmin", v)}
            isLast
          />
        </View>

        {/* ── Botón ── */}
        <TouchableOpacity
          style={[styles.btn, (!isValid || loading) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>Crear usuario</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function Field({
  label,
  error,
  children,
  style,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

function RolSelector({
  value,
  options,
  hasError,
  onChange,
}: {
  value: Rol;
  options: { value: Rol; label: string }[];
  hasError: boolean;
  onChange: (v: Rol) => void;
}) {
  return (
    <View style={[styles.rolContainer, hasError && styles.inputError]}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[
            styles.rolOption,
            value === opt.value && styles.rolOptionActive,
          ]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.rolLabel,
              value === opt.value && styles.rolLabelActive,
            ]}
            numberOfLines={1}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ToggleRow({
  label,
  subtitle,
  value,
  onChange,
  isLast,
}: {
  label: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isLast: boolean;
}) {
  return (
    <View style={[styles.toggleRow, !isLast && styles.toggleRowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: C.border, true: C.primary }}
        thumbColor="#fff"
        ios_backgroundColor={C.border}
      />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.background,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: C.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surfaceAlt,
    borderWidth: 0.5,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 24,
    color: C.text,
    lineHeight: 28,
    marginTop: -2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "500",
    color: C.text,
  },
  headerSub: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 1,
  },

  // Scroll
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },

  // Avatar
  avatarArea: {
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
    marginTop: 8,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.primaryLight,
    borderWidth: 2,
    borderColor: C.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "500",
    color: C.primary,
  },
  avatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadgeIcon: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "500",
  },
  avatarHint: {
    fontSize: 12,
    color: C.textSecondary,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },

  // Field
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 5,
  },
  fieldError: {
    fontSize: 11,
    color: "#A32D2D",
    marginTop: 4,
  },

  // Row layout
  row: {
    flexDirection: "row",
    gap: 10,
  },

  // Input
  input: {
    height: 46,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: C.borderStrong,
    backgroundColor: C.surfaceAlt,
    paddingHorizontal: 12,
    fontSize: 15,
    color: C.text,
  },
  inputError: {
    borderColor: "#E24B4A",
    borderWidth: 1,
  },

  // Password strength
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  strengthTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.border,
    overflow: "hidden",
  },
  strengthFill: {
    height: "100%",
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    minWidth: 70,
    textAlign: "right",
  },

  // Rol selector
  rolContainer: {
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: C.borderStrong,
    overflow: "hidden",
  },
  rolOption: {
    paddingVertical: 11,
    paddingHorizontal: 10,
    backgroundColor: C.surfaceAlt,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  rolOptionActive: {
    backgroundColor: C.primaryLight,
  },
  rolLabel: {
    fontSize: 13,
    color: C.textSecondary,
  },
  rolLabelActive: {
    color: C.primary,
    fontWeight: "500",
  },

  // Card (permisos)
  card: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: C.border,
    marginBottom: 20,
    overflow: "hidden",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  toggleRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  toggleLabel: {
    fontSize: 15,
    color: C.text,
  },
  toggleSub: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },

  // Botón
  btn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
});