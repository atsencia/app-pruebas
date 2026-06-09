import { useState, useCallback, useEffect } from "react";
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
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";

const C = Colors.light;

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Rol = "inspector" | "admin" | "";

interface FormState {
  nombre: string;
  documento: string;
  rol: Rol;
  password: string;
  password2: string;
  activo: boolean;
}

interface FormErrors {
  nombre?: string;
  documento?: string;
  rol?: string;
  password?: string;
  password2?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    { label: "Muy débil",              color: "#E24B4A" },
    { label: "Débil",                  color: "#EF9F27" },
    { label: "Aceptable",              color: "#639922" },
    { label: "Segura",                 color: C.primary },
  ];

  return { score, ...map[score] };
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (form.nombre.trim().length < 3)    errors.nombre    = "Ingresa el nombre completo";
  if (form.documento.trim().length < 5) errors.documento = "Documento inválido";
  if (!form.rol)                        errors.rol       = "Selecciona un rol";
  if (form.password.length < 8)         errors.password  = "Mínimo 8 caracteres";
  if (form.password !== form.password2) errors.password2 = "Las contraseñas no coinciden";
  return errors;
}

const ROLES: { value: Rol; label: string; icon: any }[] = [
  { value: "inspector", label: "Inspector",      icon: "user"   },
  { value: "admin",     label: "Administrador",  icon: "shield" },
];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CreateUserScreen() {
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();

  useEffect(() => {
    if (!user?.isAdmin) router.replace("/form");
  }, [user]);

  const [form, setForm] = useState<FormState>({
    nombre:    "",
    documento: "",
    rol:       "",
    password:  "",
    password2: "",
    activo:    true,
  });

  const [touched,  setTouched]  = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [loading,  setLoading]  = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  const errors  = validate(form);
  const isValid = Object.keys(errors).length === 0;
  const strength = getPasswordStrength(form.password);

  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const touch = (key: keyof FormState) =>
    setTouched((prev) => ({ ...prev, [key]: true }));

  async function handleSubmit() {
    setTouched({ nombre: true, documento: true, rol: true, password: true, password2: true });
    if (!isValid) return;

    setLoading(true);
    try {
      const response = await fetch("https://187.33.154.112.sslip.io/backend/api/users", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          nombre:    form.nombre.trim(),
          documento: form.documento.trim(),
          is_admin:  form.rol === "admin" ? 1 : 0,
          password:  form.password,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Error al crear el usuario");
      }

      Alert.alert(
        "Usuario creado",
        `${form.nombre} ya puede iniciar sesión en el sistema.`,
        [{ text: "Aceptar", onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert("Error al crear usuario", e.message || "No se pudo conectar al servidor.", [{ text: "Entendido" }]);
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: C.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* TOP BAR */}
      <View style={[styles.topBar, { paddingTop: topPadding + 10, backgroundColor: C.primary }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Crear usuario</Text>
          <Text style={styles.topBarSub}>Nuevo acceso al sistema</Text>
        </View>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── IDENTIFICACIÓN ── */}
        <Section icon="user" title="Identificación">
          <InfoBox text="Datos de acceso del nuevo usuario al sistema." />

          <Field label="Nombre completo" error={touched.nombre ? errors.nombre : undefined}>
            <TextInput
              style={[styles.input, touched.nombre && errors.nombre && styles.inputError]}
              placeholder="Ej. Carlos Rodríguez"
              placeholderTextColor={C.textSecondary}
              value={form.nombre}
              onChangeText={(v) => set("nombre", v)}
              onBlur={() => touch("nombre")}
              autoCapitalize="words"
            />
          </Field>

          <Field label="N.º documento" error={touched.documento ? errors.documento : undefined}>
            <TextInput
              style={[styles.input, touched.documento && errors.documento && styles.inputError]}
              placeholder="Cédula"
              placeholderTextColor={C.textSecondary}
              value={form.documento}
              onChangeText={(v) => set("documento", v)}
              onBlur={() => touch("documento")}
              keyboardType="number-pad"
            />
          </Field>

          <Field label="Rol" error={touched.rol ? errors.rol : undefined}>
            <View style={styles.rolRow}>
              {ROLES.map((opt) => {
                const active = form.rol === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={({ pressed }) => [
                      styles.rolBtn,
                      active && styles.rolBtnActive,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => { set("rol", opt.value); touch("rol"); }}
                  >
                    <Feather name={opt.icon} size={14} color={active ? "#fff" : C.textSecondary} />
                    <Text style={[styles.rolBtnText, active && styles.rolBtnTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>
        </Section>

        {/* ── SEGURIDAD ── */}
        <Section icon="lock" title="Seguridad">
          <Field label="Contraseña" error={touched.password ? errors.password : undefined}>
            <View style={styles.pwdRow}>
              <TextInput
                style={[styles.input, styles.pwdInput, touched.password && errors.password && styles.inputError]}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor={C.textSecondary}
                value={form.password}
                onChangeText={(v) => set("password", v)}
                onBlur={() => touch("password")}
                secureTextEntry={!showPwd}
              />
              <Pressable style={styles.pwdEye} onPress={() => setShowPwd(!showPwd)}>
                <Feather name={showPwd ? "eye-off" : "eye"} size={16} color={C.textSecondary} />
              </Pressable>
            </View>
            {form.password.length > 0 && (
              <View style={styles.strengthRow}>
                <View style={styles.strengthTrack}>
                  <View style={[styles.strengthFill, { width: `${strength.score * 25}%` as any, backgroundColor: strength.color }]} />
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
              </View>
            )}
          </Field>

          <Field label="Confirmar contraseña" error={touched.password2 ? errors.password2 : undefined}>
            <View style={styles.pwdRow}>
              <TextInput
                style={[styles.input, styles.pwdInput, touched.password2 && errors.password2 && styles.inputError]}
                placeholder="Repite la contraseña"
                placeholderTextColor={C.textSecondary}
                value={form.password2}
                onChangeText={(v) => set("password2", v)}
                onBlur={() => touch("password2")}
                secureTextEntry={!showPwd2}
              />
              <Pressable style={styles.pwdEye} onPress={() => setShowPwd2(!showPwd2)}>
                <Feather name={showPwd2 ? "eye-off" : "eye"} size={16} color={C.textSecondary} />
              </Pressable>
            </View>
          </Field>
        </Section>

        {/* ── PERMISOS ── */}
        <Section icon="shield" title="Permisos">
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleLabel}>Usuario activo</Text>
              <Text style={styles.toggleSub}>Puede iniciar sesión desde el primer día</Text>
            </View>
            <Switch
              value={form.activo}
              onValueChange={(v) => set("activo", v)}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor="#fff"
              ios_backgroundColor={C.border}
            />
          </View>
        </Section>

        {/* ── BOTÓN ── */}
        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            pressed && styles.submitBtnPressed,
            (!isValid || loading) && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={loading || !isValid}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="user-plus" size={18} color="#fff" />
              <Text style={styles.submitText}>Crear usuario</Text>
            </>
          )}
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

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

// ─── Estilos ──────────────────────────────────────────────────────────────────

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
  topBarTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.3 },
  topBarSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 1 },

  content: { padding: 16, gap: 14 },

  section: {
    backgroundColor: C.card, borderRadius: 20, overflow: "hidden",
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 18, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card,
  },
  sectionIconBg: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: C.primary + "15", justifyContent: "center", alignItems: "center",
  },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.text, letterSpacing: -0.1 },
  sectionBody:  { padding: 18, gap: 14 },

  fieldContainer: { gap: 7 },
  fieldLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  input: {
    backgroundColor: C.inputBg, borderRadius: 13, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, fontFamily: "Inter_400Regular", color: C.text,
  },
  inputError: { borderColor: C.error, backgroundColor: C.error + "0A" },
  fieldError: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  fieldErrorText: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.error },

  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 9,
    backgroundColor: C.primary + "0D", borderRadius: 11, padding: 12,
    borderLeftWidth: 3, borderLeftColor: C.primary,
  },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary, lineHeight: 18 },

  rolRow: { flexDirection: "row", gap: 10 },
  rolBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 13, borderRadius: 13, borderWidth: 1.5,
    borderColor: C.border, backgroundColor: C.inputBg,
  },
  rolBtnActive:     { backgroundColor: C.primary, borderColor: C.primary },
  rolBtnText:       { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.textSecondary },
  rolBtnTextActive: { color: "#fff" },

  pwdRow:  { position: "relative", justifyContent: "center" },
  pwdInput: { paddingRight: 46 },
  pwdEye:  {
    position: "absolute", right: 14,
    height: "100%", justifyContent: "center",
  },

  strengthRow:  { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  strengthTrack: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: C.border, overflow: "hidden",
  },
  strengthFill:  { height: "100%", borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontFamily: "Inter_500Medium", minWidth: 72, textAlign: "right" },

  toggleRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
  },
  toggleTextWrap: { flex: 1 },
  toggleLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  toggleSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary, marginTop: 2 },

  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: C.accent, borderRadius: 16, paddingVertical: 19, marginTop: 4,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  submitBtnPressed:  { opacity: 0.85, transform: [{ scale: 0.985 }] },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: -0.2 },
});