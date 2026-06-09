import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  Pressable, TouchableOpacity, Alert, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useBorradores } from '@/store/zustand-state';
import { useBorradoresActions } from '@/hooks/useBorradoresActions';
import { useFormStore } from '@/store/zustand-state';

const C = Colors.light;

const ESTADO_CONFIG = {
  borrador: { color: '#D97706', bg: '#FFF7ED', label: 'Borrador',  icon: 'edit-3'       },
  en_cola:  { color: '#2563EB', bg: '#EFF6FF', label: 'En cola',   icon: 'upload-cloud' },
  subido:   { color: '#16A34A', bg: '#F0FDF4', label: 'Subido',    icon: 'check-circle' },
};

export default function BorradoresScreen() {
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  const { borradores, eliminarBorrador } =  useBorradores();
  const { enviarALaCola, enviarTodos }   = useBorradoresActions();
  const setField  = useFormStore((s: any) => s.setField);
  const clearForm = useFormStore((s: any) => s.clearForm);

  const [subiendoId, setSubiendoId] = useState<string | null>(null);
  const [subiendoTodos, setSubiendoTodos] = useState(false);

const pendientes = (borradores as any[]).filter((b: any) => b.estado === 'borrador');
const enCola     = (borradores as any[]).filter((b: any) => b.estado === 'en_cola');
const subidos    = (borradores as any[]).filter((b: any) => b.estado === 'subido');

  // ── Cargar borrador en el form y navegar ──
  const handleCargar = (borrador: any) => {
    Alert.alert(
      'Cargar borrador',
      `¿Cargar "${borrador.nombre}" en el formulario? Se reemplazará el contenido actual.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cargar',
          onPress: () => {
            clearForm();
            Object.entries(borrador.formData).forEach(([k, v]) => setField(k, v));
            router.push({ pathname: '/form' } as any);
          },
        },
      ]
    );
  };

  // ── Subir uno ─────────────────────────────
  const handleSubir = async (borrador: any) => {
    setSubiendoId(borrador.id);
    try {
      await enviarALaCola(borrador);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo encolar');
    } finally {
      setSubiendoId(null);
    }
  };

  // ── Subir todos ───────────────────────────
  const handleSubirTodos = async () => {
    if (pendientes.length === 0) return;
    Alert.alert(
      'Subir todos',
      `¿Encolar ${pendientes.length} borrador${pendientes.length > 1 ? 'es' : ''} para subida?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Subir todos',
          onPress: async () => {
            setSubiendoTodos(true);
            try {
              await enviarTodos();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setSubiendoTodos(false);
            }
          },
        },
      ]
    );
  };

  // ── Eliminar ──────────────────────────────
  const handleEliminar = (borrador: any) => {
    Alert.alert(
      'Eliminar borrador',
      `¿Eliminar "${borrador.nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => eliminarBorrador(borrador.id) },
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const cfg = ESTADO_CONFIG[item.estado as keyof typeof ESTADO_CONFIG];
    const esPendiente = item.estado === 'borrador';
    const subiendo    = subiendoId === item.id;

    return (
      <View style={styles.card}>

        {/* Header de la card */}
        <View style={styles.cardHeader}>
          <View style={[styles.estadoBadge, { backgroundColor: cfg.bg }]}>
            <Feather name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[styles.estadoText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.cardFecha}>
            {new Date(item.actualizadoEn).toLocaleDateString('es-CO', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        </View>

        {/* Nombre */}
        <Text style={styles.cardNombre} numberOfLines={1}>{item.nombre}</Text>

        {/* Meta info */}
        <View style={styles.cardMeta}>
          {item.formData?.tipoActa ? (
            <View style={styles.metaChip}>
              <Feather name="file-text" size={11} color={C.textSecondary} />
              <Text style={styles.metaText}>
                {item.formData.tipoActa.charAt(0).toUpperCase() + item.formData.tipoActa.slice(1)}
              </Text>
            </View>
          ) : null}
          {item.formData?.fotos?.length > 0 && (
            <View style={styles.metaChip}>
              <Feather name="camera" size={11} color={C.textSecondary} />
              <Text style={styles.metaText}>{item.formData.fotos.length} fotos</Text>
            </View>
          )}
          {item.formData?.videos?.length > 0 && (
            <View style={styles.metaChip}>
              <Feather name="video" size={11} color={C.textSecondary} />
              <Text style={styles.metaText}>{item.formData.videos.length} videos</Text>
            </View>
          )}
          {item.formData?.latitud !== null && (
            <View style={styles.metaChip}>
              <Feather name="map-pin" size={11} color={C.textSecondary} />
              <Text style={styles.metaText}>Georef</Text>
            </View>
          )}
        </View>

        {/* Acciones */}
        <View style={styles.cardActions}>
          {/* Cargar en form */}
          <TouchableOpacity
            style={styles.btnCargar}
            onPress={() => handleCargar(item)}
          >
            <Feather name="edit-2" size={14} color={C.primary} />
            <Text style={styles.btnCargarText}>Editar</Text>
          </TouchableOpacity>

          {/* Subir — solo si está en borrador */}
          {esPendiente && (
            <TouchableOpacity
              style={[styles.btnSubir, subiendo && styles.btnDisabled]}
              onPress={() => handleSubir(item)}
              disabled={subiendo}
            >
              <Feather name="upload-cloud" size={14} color="#fff" />
              <Text style={styles.btnSubirText}>
                {subiendo ? 'Encolando...' : 'Subir'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Eliminar */}
          <TouchableOpacity
            style={styles.btnEliminar}
            onPress={() => handleEliminar(item)}
            hitSlop={8}
          >
            <Feather name="trash-2" size={15} color={C.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: C.background }]}>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: topPadding + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={18} color="#fff" />
        </Pressable>
        <View style={styles.topBarTitleWrap}>
          <Text style={styles.topBarTitle}>Borradores</Text>
          <Text style={styles.topBarSub}>
            {borradores.length} guardado{borradores.length !== 1 ? 's' : ''}
            {pendientes.length > 0 ? ` · ${pendientes.length} pendiente${pendientes.length !== 1 ? 's' : ''}` : ''}
          </Text>
        </View>

        {/* Subir todos */}
        {pendientes.length > 0 && (
          <TouchableOpacity
            style={[styles.btnSubirTodos, subiendoTodos && styles.btnDisabled]}
            onPress={handleSubirTodos}
            disabled={subiendoTodos}
          >
            <Feather name="upload-cloud" size={15} color="#fff" />
            <Text style={styles.btnSubirTodosText}>
              {subiendoTodos ? '...' : `Subir (${pendientes.length})`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Resumen rápido */}
      {borradores.length > 0 && (
        <View style={styles.statsRow}>
          <StatChip icon="edit-3"       color="#D97706" label="Borradores" count={pendientes.length} />
          <StatChip icon="upload-cloud" color="#2563EB" label="En cola"    count={enCola.length}     />
          <StatChip icon="check-circle" color="#16A34A" label="Subidos"    count={subidos.length}    />
        </View>
      )}

      <FlatList
        data={borradores}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="inbox" size={48} color={C.textSecondary} style={{ opacity: 0.2, marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>Sin borradores</Text>
            <Text style={styles.emptySubtitle}>
              Usa el botón "Preguardado" en el formulario para guardar actas localmente
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/form' as any)}>
              <Feather name="plus" size={15} color="#fff" />
              <Text style={styles.emptyBtnText}>Ir al formulario</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

function StatChip({ icon, color, label, count }: { icon: any; color: string; label: string; count: number }) {
  return (
    <View style={[styles.statChip, { borderColor: color + '30', backgroundColor: color + '10' }]}>
      <Feather name={icon} size={13} color={color} />
      <Text style={[styles.statCount, { color }]}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.primary,
    paddingHorizontal: 16, paddingBottom: 16, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  topBarTitleWrap: { flex: 1 },
  topBarTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff' },
  topBarSub:   { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  btnSubirTodos: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.accent, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  btnSubirTodosText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  statsRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.card,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  statChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  statCount: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary },

  listContent: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: C.card, borderRadius: 16,
    padding: 16, gap: 10,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 6, elevation: 3,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  estadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  estadoText:  { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  cardFecha:   { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary },
  cardNombre:  { fontSize: 15, fontFamily: 'Inter_700Bold', color: C.text },

  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.inputBg, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: C.border,
  },
  metaText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary },

  cardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnCargar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: C.primary, borderRadius: 10, paddingVertical: 10,
  },
  btnCargarText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.primary },
  btnSubir: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.accent, borderRadius: 10, paddingVertical: 10,
  },
  btnSubirText:  { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  btnEliminar: {
    width: 40, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.error + '40', borderRadius: 10,
  },
  btnDisabled: { opacity: 0.5 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle:    { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
  emptySubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center', lineHeight: 19, paddingHorizontal: 32 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.primary, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});