import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import RegistroCard from "@/components/RegistroCard";
import RegistroDetailSheet from "@/components/Registrodetailsheet";
import { useAuth } from "@/contexts/AuthContext";

const C = Colors.light;

const FILTROS = [
  { key: "todos", label: "Todos" },
  { key: "inicio", label: "Inicio" },
  { key: "seguimiento", label: "Seguimiento" },
  { key: "fin", label: "Fin" },
];

export type Registro = {
  id: number;
  nombre: string;
  cedula: string;
  direccion: string;
  tipo_acta: string;
  carpeta: string;
  registro_uuid: string;    // ← nuevo
  prop_correo: string | null;  // ← renombrado
  inter_correo: string | null; // ← renombrado
  estado: string;
};

export default function SearchScreen() {
  const [modoDevueltas, setModoDevueltas] = useState(false);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [selected, setSelected] = useState<Registro | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<Registro[]>([]);
  const [error, setError] = useState<string | null>(null);

  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const fetchRegistros = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://187.33.154.112.sslip.io/backend/api/registros/buscar?q=${encodeURIComponent(q)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user?.token}`,
        },
      });

      if (!response.ok) throw new Error("Error al buscar registros");

      const data = await response.json();
      console.log("Datos recibidos del backend:", data);
      // Ajusta según lo que devuelva el backend
      const lista = Array.isArray(data) ? data : data.registros ?? data.data ?? [];

      // Filtro local por tipoActa
      const filtrados = filtro === "todos"
        ? lista
        : lista.filter((r: Registro) => r.tipo_acta === filtro);

      setResultados(filtrados);
    } catch (e: any) {
      setError(e.message || "No se pudo conectar al servidor");
      setResultados([]);
    } finally {
      setLoading(false);
    }
  }, [user?.token, filtro]);


  const fetchDevueltas = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const url = `https://187.33.154.112.sslip.io/backend/api/registros/devueltos`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${user?.token}`,
      },
    });
    if (!response.ok) throw new Error("Error al obtener devueltas");
    const data = await response.json();
    setResultados(data.data ?? []);
  } catch (e: any) {
    setError(e.message || "No se pudo conectar");
    setResultados([]);
  } finally {
    setLoading(false);
  }
}, [user?.token]);


  // Debounce de 2 segundos
  useEffect(() => {

      if (modoDevueltas) {
    fetchDevueltas();
    return;
  }
    const timer = setTimeout(() => {
      fetchRegistros(query);
    }, 1000);

    return () => clearTimeout(timer);
}, [query, filtro, fetchRegistros, modoDevueltas, fetchDevueltas]);

  const handleEnviarLink = (registro: Registro) => {
    setSelected(registro);
    setSheetVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  
  return (
    <View style={[styles.root, { backgroundColor: C.background }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: topPadding + 8 }]}>
        <Pressable
          onPress={() => router.push("/form")}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={18} color="#fff" />
        </Pressable>
        <View style={styles.topBarTitleWrap}>
          <Text style={styles.topBarTitle}>Buscar Registros</Text>
          <Text style={styles.topBarSub}>Actas de vecindad</Text>
        </View>
      </View>

      {/* Search input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrap}>
          <Feather name="search" size={16} color={C.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Nombre, documento, dirección..."
            placeholderTextColor={C.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {loading
            ? <ActivityIndicator size="small" color={C.primary} />
            : query.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Feather name="x" size={15} color={C.textSecondary} />
              </Pressable>
            )
          }
        </View>
        {query.length > 0 && !loading && (
          <Text style={styles.debounceHint}>Buscando en 2 segundos...</Text>
        )}
      </View>

      {/* Filtros */}
      <View style={styles.filtrosRow}>
        <FlatList
          data={FILTROS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.chip, filtro === item.key && styles.chipActive]}
              onPress={() => setFiltro(item.key)}
            >
              <Text style={[styles.chipText, filtro === item.key && styles.chipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Contador */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {loading
            ? "Buscando..."
            : error
            ? error
            : resultados.length === 0
            ? "Sin resultados"
            : resultados.length === 1
            ? "1 registro encontrado"
            : `${resultados.length} registros encontrados`}
        </Text>
      </View>



{/* Botón Actas Devueltas */}
<View style={styles.devueltasRow}>
  <Pressable
    style={[styles.btnDevueltas, modoDevueltas && styles.btnDevueltasActive]}
    onPress={() => {
      setModoDevueltas(!modoDevueltas);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }}
  >
    <Feather
      name="rotate-ccw"
      size={13}
      color={modoDevueltas ? "#fff" : "#D97706"}
    />
    <Text style={[styles.btnDevueltasText, modoDevueltas && styles.btnDevueltasTextActive]}>
      Actas devueltas
    </Text>
  </Pressable>
</View>
      {/* Lista */}
      <FlatList
        data={resultados}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Feather name="search" size={36} color={C.textSecondary} style={{ opacity: 0.3, marginBottom: 12 }} />
              <Text style={styles.emptyText}>
                {query ? `Sin resultados para "${query}"` : "Ingresa un término para buscar"}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <RegistroCard
            registro={item}
            onEnviarLink={() => handleEnviarLink(item)}
          />
        )}
      />

      {/* Bottom sheet */}
      <RegistroDetailSheet
        visible={sheetVisible}
        registro={selected}
        onClose={() => setSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a3a6b",
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
  },
  topBarTitleWrap: { flex: 1 },
  topBarTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  topBarSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 2 },
  searchContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#F3F4F6", borderRadius: 10, paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1, fontSize: 15, fontFamily: "Inter_400Regular",
    paddingVertical: 10, color: "#111",
  },
  debounceHint: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: C.textSecondary, marginTop: 6, marginLeft: 4,
  },
  filtrosRow: {
    backgroundColor: "#fff", paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB",
  },
  chip: {
    borderWidth: 0.5, borderColor: "#D1D5DB", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#1a3a6b", borderColor: "#1a3a6b" },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#6B7280" },
  chipTextActive: { color: "#fff" },
  countRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  countText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#9CA3AF", textAlign: "center" },
  devueltasRow: {
  backgroundColor: "#fff",
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderBottomWidth: 0.5,
  borderBottomColor: "#E5E7EB",
},
btnDevueltas: {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  alignSelf: "flex-start",
  borderWidth: 1,
  borderColor: "#D97706",
  borderRadius: 20,
  paddingHorizontal: 14,
  paddingVertical: 6,
  backgroundColor: "#FFF7ED",
},
btnDevueltasActive: {
  backgroundColor: "#D97706",
  borderColor: "#D97706",
},
btnDevueltasText: {
  fontSize: 12,
  fontFamily: "Inter_500Medium",
  color: "#D97706",
},
btnDevueltasTextActive: {
  color: "#fff",
},
});