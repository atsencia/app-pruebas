// app/queue.tsx
// Pantalla que muestra el estado de todos los ítems en cola.
import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import Colors from '@/constants/colors';

const C = Colors.light;

// ── Colores por estado ────────────────────────────────────────
const ESTADO_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  pendiente:  { color: '#DD6B20', icon: 'clock',         label: 'En cola'    },
  subiendo:   { color: '#2563EB', icon: 'upload-cloud',  label: 'Subiendo'   },
  completado: { color: '#16A34A', icon: 'check-circle',  label: 'Completado' },
  error:      { color: '#DC2626', icon: 'alert-circle',  label: 'Error'      },
};

// ── Tarjeta individual de un ítem ────────────────────────────
function ItemCard({
  item,
  onReintentar,
}: {
  item: any;
  onReintentar: (id: string) => void;
}) {
  const cfg    = ESTADO_CONFIG[item.estado] ?? ESTADO_CONFIG.pendiente;
  const f      = item.formulario ?? {};
  const nombre = f.nombre ?? f.extra?.nombre ?? 'Sin nombre';
  const dir    = f.direccion ?? f.extra?.direccion ?? 'Sin dirección';
  const fotos  = (f.fotos?.length ?? 0) + (f.fotosFachada?.length ?? 0);
  const videos = f.videos?.length ?? 0;

  const fecha = item.creadoEn
    ? new Date(item.creadoEn).toLocaleString('es-CO', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : '—';

  return (
    <View style={[styles.card, { borderLeftColor: cfg.color }]}>
      {/* Cabecera */}
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconBg, { backgroundColor: cfg.color + '18' }]}>
          <Feather name={cfg.icon} size={15} color={cfg.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardNombre} numberOfLines={1}>{nombre}</Text>
          <Text style={styles.cardDir}   numberOfLines={1}>{dir}</Text>
        </View>
        <View style={[styles.estadoBadge, { backgroundColor: cfg.color + '18' }]}>
          <Text style={[styles.estadoText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* Detalle */}
      <View style={styles.cardMeta}>
        <MetaChip icon="image"    label={`${fotos} fotos`} />
        <MetaChip icon="video"    label={`${videos} videos`} />
        <MetaChip icon="calendar" label={fecha} />
        {item.reintentos > 0 && (
          <MetaChip icon="refresh-cw" label={`${item.reintentos} intento${item.reintentos > 1 ? 's' : ''}`} color="#DD6B20" />
        )}
      </View>

      {/* Error */}
      {item.estado === 'error' && item.ultimoError && (
        <View style={styles.errorBox}>
          <Feather name="alert-triangle" size={12} color="#DC2626" />
          <Text style={styles.errorText} numberOfLines={2}>{item.ultimoError}</Text>
        </View>
      )}

      {/* Progreso si está subiendo */}
      {item.estado === 'subiendo' && (
        <View style={styles.subiendoRow}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.subiendoText}>Subiendo al servidor FTP...</Text>
        </View>
      )}

      {/* Acción reintentar */}
      {item.estado === 'error' && (
        <Pressable
          style={({ pressed }) => [styles.reintentarBtn, pressed && { opacity: 0.7 }]}
          onPress={() => onReintentar(item.id)}
        >
          <Feather name="refresh-cw" size={13} color="#fff" />
          <Text style={styles.reintentarText}>Reintentar</Text>
        </Pressable>
      )}
    </View>
  );
}

function MetaChip({ icon, label, color }: { icon: any; label: string; color?: string }) {
  return (
    <View style={styles.metaChip}>
      <Feather name={icon} size={11} color={color ?? C.textSecondary} />
      <Text style={[styles.metaText, color ? { color } : {}]}>{label}</Text>
    </View>
  );
}

// ── Pantalla principal ───────────────────────────────────────
export default function QueueScreen() {
  const insets = useSafeAreaInsets();
  const { items, pendientes, subiendo, errores, completados, reintentar, limpiar, refrescar } =
    useUploadQueue();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refrescar();
    setRefreshing(false);
  }, [refrescar]);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  // Resumen en chips superiores
  const resumen = [
    { label: 'En cola',    count: pendientes.length,  color: '#DD6B20' },
    { label: 'Subiendo',   count: subiendo.length,    color: '#2563EB' },
    { label: 'Completado', count: completados.length, color: '#16A34A' },
    { label: 'Error',      count: errores.length,     color: '#DC2626' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: C.background }]}>
      {/* TOP BAR */}
      <View style={[styles.topBar, { paddingTop: topPad + 10, backgroundColor: C.primary }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle}>Cola de subida</Text>
          <Text style={styles.topSub}>{items.length} registro{items.length !== 1 ? 's' : ''} en total</Text>
        </View>
        {completados.length > 0 && (
          <Pressable
            onPress={limpiar}
            style={({ pressed }) => [styles.limpiarBtn, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <Feather name="trash-2" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={styles.limpiarText}>Limpiar</Text>
          </Pressable>
        )}
      </View>

      {/* RESUMEN */}
      <View style={styles.resumenRow}>
        {resumen.map(r => (
          <View key={r.label} style={[styles.resumenChip, { borderColor: r.color + '40' }]}>
            <Text style={[styles.resumenCount, { color: r.color }]}>{r.count}</Text>
            <Text style={styles.resumenLabel}>{r.label}</Text>
          </View>
        ))}
      </View>

      {/* LISTA */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.lista,
          { paddingBottom: insets.bottom + 24 },
          items.length === 0 && styles.listaEmpty,
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="inbox" size={32} color={C.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>Cola vacía</Text>
            <Text style={styles.emptyDesc}>
              Los registros aparecerán aquí cuando envíes un formulario.
            </Text>
          </View>
        ) : (
          // Orden: subiendo → pendiente → error → completado
          [...subiendo, ...pendientes, ...errores, ...completados].map(item => (
            <ItemCard key={item.id} item={item} onReintentar={reintentar} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:    { flex: 1 },
  topBar:  {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 18,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  topTitle:    { fontSize: 18, fontFamily: 'Inter_700Bold',    color: '#fff', letterSpacing: -0.3 },
  topSub:      { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  limpiarBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)' },
  limpiarText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,255,255,0.85)' },

  resumenRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  resumenChip: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: 12, borderWidth: 1.5, backgroundColor: C.background,
  },
  resumenCount: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  resumenLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', color: C.textSecondary, marginTop: 2 },

  lista:      { padding: 16, gap: 12 },
  listaEmpty: { flex: 1, justifyContent: 'center' },

  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 14, gap: 10,
    borderLeftWidth: 4,
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 3,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconBg:  { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardNombre:  { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
  cardDir:     { fontSize: 12, fontFamily: 'Inter_400Regular',  color: C.textSecondary, marginTop: 1 },
  estadoBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  estadoText:  { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  cardMeta:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.inputBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  metaText:   { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary },

  errorBox:   { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: '#FFF5F5', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FEB2B2' },
  errorText:  { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: '#DC2626', lineHeight: 17 },

  subiendoRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subiendoText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#2563EB' },

  reintentarBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 9, marginTop: 2 },
  reintentarText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  emptyState:  { alignItems: 'center', gap: 12, paddingVertical: 40 },
  emptyIcon:   { width: 72, height: 72, borderRadius: 24, backgroundColor: C.inputBg, justifyContent: 'center', alignItems: 'center' },
  emptyTitle:  { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
  emptyDesc:   { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 32 },
});