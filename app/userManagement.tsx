import { useState, useMemo } from "react";
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

// ─── Tipos (basados en tu tabla + campos que usas en el formulario) ────────
interface Usuario {
  id: number;
  documento: string;
  nombre: string;           // ← lo usamos para UX (aunque aún no esté en la tabla)
  active: boolean;
  is_admin: boolean;
  deleted_at: string | null;
  creado_en: string;
}

// ─── Datos simulados (hasta que conectes el backend) ───────────────────────
const mockUsuarios: Usuario[] = [
  {
    id: 1,
    documento: "1032456789",
    nombre: "Carlos Rodríguez",
    active: true,
    is_admin: false,
    deleted_at: null,
    creado_en: "2025-01-15T10:00:00Z",
  },
  {
    id: 2,
    documento: "79543210",
    nombre: "María López",
    active: true,
    is_admin: true,
    deleted_at: null,
    creado_en: "2025-02-03T14:30:00Z",
  },
  {
    id: 3,
    documento: "45678901",
    nombre: "Juan Pérez",
    active: false,
    is_admin: false,
    deleted_at: null,
    creado_en: "2025-02-20T09:15:00Z",
  },
  {
    id: 4,
    documento: "1122334455",
    nombre: "Ana Gutiérrez",
    active: true,
    is_admin: false,
    deleted_at: null,
    creado_en: "2025-03-10T11:45:00Z",
  },
  {
    id: 5,
    documento: "987654321",
    nombre: "Luis Ramírez",
    active: true,
    is_admin: true,
    deleted_at: "2025-04-01T08:20:00Z",
    creado_en: "2024-12-05T16:00:00Z",
  },
];

// ─── Paleta (igual que tu CreateUserScreen) ────────────────────────────────
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

// ─── Helpers ───────────────────────────────────────────────────────────────
function getInitials(nombre: string): string {
  const parts = nombre.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Componente principal ──────────────────────────────────────────────────
export default function UsersManagementScreen() {
  const [usuarios, setUsuarios] = useState<Usuario[]>(mockUsuarios);
  const [search, setSearch] = useState("");
  const [loadingDelete, setLoadingDelete] = useState<number | null>(null); // id del usuario que se está eliminando
  const [refreshing, setRefreshing] = useState(false);

  // Filtrado
  const filteredUsuarios = useMemo(() => {
    return usuarios
      .filter((u) => {
        const term = search.toLowerCase();
        return (
          u.nombre.toLowerCase().includes(term) ||
          u.documento.includes(term)
        );
      })
      .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime());
  }, [usuarios, search]);

  const activeCount = usuarios.filter((u) => u.active && !u.deleted_at).length;

  // ── Borrado lógico con UX fuerte ───────────────────────────────────────
  const handleDelete = (user: Usuario) => {
    if (user.deleted_at) return;

    Alert.alert(
      "Eliminar usuario",
      `¿Estás seguro de eliminar a **${user.nombre}** (${user.documento})?\n\n` +
      "Esta acción es lógica (se marcará deleted_at) y se puede revertir después.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            // Confirmación secundaria para evitar accidentes
            Alert.alert(
              "¡Última confirmación!",
              "Esta acción no se puede deshacer fácilmente desde la app.\n¿Continuar?",
              [
                { text: "No, cancelar", style: "cancel" },
                {
                  text: "Sí, eliminar",
                  style: "destructive",
                  onPress: async () => {
                    setLoadingDelete(user.id);

                    // Simulación de llamada al backend (reemplaza después por fetch)
                    await new Promise((res) => setTimeout(res, 1200));

                    setUsuarios((prev) =>
                      prev.map((u) =>
                        u.id === user.id
                          ? { ...u, deleted_at: new Date().toISOString() }
                          : u
                      )
                    );

                    setLoadingDelete(null);

                    Alert.alert(
                      "Usuario eliminado",
                      `${user.nombre} ha sido marcado como eliminado.`,
                      [{ text: "Entendido" }]
                    );
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  // ── Reactivar usuario eliminado ───────────────────────────────────────
  const handleReactivate = (user: Usuario) => {
    if (!user.deleted_at) return;

    Alert.alert(
      "Reactivar usuario",
      `¿Quieres volver a activar a ${user.nombre}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Reactivar",
          onPress: async () => {
            await new Promise((res) => setTimeout(res, 800));
            setUsuarios((prev) =>
              prev.map((u) =>
                u.id === user.id ? { ...u, deleted_at: null, active: true } : u
              )
            );
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((res) => setTimeout(res, 1000));
    setRefreshing(false);
  };

  const renderUser = ({ item }: { item: Usuario }) => {
    const isDeleted = !!item.deleted_at;
    const initials = getInitials(item.nombre);

    return (
      <View style={[styles.userCard, isDeleted && styles.userCardDeleted]}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.nombre}</Text>
          <Text style={styles.userDoc}>{item.documento}</Text>

          <View style={styles.badges}>
            {item.active && !isDeleted && (
              <View style={styles.badgeActive}>
                <Text style={styles.badgeTextActive}>Activo</Text>
              </View>
            )}
            {item.is_admin && (
              <View style={styles.badgeAdmin}>
                <Text style={styles.badgeTextAdmin}>Admin</Text>
              </View>
            )}
            {isDeleted && (
              <View style={styles.badgeDeleted}>
                <Text style={styles.badgeTextDeleted}>Eliminado</Text>
              </View>
            )}
          </View>

          <Text style={styles.created}>
            Creado {formatDate(item.creado_en)}
          </Text>
        </View>

        <View style={styles.actions}>
          {isDeleted ? (
            <TouchableOpacity
              style={styles.reactivateBtn}
              onPress={() => handleReactivate(item)}
            >
              <Text style={styles.reactivateText}>Reactivar</Text>
            </TouchableOpacity>
          ) : (
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
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Gestión de usuarios</Text>
          <Text style={styles.headerSub}>
            {activeCount} usuarios activos • {usuarios.length} total
          </Text>
        </View>
      </View>

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o documento..."
          placeholderTextColor={C.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Lista */}
      <FlatList
        data={filteredUsuarios}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderUser}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No se encontraron usuarios</Text>
          </View>
        }
      />

      {/* Botón flotante para crear usuario */}
      {/* <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/create-user")} // cambia la ruta si es diferente
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity> */}
    </View>
  );
}

// ─── Estilos (mismo lenguaje visual que tu pantalla de crear) ───────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },

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
  backIcon: { fontSize: 24, color: C.text, lineHeight: 28, marginTop: -2 },
  headerTitle: { fontSize: 17, fontWeight: "500", color: C.text },
  headerSub: { fontSize: 12, color: C.textSecondary, marginTop: 1 },

  searchContainer: { padding: 20, paddingBottom: 12 },
  searchInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: C.borderStrong,
    backgroundColor: C.surfaceAlt,
    paddingHorizontal: 16,
    fontSize: 15,
    color: C.text,
  },

  list: { padding: 20, paddingTop: 8 },

  userCard: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: C.border,
  },
  userCardDeleted: { opacity: 0.75 },

  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { fontSize: 20, fontWeight: "500", color: C.primary },

  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: "500", color: C.text },
  userDoc: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
  created: { fontSize: 11, color: C.textTertiary, marginTop: 6 },

  badges: { flexDirection: "row", gap: 6, marginTop: 6 },
  badgeActive: {
    backgroundColor: "#EAF3DE",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeTextActive: { fontSize: 11, color: "#27500A", fontWeight: "500" },
  badgeAdmin: {
    backgroundColor: C.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeTextAdmin: { fontSize: 11, color: C.primary, fontWeight: "500" },
  badgeDeleted: {
    backgroundColor: C.danger,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeTextDeleted: { fontSize: 11, color: C.dangerText, fontWeight: "500" },

  actions: { justifyContent: "center" },
  deleteBtn: {
    backgroundColor: "#E24B4A",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteText: { color: "#fff", fontSize: 13, fontWeight: "500" },

  reactivateBtn: {
    backgroundColor: "#97C459",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  reactivateText: { color: "#fff", fontSize: 13, fontWeight: "500" },

  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { fontSize: 28, color: "#fff", lineHeight: 32, marginTop: -2 },

  empty: { paddingTop: 60, alignItems: "center" },
  emptyText: { color: C.textTertiary, fontSize: 15 },
});