import React, { useState, useMemo } from "react";
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

const C = Colors.light;

// ── Mock temporal — reemplazar por fetch al endpoint ──────────────────
const MOCK_REGISTROS = [
  {
    id: 1,
    nombre: "Carlos Andrés Martínez",
    cedula: "1023456789",
    direccion: "Calle 45 #12-30, Barrio El Prado, Bogotá",
    tipoActa: "inicio",
    carpeta: "20260308_143022_AB3C",
    propCorreo: "c.martinez@gmail.com",
    interCorreo: "inter@constructora.com",
    estado: "pendiente_firma",
  },
  {
    id: 2,
    nombre: "María Elena Suárez",
    cedula: "52678901",
    direccion: "Carrera 7 #89-15, Chapinero Alto, Bogotá",
    tipoActa: "seguimiento",
    carpeta: "20260310_091500_XY4D",
    propCorreo: "msuarez@outlook.com",
    interCorreo: "firma@interventoria.co",
    estado: "firmada",
  },
  {
    id: 3,
    nombre: "Jorge Luis Patiño",
    cedula: "79345612",
    direccion: "Avenida 68 #34-20, Kennedy, Bogotá",
    tipoActa: "fin",
    carpeta: "20260312_160045_QR7F",
    propCorreo: "jpatino@gmail.com",
    interCorreo: "inter2@grupo.com",
    estado: "firmada",
  },
  {
    id: 4,
    nombre: "Ana Lucía Rodríguez",
    cedula: "43219876",
    direccion: "Calle 100 #45-12, Usaquén, Bogotá",
    tipoActa: "inicio",
    carpeta: "20260315_083012_MN2A",
    propCorreo: "arodriguez@hotmail.com",
    interCorreo: "interventoria@empresa.co",
    estado: "borrador",
  },
  {
    id: 5,
    nombre: "Pedro José Herrera",
    cedula: "80123456",
    direccion: "Transversal 22 #56-78, Bosa, Bogotá",
    tipoActa: "seguimiento",
    carpeta: "20260318_142300_PQ5B",
    propCorreo: "pherrera@gmail.com",
    interCorreo: "supervisor@inter.co",
    estado: "completa",
  },
  {
    id: 6,
    nombre: "Claudia Viviana Torres",
    cedula: "39876543",
    direccion: "Calle 13 #23-45, Puente Aranda, Bogotá",
    tipoActa: "fin",
    carpeta: "20260320_110000_RS8C",
    propCorreo: "ctorres@yahoo.com",
    interCorreo: "ctorres_inter@co.com",
    estado: "pendiente_firma",
  },
];

const FILTROS = [
  { key: "todos", label: "Todos" },
  { key: "inicio", label: "Inicio" },
  { key: "seguimiento", label: "Seguimiento" },
  { key: "fin", label: "Fin" },
];

export type Registro = (typeof MOCK_REGISTROS)[0];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [selected, setSelected] = useState<Registro | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  // const [loading, setLoading] = useState(false); // para cuando uses fetch real

  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_REGISTROS.filter((r) => {
      const matchFiltro = filtro === "todos" || r.tipoActa === filtro;
      const matchQuery =
        !q ||
        r.nombre.toLowerCase().includes(q) ||
        r.cedula.includes(q) ||
        r.direccion.toLowerCase().includes(q) ||
        r.carpeta.toLowerCase().includes(q);
      return matchFiltro && matchQuery;
    });
  }, [query, filtro]);

  const handleEnviarLink = (registro: Registro) => {
    setSelected(registro);
    setSheetVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ── Cuando tengas el backend listo, reemplaza MOCK_REGISTROS con: ──
  // useEffect(() => {
  //   const fetchData = async () => {
  //     setLoading(true);
  //     try {
  //       const res = await fetch(`${getApiUrl()}/api/registros/buscar?q=${query}`, {
  //         credentials: "include",
  //       });
  //       const json = await res.json();
  //       setResultados(json.data);
  //     } catch (e) {
  //       console.error(e);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };
  //   const timer = setTimeout(fetchData, 350); // debounce
  //   return () => clearTimeout(timer);
  // }, [query, filtro]);

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
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x" size={15} color={C.textSecondary} />
            </Pressable>
          )}
        </View>
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
              <Text
                style={[
                  styles.chipText,
                  filtro === item.key && styles.chipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* Contador */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {resultados.length === 0
            ? "Sin resultados"
            : resultados.length === 1
            ? "1 registro encontrado"
            : `${resultados.length} registros encontrados`}
        </Text>
      </View>

      {/* Lista */}
      <FlatList
        data={resultados}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="search" size={36} color={C.textSecondary} style={{ opacity: 0.3, marginBottom: 12 }} />
            <Text style={styles.emptyText}>
              {query ? `Sin resultados para "${query}"` : "Ingresa un término para buscar"}
            </Text>
          </View>
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
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  topBarTitleWrap: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  topBarSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
  },
  searchContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingVertical: 10,
    color: "#111",
  },
  filtrosRow: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
  },
  chip: {
    borderWidth: 0.5,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: "#1a3a6b",
    borderColor: "#1a3a6b",
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#6B7280",
  },
  chipTextActive: {
    color: "#fff",
  },
  countRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  countText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    textAlign: "center",
  },
});