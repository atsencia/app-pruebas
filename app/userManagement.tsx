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
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

interface Usuario {
  id: number;
  documento: string;
  nombre: string | null;  // ← agrega nombre
  is_admin: number;
  active: number;
  deleted_at: string | null;
  creado_en: string;
}

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
  danger: "#FCEBEB",
  dangerText: "#501313",
  dangerBorder: "#F09595",
};

function getInitials(documento: string): string {
  return documento.slice(-2).toUpperCase();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

const API = "https://187.33.154.112.sslip.io/backend/api/users";

export default function UsersManagementScreen() {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [search, setSearch] = useState("");
  const [loadingDelete, setLoadingDelete] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── 1. Fetch al montar ──────────────────────────────────────────────────
  const fetchUsuarios = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(API, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user?.token}`,
        },
      });

      if (!response.ok) throw new Error("Error al obtener usuarios");

      const data = await response.json();
      console.log("Usuarios obtenidos:", data);
      // Ajusta según lo que devuelva el backend (array directo o { users: [] })
    setUsuarios(Array.isArray(data) ? data : data.usuarios ?? []);
    } catch (e: any) {
      setError(e.message || "No se pudo conectar al servidor");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.token]);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUsuarios();
  };

  // ── 2. Solo activos (sin deleted_at) ───────────────────────────────────
  const filteredUsuarios = useMemo(() => {
    return usuarios
      .filter((u) => !u.deleted_at) // oculta eliminados
      .filter((u) => {
        const term = search.toLowerCase();
        return u.documento.includes(term);
      })
      .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime());
  }, [usuarios, search]);

  const activeCount = filteredUsuarios.length;

  // ── 3. Delete al backend ────────────────────────────────────────────────
  const handleDelete = (user_item: Usuario) => {
    Alert.alert(
      "Eliminar usuario",
      `¿Eliminar al usuario con documento ${user_item.documento}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "¡Última confirmación!",
              "¿Continuar con la eliminación?",
              [
                { text: "No, cancelar", style: "cancel" },
                {
                  text: "Sí, eliminar",
                  style: "destructive",
                  onPress: async () => {
                    setLoadingDelete(user_item.id);
                    try {
                      const response = await fetch(`${API}/${user_item.id}`, {
                        method: "DELETE",
                        headers: {
                          "Authorization": `Bearer ${user?.token}`,
                        },
                      });

                      if (!response.ok) throw new Error("Error al eliminar");

                      // Actualiza lista local marcando deleted_at
                      setUsuarios((prev) =>
                        prev.map((u) =>
                          u.id === user_item.id
                            ? { ...u, deleted_at: new Date().toISOString() }
                            : u
                        )
                      );

                      Alert.alert("Usuario eliminado", "El usuario fue eliminado correctamente.");
                    } catch (e: any) {
                      Alert.alert("Error", e.message || "No se pudo eliminar el usuario.");
                    } finally {
                      setLoadingDelete(null);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const renderUser = ({ item }: { item: Usuario }) => (
  <View style={styles.userCard}>
    <View style={styles.avatarCircle}>
      <Text style={styles.avatarText}>
        {item.nombre ? item.nombre.charAt(0).toUpperCase() : item.documento.slice(-2).toUpperCase()}
      </Text>
    </View>

    <View style={styles.userInfo}>
      <Text style={styles.userName}>{item.nombre ?? item.documento}</Text>
      <Text style={styles.userDoc}>{item.documento}</Text>
      <View style={styles.badges}>
        {item.active === 1 && (
          <View style={styles.badgeActive}>
            <Text style={styles.badgeTextActive}>Activo</Text>
          </View>
        )}
        {item.is_admin === 1 && (
          <View style={styles.badgeAdmin}>
            <Text style={styles.badgeTextAdmin}>Admin</Text>
          </View>
        )}
      </View>
      <Text style={styles.created}>Creado {formatDate(item.creado_en)}</Text>
    </View>

    <View style={styles.actions}>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => handleDelete(item)}
        disabled={loadingDelete === item.id}
      >
        {loadingDelete === item.id ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.deleteText}>Eliminar</Text>
        )}
      </TouchableOpacity>
    </View>
  </View>
);

  if (loading) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={C.primary} size="large" />
        <Text style={{ color: C.textSecondary, marginTop: 12 }}>Cargando usuarios...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center", padding: 24 }]}>
        <Text style={{ color: "#E24B4A", fontSize: 15, textAlign: "center" }}>{error}</Text>
        <TouchableOpacity onPress={fetchUsuarios} style={{ marginTop: 16 }}>
          <Text style={{ color: C.primary }}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Gestión de usuarios</Text>
          <Text style={styles.headerSub}>{activeCount} usuarios activos</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por documento..."
          placeholderTextColor={C.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

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
            <Text style={styles.emptyText}>No se encontraron usuarios</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    backgroundColor: C.surface, borderBottomWidth: 0.5, borderBottomColor: C.border,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.surfaceAlt, borderWidth: 0.5, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  backIcon: { fontSize: 24, color: C.text, lineHeight: 28, marginTop: -2 },
  headerTitle: { fontSize: 17, fontWeight: "500", color: C.text },
  headerSub: { fontSize: 12, color: C.textSecondary, marginTop: 1 },
  searchContainer: { padding: 20, paddingBottom: 12 },
  searchInput: {
    height: 46, borderRadius: 12, borderWidth: 0.5, borderColor: C.borderStrong,
    backgroundColor: C.surfaceAlt, paddingHorizontal: 16, fontSize: 15, color: C.text,
  },
  list: { padding: 20, paddingTop: 8 },
  userCard: {
    flexDirection: "row", backgroundColor: C.surface, borderRadius: 12,
    padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: C.border,
  },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: C.primaryLight,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: "500", color: C.primary },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: "500", color: C.text },
  created: { fontSize: 11, color: C.textTertiary, marginTop: 6 },
  badges: { flexDirection: "row", gap: 6, marginTop: 6 },
  badgeActive: {
    backgroundColor: "#EAF3DE", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
  },
  badgeTextActive: { fontSize: 11, color: "#27500A", fontWeight: "500" },
  badgeAdmin: {
    backgroundColor: C.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
  },
  badgeTextAdmin: { fontSize: 11, color: C.primary, fontWeight: "500" },
  actions: { justifyContent: "center" },
  deleteBtn: {
    backgroundColor: "#E24B4A", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  deleteText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  empty: { paddingTop: 60, alignItems: "center" },
  emptyText: { color: C.textTertiary, fontSize: 15 },
  userDoc: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
});