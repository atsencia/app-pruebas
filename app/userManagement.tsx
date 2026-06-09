import { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";

const C = Colors.light;

interface Usuario {
  id:         number;
  documento:  string;
  nombre:     string | null;
  is_admin:   number;
  active:     number;
  deleted_at: string | null;
  creado_en:  string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const API = "https://187.33.154.112.sslip.io/backend/api/users";

// ─── Componente principal ─────────────────────────────────────────────────────

export default function UsersManagementScreen() {
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();

  useEffect(() => {
    if (!user?.isAdmin) router.replace("/form");
  }, [user]);

  const [usuarios,      setUsuarios]      = useState<Usuario[]>([]);
  const [search,        setSearch]        = useState("");
  const [loadingDelete, setLoadingDelete] = useState<number | null>(null);
  const [refreshing,    setRefreshing]    = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);

  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchUsuarios = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(API, {
        method: "GET",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${user?.token}`,
        },
      });
      if (!response.ok) throw new Error("Error al obtener usuarios");
      const data = await response.json();
      setUsuarios(Array.isArray(data) ? data : data.usuarios ?? []);
    } catch (e: any) {
      setError(e.message || "No se pudo conectar al servidor");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token]);

  useEffect(() => { fetchUsuarios(); }, [fetchUsuarios]);

  const onRefresh = async () => { setRefreshing(true); await fetchUsuarios(); };

  // ── Filtrado ─────────────────────────────────────────────────────────────

  const filteredUsuarios = useMemo(() => {
    const term = search.toLowerCase();
    return usuarios
      .filter((u) => !u.deleted_at)
      .filter((u) => u.documento.includes(term) || (u.nombre ?? "").toLowerCase().includes(term))
      .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime());
  }, [usuarios, search]);

  // ── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = (item: Usuario) => {
    Alert.alert(
      "Eliminar usuario",
      `¿Eliminar a ${item.nombre ?? item.documento}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar", style: "destructive",
          onPress: () =>
            Alert.alert("¿Estás seguro?", "Esta acción no se puede deshacer.", [
              { text: "No, cancelar", style: "cancel" },
              {
                text: "Sí, eliminar", style: "destructive",
                onPress: async () => {
                  setLoadingDelete(item.id);
                  try {
                    const res = await fetch(`${API}/${item.id}`, {
                      method: "DELETE",
                      headers: { "Authorization": `Bearer ${user?.token}` },
                    });
                    if (!res.ok) throw new Error("Error al eliminar");
                    setUsuarios((prev) =>
                      prev.map((u) =>
                        u.id === item.id ? { ...u, deleted_at: new Date().toISOString() } : u
                      )
                    );
                    Alert.alert("Eliminado", "El usuario fue eliminado correctamente.");
                  } catch (e: any) {
                    Alert.alert("Error", e.message || "No se pudo eliminar el usuario.");
                  } finally {
                    setLoadingDelete(null);
                  }
                },
              },
            ]),
        },
      ]
    );
  };

  // ── Render item ──────────────────────────────────────────────────────────

  const renderUser = ({ item }: { item: Usuario }) => {
    const initial = item.nombre
      ? item.nombre.charAt(0).toUpperCase()
      : item.documento.slice(-1).toUpperCase();

    return (
      <View style={styles.userCard}>
        {/* Avatar */}
        <View style={[styles.avatar, item.is_admin === 1 && styles.avatarAdmin]}>
          <Text style={[styles.avatarText, item.is_admin === 1 && styles.avatarTextAdmin]}>
            {initial}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.nombre ?? item.documento}</Text>
          {item.nombre && <Text style={styles.userDoc}>{item.documento}</Text>}
          <View style={styles.badgeRow}>
            {item.active === 1 && (
              <View style={styles.badgeActive}>
                <Feather name="check-circle" size={10} color="#2E7D32" />
                <Text style={styles.badgeActiveText}>Activo</Text>
              </View>
            )}
            {item.is_admin === 1 && (
              <View style={styles.badgeAdmin}>
                <Feather name="shield" size={10} color={C.primary} />
                <Text style={styles.badgeAdminText}>Admin</Text>
              </View>
            )}
          </View>
          <Text style={styles.userDate}>Creado {formatDate(item.creado_en)}</Text>
        </View>

        {/* Acción */}
        <Pressable
          style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.75 }]}
          onPress={() => handleDelete(item)}
          disabled={loadingDelete === item.id}
        >
          {loadingDelete === item.id ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Feather name="trash-2" size={15} color="#fff" />
          )}
        </Pressable>
      </View>
    );
  };

  // ── Loading / Error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: C.background }]}>
        <View style={[styles.topBar, { paddingTop: topPadding + 10, backgroundColor: C.primary }]}>
          <View style={styles.iconBtn} />
          <View style={styles.topBarCenter}>
            <Text style={styles.topBarTitle}>Gestión de usuarios</Text>
          </View>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={C.primary} size="large" />
          <Text style={styles.centeredText}>Cargando usuarios...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.root, { backgroundColor: C.background }]}>
        <View style={[styles.topBar, { paddingTop: topPadding + 10, backgroundColor: C.primary }]}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>
          <View style={styles.topBarCenter}>
            <Text style={styles.topBarTitle}>Gestión de usuarios</Text>
          </View>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.centered}>
          <Feather name="wifi-off" size={32} color={C.error} />
          <Text style={[styles.centeredText, { color: C.error, marginTop: 12 }]}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchUsuarios}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Vista principal ──────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: C.background }]}>

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
          <Text style={styles.topBarTitle}>Gestión de usuarios</Text>
          <Text style={styles.topBarSub}>{filteredUsuarios.length} usuarios activos</Text>
        </View>
        <Pressable
          onPress={() => router.push("/createUser")}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          hitSlop={10}
        >
          <Feather name="user-plus" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* BUSCADOR */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Feather name="search" size={15} color={C.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre o documento..."
            placeholderTextColor={C.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={15} color={C.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* LISTA */}
      <FlatList
        data={filteredUsuarios}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderUser}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="users" size={32} color={C.border} />
            <Text style={styles.emptyText}>No se encontraron usuarios</Text>
          </View>
        }
      />
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

  searchWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  searchBox:  {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1.5,
    borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4, elevation: 2,
  },
  searchInput: {
    flex: 1, fontSize: 14, fontFamily: "Inter_400Regular",
    color: C.text, padding: 0,
  },

  list: { padding: 16, paddingTop: 4, gap: 10 },

  userCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: C.card, borderRadius: 16, padding: 14,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },

  avatar: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: C.primary + "18",
    justifyContent: "center", alignItems: "center",
  },
  avatarAdmin:     { backgroundColor: C.primary },
  avatarText:      { fontSize: 17, fontFamily: "Inter_700Bold", color: C.primary },
  avatarTextAdmin: { color: "#fff" },

  userInfo: { flex: 1, gap: 3 },
  userName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  userDoc:  { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary },
  userDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.textSecondary, marginTop: 4 },

  badgeRow:        { flexDirection: "row", gap: 6, marginTop: 4 },
  badgeActive:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E6F4EA", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeActiveText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#2E7D32" },
  badgeAdmin:      { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.primary + "15", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeAdminText:  { fontSize: 11, fontFamily: "Inter_600SemiBold", color: C.primary },

  deleteBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.error, justifyContent: "center", alignItems: "center",
  },

  centered:     { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  centeredText: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary },

  retryBtn:  { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: C.primary + "15", borderRadius: 10 },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.primary },

  empty:     { paddingTop: 60, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.textSecondary },
});