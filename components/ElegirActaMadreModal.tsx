// components/ElegirActaMadreModal.tsx
// Lista las actas madre del proyecto (las subidas por cualquier gestor) para
// elegir a cuál sumar zonas desde este teléfono. Varios gestores trabajan el
// mismo lote: cada uno elige la madre y sus zonas quedan ligadas a ella.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { API_BASE } from '@/constants/api';

const C = Colors.light;

export interface ActaMadre {
  uuid:            string;
  acta:            number;
  tipo_acta:       string | null;
  direccion:       string | null;
  estado_revision: string | null;
  creado_en:       string;
  zonas:           number;
}

interface Props {
  visible:        boolean;
  codigoProyecto: string;
  token?:         string | null;
  uuidActual?:    string | null;
  onClose:        () => void;
  onElegir:       (madre: ActaMadre) => void;
}

const TIPO_LABEL: Record<string, string> = { inicio: 'Inicio', seguimiento: 'Seguimiento', cierre: 'Cierre' };

export default function ElegirActaMadreModal({ visible, codigoProyecto, token, uuidActual, onClose, onElegir }: Props) {
  const [madres, setMadres]     = useState<ActaMadre[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelado = false;
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE}/api/lotes/madres?codigo=${encodeURIComponent(codigoProyecto)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
        if (!cancelado) setMadres(json.madres ?? []);
      } catch (e: any) {
        if (!cancelado) setError(e.message || 'No se pudo cargar la lista');
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => { cancelado = true; };
  }, [visible, codigoProyecto, token]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.titulo}>Elegir acta madre</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={C.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.sub}>Las zonas que subas desde este teléfono quedan relacionadas con la que elijas.</Text>

          {cargando ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={C.primary} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : !madres.length ? (
            <Text style={styles.vacio}>Todavía no hay actas madre de este proyecto.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 380 }}>
              {madres.map(m => {
                const actual = m.uuid === uuidActual;
                return (
                  <Pressable
                    key={m.uuid}
                    style={({ pressed }) => [styles.item, actual && styles.itemActual, pressed && { opacity: 0.8 }]}
                    onPress={() => onElegir(m)}
                  >
                    <Text style={styles.itemTitulo}>
                      Acta N° {m.acta} · {TIPO_LABEL[m.tipo_acta ?? ''] ?? 'Sin tipo'}
                      {actual ? '  (actual)' : ''}
                    </Text>
                    <Text style={styles.itemMeta} numberOfLines={2}>
                      {(m.direccion ?? '').trim() || 'Sin dirección'}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {new Date(m.creado_en).toLocaleDateString('es-CO')} · {m.zonas} zona{m.zonas === 1 ? '' : 's'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', padding: 20,
  },
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: C.text },
  sub:    { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 4, marginBottom: 12 },
  error:  { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#C62828', marginVertical: 16 },
  vacio:  { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginVertical: 16, textAlign: 'center' },
  item: {
    borderWidth: 1, borderColor: C.border, borderRadius: 12,
    padding: 12, marginBottom: 8, backgroundColor: C.inputBg,
  },
  itemActual: { borderColor: C.primary },
  itemTitulo: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.text },
  itemMeta:   { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 },
});
