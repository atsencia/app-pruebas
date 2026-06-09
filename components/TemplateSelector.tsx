import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Pressable, FlatList, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { usePredioTemplates } from '@/store/zustand-state';

const C = Colors.light;

interface Props {
  onAplicar: (campos: Record<string, any>) => void;
  onGuardarActual: () => void;   // abre el flujo de guardar plantilla
}

export default function TemplateSelector({ onAplicar, onGuardarActual }: Props) {
  const { templates, eliminarTemplate, getFieldsParaForm } = usePredioTemplates();
  const [modalVisible, setModalVisible] = useState(false);

  const aplicar = (id: string) => {
    const campos = getFieldsParaForm(id);
    if (!campos) return;
    onAplicar(campos);
    setModalVisible(false);
  };

  const confirmarEliminar = (id: string, nombre: string) => {
    Alert.alert(
      'Eliminar plantilla',
      `¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => eliminarTemplate(id) },
      ]
    );
  };

  return (
    <View style={styles.container}>

      {/* Botones de acción */}
      <View style={styles.row}>
        {templates.length > 0 && (
          <TouchableOpacity style={styles.btnAplicar} onPress={() => setModalVisible(true)}>
            <Feather name="copy" size={14} color={C.primary} />
            <Text style={styles.btnAplicarText}>Usar plantilla</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{templates.length}</Text>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.btnGuardar} onPress={onGuardarActual}>
          <Feather name="bookmark" size={14} color={C.textSecondary} />
          <Text style={styles.btnGuardarText}>Guardar como plantilla</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de selección */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>

            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>Plantillas de predio</Text>
            <Text style={styles.sheetSubtitle}>
              Selecciona una para rellenar automáticamente los datos del predio
            </Text>

            <FlatList
              data={templates}
              keyExtractor={t => t.id}
              contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
              renderItem={({ item }) => (
                <View style={styles.templateItem}>
                  <TouchableOpacity style={styles.templateMain} onPress={() => aplicar(item.id)}>
                    <View style={styles.templateIconBg}>
                      <Feather name="home" size={16} color={C.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.templateNombre}>{item.nombre}</Text>
                      <Text style={styles.templateMeta}>
                        {item.datos.direccion
                          ? item.datos.direccion.substring(0, 45)
                          : 'Sin dirección'}
                        {' · '}
                        {new Date(item.creadoEn).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={C.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.templateDelete}
                    onPress={() => confirmarEliminar(item.id, item.nombre)}
                    hitSlop={8}
                  >
                    <Feather name="trash-2" size={15} color={C.error} />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Feather name="inbox" size={32} color={C.textSecondary} style={{ opacity: 0.3 }} />
                  <Text style={styles.emptyText}>Sin plantillas guardadas</Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 0 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  btnAplicar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.primary + '12', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: C.primary + '30',
  },
  btnAplicarText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.primary },
  badge: {
    backgroundColor: C.primary, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center',
  },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },

  btnGuardar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.inputBg, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: C.border,
  },
  btnGuardarText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: C.textSecondary },

  // Sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '70%',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: C.border, alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle:    { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text, marginBottom: 4 },
  sheetSubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginBottom: 16, lineHeight: 19 },

  templateItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.inputBg, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  templateMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  templateIconBg: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.primary + '15', justifyContent: 'center', alignItems: 'center',
  },
  templateNombre: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
  templateMeta:   { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 },
  templateDelete: { padding: 14, borderLeftWidth: 1, borderLeftColor: C.border },

  empty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary },
});