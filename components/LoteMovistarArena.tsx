// components/LoteMovistarArena.tsx
// Apartado del sidebar para subir actas del proyecto Movistar Arena en lote:
// la acta inicial define la cabecera (dirección, servicios, usos, etc.) y
// las zonas siguientes la reciben precargada (editable) al abrirse.

import React, { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';

const C = Colors.light;

interface LoteActivo {
  codigoProyecto: string;
  cabecera: Record<string, any>;
  iniciadoEn: string;
  totalZonas: number;
}

interface Props {
  loteActivo: LoteActivo | null;
  onNuevaActaInicial: () => void;
  onNuevaZona: () => void;
  onCerrarLote: () => void;
}

export default function LoteMovistarArena({
  loteActivo, onNuevaActaInicial, onNuevaZona, onCerrarLote,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggleAbierto = () => {
    const siguiente = !abierto;
    setAbierto(siguiente);
    Animated.timing(anim, { toValue: siguiente ? 1 : 0, duration: 220, useNativeDriver: false }).start();
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.8 }]}
        onPress={toggleAbierto}
      >
        <View style={[styles.iconBg, abierto && styles.iconBgActive]}>
          <Feather name="layers" size={15} color={abierto ? '#fff' : C.primary} />
        </View>

        <View style={styles.headerText}>
          <Text style={[styles.headerLabel, abierto && { color: C.primary }]}>
            Movistar Arena
          </Text>
          {loteActivo && (
            <Text style={styles.headerDesc}>
              Lote activo · {loteActivo.totalZonas} zona{loteActivo.totalZonas === 1 ? '' : 's'}
            </Text>
          )}
        </View>

        <Feather
          name={abierto ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={C.textSecondary}
          style={{ marginLeft: 4 }}
        />
      </Pressable>

      {abierto && (
        <View style={styles.body}>
          {loteActivo ? (
            <>
              <View style={styles.resumenCard}>
                <Text style={styles.resumenDireccion} numberOfLines={2}>
                  {(loteActivo.cabecera.direccion || '').trim() || 'Sin dirección'}
                </Text>
                <Text style={styles.resumenMeta}>
                  {loteActivo.totalZonas} zona{loteActivo.totalZonas === 1 ? '' : 's'} subida{loteActivo.totalZonas === 1 ? '' : 's'}
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.itemPressed]}
                onPress={onNuevaZona}
              >
                <Feather name="plus" size={14} color="#fff" />
                <Text style={styles.btnPrimaryText}>Nueva Zona</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.btn, pressed && styles.itemPressed]}
                onPress={onNuevaActaInicial}
              >
                <Feather name="refresh-cw" size={13} color={C.primary} />
                <Text style={styles.btnText}>Nueva Acta Inicial</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.btnSecundario, pressed && { opacity: 0.7 }]}
                onPress={onCerrarLote}
              >
                <Feather name="x-circle" size={12} color={C.textSecondary} />
                <Text style={styles.btnSecundarioText}>Cerrar lote</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.emptyMsg}>
                <Feather name="inbox" size={16} color={C.textSecondary} />
                <Text style={styles.emptyText}>Sin lote activo</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.itemPressed]}
                onPress={onNuevaActaInicial}
              >
                <Feather name="plus" size={14} color="#fff" />
                <Text style={styles.btnPrimaryText}>Nueva Acta Inicial</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 8,
    marginVertical:   4,
    borderRadius:     13,
    overflow:         'hidden',
    backgroundColor:  C.inputBg,
    borderWidth:      1,
    borderColor:      C.border,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    paddingHorizontal: 10,
    paddingVertical:   13,
  },
  iconBg: {
    width:           34,
    height:          34,
    borderRadius:    10,
    backgroundColor: C.primary + '15',
    justifyContent:  'center',
    alignItems:      'center',
  },
  iconBgActive: { backgroundColor: C.primary },
  headerText:   { flex: 1 },
  headerLabel: {
    fontSize:   14,
    fontFamily: 'Inter_600SemiBold',
    color:      C.text,
  },
  headerDesc: {
    fontSize:   11,
    fontFamily: 'Inter_400Regular',
    color:      C.textSecondary,
    marginTop:  1,
  },

  body: {
    borderTopWidth:    1,
    borderTopColor:    C.border,
    paddingHorizontal: 8,
    paddingVertical:   8,
    gap:               6,
  },

  emptyMsg: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    paddingVertical: 10,
  },
  emptyText: {
    fontSize:   12,
    fontFamily: 'Inter_400Regular',
    color:      C.textSecondary,
  },

  resumenCard: {
    backgroundColor: C.card,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         10,
    marginBottom:    2,
  },
  resumenDireccion: {
    fontSize:   12,
    fontFamily: 'Inter_600SemiBold',
    color:      C.text,
    lineHeight: 16,
  },
  resumenMeta: {
    fontSize:   11,
    fontFamily: 'Inter_400Regular',
    color:      C.textSecondary,
    marginTop:  3,
  },

  btn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               6,
    borderRadius:      10,
    paddingVertical:   9,
    borderWidth:       1,
    borderColor:       C.border,
    backgroundColor:   C.card,
  },
  btnText: {
    fontSize:   12,
    fontFamily: 'Inter_600SemiBold',
    color:      C.primary,
  },
  btnPrimary: {
    backgroundColor: C.primary,
    borderColor:     C.primary,
  },
  btnPrimaryText: {
    fontSize:   12,
    fontFamily: 'Inter_600SemiBold',
    color:      '#fff',
  },
  itemPressed: { opacity: 0.8 },

  btnSecundario: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            5,
    paddingVertical: 6,
  },
  btnSecundarioText: {
    fontSize:   11,
    fontFamily: 'Inter_400Regular',
    color:      C.textSecondary,
  },
});
