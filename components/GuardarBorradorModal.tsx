import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  Modal, TouchableOpacity, Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';

const C = Colors.light;

interface Props {
  visible: boolean;
  nombreSugerido?: string;    // ej: dirección del predio
  onGuardar: (nombre: string) => void;
  onCancelar: () => void;
}

export default function GuardarBorradorModal({ visible, nombreSugerido, onGuardar, onCancelar }: Props) {
  const [nombre, setNombre] = useState(nombreSugerido ?? '');

  // Sincronizar si cambia el sugerido al abrir
  React.useEffect(() => {
    if (visible) setNombre(nombreSugerido ?? '');
  }, [visible, nombreSugerido]);

  const confirmar = () => {
    const val = nombre.trim();
    if (!val) return;
    onGuardar(val);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancelar}>
      <Pressable style={styles.backdrop} onPress={onCancelar}>
        <Pressable style={styles.card} onPress={() => {}}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconBg}>
              <Feather name="save" size={18} color={C.primary} />
            </View>
            <Text style={styles.title}>Guardar borrador</Text>
          </View>

          <Text style={styles.subtitle}>
            El borrador se guardará localmente. Podrás subir cuando tengas conexión.
          </Text>

          {/* Input nombre */}
          <Text style={styles.label}>Nombre del borrador</Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Ej: Movistar Arena - Apto 301"
            placeholderTextColor={C.textSecondary}
            autoFocus
            maxLength={80}
            returnKeyType="done"
            onSubmitEditing={confirmar}
          />
          <Text style={styles.hint}>{nombre.trim().length}/80</Text>

          {/* Botones */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnCancelar} onPress={onCancelar}>
              <Text style={styles.btnCancelarText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnGuardar, !nombre.trim() && styles.btnDisabled]}
              onPress={confirmar}
              disabled={!nombre.trim()}
            >
              <Feather name="save" size={15} color="#fff" />
              <Text style={styles.btnGuardarText}>Guardar</Text>
            </TouchableOpacity>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    width: '100%', backgroundColor: '#fff',
    borderRadius: 20, padding: 24, gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBg: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  title:    { fontSize: 17, fontFamily: 'Inter_700Bold', color: C.text },
  subtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: C.textSecondary, lineHeight: 19 },
  label:    { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    backgroundColor: C.inputBg, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, fontFamily: 'Inter_400Regular', color: C.text,
  },
  hint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'right', marginTop: -6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnCancelar: {
    flex: 1, paddingVertical: 14, borderRadius: 13,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center',
  },
  btnCancelarText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
  btnGuardar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 13, backgroundColor: C.primary,
  },
  btnDisabled:    { opacity: 0.4 },
  btnGuardarText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});