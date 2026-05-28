// components/ActasMovistar.tsx
// Desplegable en el sidebar con actas precargadas como botones directos.
// Sin buscador — el admin carga las direcciones en ACTAS_PREDETERMINADAS.

import React, { useState, useRef } from 'react';
import {
  View, Text, Pressable, ScrollView,
  StyleSheet, Animated, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useFormStore } from '@/store/zustand-state';
import Colors from '@/constants/colors';

const C = Colors.light;

// ─────────────────────────────────────────────────────────────────
// ARRAY PREDETERMINADO — editar aquí para agregar / quitar actas
// ─────────────────────────────────────────────────────────────────
interface ActaPredeterminada {
  registro_uuid: string;
  direccion:     string;
  nombre?:       string;     // nombre del propietario / referencia (opcional)
  tipo_acta?:    string;
  estado?:       'pendiente' | 'firmada' | 'revisada' | 'correcta' | 'devuelta';
}

const ACTAS_PREDETERMINADAS: ActaPredeterminada[] = [
  {
    registro_uuid: '202605061520212_E81F',
    direccion: 'Calle 65 bis 86 86, Zona 2B',
    nombre: 'Alejandra Leon',
   },
  {
    registro_uuid: '202605061516167_VJMB',
    direccion: 'Calle 182-218 #171, Zona B',
    nombre: 'Jorge Alejandro Toro',
   },
  {
    registro_uuid: '202605061444061_7IJB',
    direccion: 'Movistar, Zona C',
    nombre: 'Alejandro Toro',
   },
  {
    registro_uuid: '202605061215338_8EEK',
    direccion: 'Dirección Chapinero de prueba, Zona B movistar',
    nombre: 'Roberto Gómez Bolaños',
   }
   
];
// ─────────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  pendiente: { color: '#DD6B20', label: 'Pendiente', icon: 'clock'      },
  firmada:   { color: '#2563EB', label: 'Firmada',   icon: 'check'      },
  revisada:  { color: '#7C3AED', label: 'Revisada',  icon: 'eye'        },
  correcta:  { color: '#16A34A', label: 'Correcta',  icon: 'check-circle'},
  devuelta:  { color: '#DC2626', label: 'Devuelta',  icon: 'alert-circle'},
};

interface Props {
  onActaSeleccionada: (registro_uuid: string) => void;
}

export default function ActasMovistar({ onActaSeleccionada }: Props) {
  const clearForm = useFormStore(s => s.clearForm);

  const [abierto, setAbierto] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggleAbierto = () => {
    const siguiente = !abierto;
    setAbierto(siguiente);
    Animated.timing(anim, {
      toValue:         siguiente ? 1 : 0,
      duration:        220,
      useNativeDriver: false,
    }).start();
  };

  const seleccionar = (item: ActaPredeterminada) => {
    Alert.alert(
      'Cargar acta',
      `¿Editar el acta de:\n${item.direccion}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cargar',
          onPress: () => {
            clearForm();
            onActaSeleccionada(item.registro_uuid);
          },
        },
      ]
    );
  };

  const total     = ACTAS_PREDETERMINADAS.length;
  const pendientes = ACTAS_PREDETERMINADAS.filter(a => a.estado === 'pendiente' || a.estado === 'devuelta').length;

  return (
    <View style={styles.wrapper}>

      {/* ── Cabecera ── */}
      <Pressable
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.8 }]}
        onPress={toggleAbierto}
      >
        <View style={[styles.iconBg, abierto && styles.iconBgActive]}>
          <Feather name="briefcase" size={15} color={abierto ? '#fff' : C.primary} />
        </View>

        <View style={styles.headerText}>
          <Text style={[styles.headerLabel, abierto && { color: C.primary }]}>
            Actas Movistar
          </Text>
          
        </View>

        
        <Feather
          name={abierto ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={C.textSecondary}
          style={{ marginLeft: 4 }}
        />
      </Pressable>

      {/* ── Cuerpo desplegable ── */}
      {abierto && (
        <View style={styles.body}>

          {ACTAS_PREDETERMINADAS.length === 0 ? (
            <View style={styles.emptyMsg}>
              <Feather name="inbox" size={16} color={C.textSecondary} />
              <Text style={styles.emptyText}>Sin actas precargadas</Text>
            </View>
          ) : (
            ACTAS_PREDETERMINADAS.map((item, index) => {
              const cfg = ESTADO_CONFIG[item.estado ?? ''] ?? {
                color: C.textSecondary,
                label: item.estado ?? '—',
                icon:  'circle',
              };

              return (
                <Pressable
                  key={item.registro_uuid}
                  style={({ pressed }) => [
                    styles.item,
                    pressed && styles.itemPressed,
                  ]}
                  onPress={() => seleccionar(item)}
                >
                  {/* Número de orden */}
                  <View style={styles.indexBg}>
                    <Text style={styles.indexText}>{index + 1}</Text>
                  </View>

                  {/* Texto */}
                  <View style={styles.itemContent}>
                    <Text style={styles.itemDir} numberOfLines={2}>
                      {item.direccion}
                    </Text>
                    {item.nombre ? (
                      <Text style={styles.itemNombre} numberOfLines={1}>
                        {item.nombre}
                      </Text>
                    ) : null}
                  </View>

                  {/* Estado + flecha */}
                  <View style={styles.itemRight}>
                    <View style={[styles.estadoBadge, { backgroundColor: cfg.color + '18' }]}>
                      {/* <Feather name={cfg.icon as any} size={9} color={cfg.color} /> */}
                      {/* <Text style={[styles.estadoText, { color: cfg.color }]}>
                        {cfg.label}
                      </Text> */}
                    </View>
                    <Feather
                      name="chevron-right"
                      size={12}
                      color={C.textSecondary}
                      style={{ marginTop: 3 }}
                    />
                  </View>
                </Pressable>
              );
            })
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

  // ── Header ──
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

  // Badge rojo de pendientes en el header
  badge: {
    backgroundColor: '#DC2626',
    borderRadius:    20,
    minWidth:        18,
    height:          18,
    paddingHorizontal: 5,
    justifyContent:  'center',
    alignItems:      'center',
  },
  badgeText: {
    fontSize:   10,
    fontFamily: 'Inter_700Bold',
    color:      '#fff',
  },

  // ── Body ──
  body: {
    borderTopWidth:    1,
    borderTopColor:    C.border,
    paddingHorizontal: 8,
    paddingVertical:   8,
    gap:               5,
  },

  emptyMsg: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             6,
    paddingVertical: 14,
  },
  emptyText: {
    fontSize:   12,
    fontFamily: 'Inter_400Regular',
    color:      C.textSecondary,
  },

  // ── Item / botón ──
  item: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             9,
    backgroundColor: C.card,
    borderRadius:    10,
    padding:         10,
    borderWidth:     1,
    borderColor:     C.border,
  },
  itemPressed: {
    opacity:         0.72,
    backgroundColor: C.primary + '08',
  },

  indexBg: {
    width:           26,
    height:          26,
    borderRadius:    8,
    backgroundColor: C.primary + '12',
    justifyContent:  'center',
    alignItems:      'center',
    flexShrink:      0,
  },
  indexText: {
    fontSize:   11,
    fontFamily: 'Inter_700Bold',
    color:      C.primary,
  },

  itemContent: { flex: 1 },
  itemDir: {
    fontSize:   12,
    fontFamily: 'Inter_600SemiBold',
    color:      C.text,
    lineHeight: 16,
  },
  itemNombre: {
    fontSize:   11,
    fontFamily: 'Inter_400Regular',
    color:      C.textSecondary,
    marginTop:  2,
  },

  itemRight: {
    alignItems: 'center',
    gap:        2,
    flexShrink: 0,
  },
  estadoBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             3,
    borderRadius:    20,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  estadoText: {
    fontSize:   10,
    fontFamily: 'Inter_600SemiBold',
  },
});