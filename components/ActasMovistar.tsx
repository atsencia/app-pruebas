// components/ActasMovistar.tsx
// Desplegable en el sidebar que permite buscar y cargar
// actas pre-cargadas por dirección para completarlas.

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  StyleSheet, Animated, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useFormStore } from '@/store/zustand-state';
import Colors from '@/constants/colors';

const C = Colors.light;
const API = 'https://187.33.154.112.sslip.io/backend/api';

interface RegistroPreview {
  registro_uuid: string;
  nombre:        string;
  cedula:        string;
  direccion:     string;
  tipo_acta:     string | null;
  estado:        string | null;
}

interface Props {
  onActaSeleccionada: (registro_uuid: string) => void; // cierra sidebar y carga el acta
}

export default function ActasMovistar({ onActaSeleccionada }: Props) {
  const { user }    = useAuth();
  const clearForm   = useFormStore(s => s.clearForm);

  const [abierto,    setAbierto]    = useState(false);
  const [query,      setQuery]      = useState('');
  const [resultados, setResultados] = useState<RegistroPreview[]>([]);
  const [cargando,   setCargando]   = useState(false);
  const [buscado,    setBuscado]    = useState(false);

  const anim     = useRef(new Animated.Value(0)).current;
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleAbierto = () => {
    const siguiente = !abierto;
    setAbierto(siguiente);
    Animated.timing(anim, {
      toValue:         siguiente ? 1 : 0,
      duration:        220,
      useNativeDriver: false,
    }).start();
    if (!siguiente) {
      setQuery('');
      setResultados([]);
      setBuscado(false);
    }
  };

  const buscar = useCallback(async (texto: string) => {
    if (texto.trim().length < 2) {
      setResultados([]);
      setBuscado(false);
      return;
    }
    setCargando(true);
    try {
      const res = await fetch(
        `${API}/registros/buscar?q=${encodeURIComponent(texto.trim())}`,
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );
      if (!res.ok) throw new Error('Error en la búsqueda');
      const data = await res.json();
      setResultados(data.data ?? []);
      setBuscado(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo buscar');
    } finally {
      setCargando(false);
    }
  }, [user?.token]);

  const onChangeText = (v: string) => {
    setQuery(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => buscar(v), 500);
  };

  const seleccionar = (item: RegistroPreview) => {
    Alert.alert(
      'Cargar acta',
      `¿Cargar el acta de:\n${item.direccion}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cargar',
          onPress: () => {
            clearForm();                        // limpiar form actual
            onActaSeleccionada(item.registro_uuid); // el padre cierra sidebar y navega
          },
        },
      ]
    );
  };

  // Badge de estado
  const estadoConfig: Record<string, { color: string; label: string }> = {
    pendiente: { color: '#DD6B20', label: 'Pendiente' },
    firmada:   { color: '#2563EB', label: 'Firmada'   },
    revisada:  { color: '#7C3AED', label: 'Revisada'  },
    correcta:  { color: '#16A34A', label: 'Correcta'  },
    devuelta:  { color: '#DC2626', label: 'Devuelta'  },
  };

  return (
    <View style={styles.wrapper}>
      {/* Cabecera del desplegable */}
      <Pressable
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.75 }]}
        onPress={toggleAbierto}
      >
        <View style={[styles.iconBg, abierto && styles.iconBgActive]}>
          <Feather name="briefcase" size={16} color={abierto ? '#fff' : C.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.headerLabel, abierto && { color: C.primary }]}>
            Actas Movistar
          </Text>
          <Text style={styles.headerDesc}>Predios pre-cargados</Text>
        </View>
        <Feather
          name={abierto ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={C.textSecondary}
        />
      </Pressable>

      {/* Cuerpo desplegable */}
      {abierto && (
        <View style={styles.body}>
          {/* Buscador */}
          <View style={styles.searchRow}>
            <Feather name="search" size={14} color={C.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por dirección..."
              placeholderTextColor={C.textSecondary}
              value={query}
              onChangeText={onChangeText}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={() => buscar(query)}
            />
            {cargando && (
              <ActivityIndicator size="small" color={C.primary} style={{ marginRight: 8 }} />
            )}
            {query.length > 0 && !cargando && (
              <Pressable onPress={() => { setQuery(''); setResultados([]); setBuscado(false); }} hitSlop={8}>
                <Feather name="x" size={14} color={C.textSecondary} style={{ marginRight: 8 }} />
              </Pressable>
            )}
          </View>

          {/* Resultados */}
          {buscado && resultados.length === 0 && !cargando && (
            <View style={styles.emptyMsg}>
              <Feather name="inbox" size={16} color={C.textSecondary} />
              <Text style={styles.emptyText}>Sin resultados para "{query}"</Text>
            </View>
          )}

          {!buscado && !cargando && (
            <Text style={styles.hint}>
              Escribe al menos 2 caracteres de la dirección
            </Text>
          )}

          {resultados.map((item) => {
            const cfg = estadoConfig[item.estado ?? ''] ?? { color: C.textSecondary, label: item.estado ?? '—' };
            return (
              <Pressable
                key={item.registro_uuid}
                style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}
                onPress={() => seleccionar(item)}
              >
                <View style={styles.itemIconBg}>
                  <Feather name="home" size={13} color={C.primary} />
                </View>
                <View style={styles.itemText}>
                  <Text style={styles.itemDir} numberOfLines={2}>{item.direccion}</Text>
                  {item.nombre ? (
                    <Text style={styles.itemNombre} numberOfLines={1}>{item.nombre}</Text>
                  ) : null}
                </View>
                <View style={styles.itemRight}>
                  <View style={[styles.estadoBadge, { backgroundColor: cfg.color + '18' }]}>
                    <Text style={[styles.estadoText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  <Feather name="chevron-right" size={12} color={C.textSecondary} style={{ marginTop: 4 }} />
                </View>
              </Pressable>
            );
          })}
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
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    paddingHorizontal: 10,
    paddingVertical:   13,
  },
  iconBg: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  iconBgActive: { backgroundColor: C.primary },
  headerText:   { flex: 1 },
  headerLabel:  { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: C.text },
  headerDesc:   { fontSize: 11, fontFamily: 'Inter_400Regular',  color: C.textSecondary, marginTop: 1 },

  body: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 10,
    paddingBottom:     10,
    gap: 6,
  },

  searchRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.card,
    borderRadius:    10,
    borderWidth:     1.5,
    borderColor:     C.border,
    marginTop:       8,
  },
  searchIcon:  { marginLeft: 10 },
  searchInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical:   10,
    fontSize:          13,
    fontFamily:        'Inter_400Regular',
    color:             C.text,
  },

  hint: {
    fontSize:   11,
    fontFamily: 'Inter_400Regular',
    color:      C.textSecondary,
    textAlign:  'center',
    paddingVertical: 8,
  },

  emptyMsg: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    paddingVertical: 12,
  },
  emptyText: {
    fontSize:   12,
    fontFamily: 'Inter_400Regular',
    color:      C.textSecondary,
  },

  item: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            10,
    backgroundColor: C.card,
    borderRadius:   10,
    padding:        10,
    borderWidth:    1,
    borderColor:    C.border,
    marginTop:      4,
  },
  itemIconBg: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: C.primary + '12',
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  itemText:   { flex: 1 },
  itemDir:    { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.text, lineHeight: 16 },
  itemNombre: { fontSize: 11, fontFamily: 'Inter_400Regular',  color: C.textSecondary, marginTop: 2 },
  itemRight:  { alignItems: 'center', gap: 2 },
  estadoBadge:{ borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2 },
  estadoText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});