import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import Colors from '@/constants/colors';

const C = Colors.light;

export default function QueueStatusBar({ onPress }: { onPress?: () => void }) {
  const { pendientes, subiendo, errores, completados, sinConexion } = useUploadQueue();
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  // Pulso animado mientras hay subida activa
  useEffect(() => {
    if (subiendo.length > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [subiendo.length]);

  const total = pendientes.length + subiendo.length;
  if (total === 0 && errores.length === 0) return null;

  // Color y mensaje según estado
  let color = C.primary;
  let icono: any = 'upload-cloud';
  let mensaje = '';

  if (errores.length > 0 && total === 0) {
    color   = '#E53E3E';
    icono   = 'alert-circle';
    mensaje = `${errores.length} acta${errores.length > 1 ? 's' : ''} con error`;
  } else if (sinConexion) {
    color   = '#DD6B20';
    icono   = 'wifi-off';
    mensaje = `${total} acta${total > 1 ? 's' : ''} esperando conexión`;
  } else if (subiendo.length > 0) {
    color   = '#2E7D32';
    icono   = 'upload-cloud';
    mensaje = `Subiendo acta... (${pendientes.length} en cola)`;
  } else {
    color   = C.primary;
    icono   = 'clock';
    mensaje = `${total} acta${total > 1 ? 's' : ''} en cola`;
  }

  return (
    <Pressable
      onPress={onPress}
      style={[styles.bar, { backgroundColor: color + '18', borderColor: color + '40' }]}
    >
      <Animated.View style={{ opacity: subiendo.length > 0 ? pulseAnim : 1 }}>
        <Feather name={icono} size={14} color={color} />
      </Animated.View>
      <Text style={[styles.text, { color }]}>{mensaje}</Text>
      {errores.length > 0 && total > 0 && (
        <View style={[styles.badge, { backgroundColor: '#E53E3E' }]}>
          <Text style={styles.badgeText}>{errores.length}</Text>
        </View>
      )}
      <Feather name="chevron-right" size={13} color={color} style={{ marginLeft: 'auto' }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 8, marginVertical: 4,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
  },
  text:      { fontSize: 12, fontFamily: 'Inter_500Medium', flex: 1 },
  badge:     { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },
});