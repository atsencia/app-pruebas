// components/EncabezadoInicialModal.tsx
// Popup "Verificar información inicial del acta" de las actas Por Zona de
// Movistar Arena. Muestra el encabezado (cabecera) que se reutiliza en todas
// las zonas y permite editarlo con el lápiz. Editar NUNCA modifica una versión
// existente: crea una nueva (V2, V3…) y las actas ya enviadas conservan la
// versión con la que se llenaron.

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Modal, Pressable, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import ToggleField from '@/components/ToggleField';

const C = Colors.light;

export interface VersionEncabezado {
  numero:   number;
  cabecera: Record<string, any>;
  creadoEn: string;
}

interface Props {
  visible:               boolean;
  versiones:             VersionEncabezado[];
  versionActiva:         number;
  onClose:               () => void;
  onUsarVersion:         (numero: number) => void;
  onGuardarNuevaVersion: (cabecera: Record<string, any>) => void;
}

type Tipo = 'text' | 'num' | 'email' | 'phone' | 'bool' | 'opcion';
interface Def { key: string; label: string; tipo: Tipo; max?: number; fija?: boolean }

const USO_MAX_CHARS = 70;
const OPCIONES_SERVICIO = ['Si', 'No', 'No Aplica'];

// Mismos campos (y etiquetas) que las secciones del formulario que se ocultan
// en una zona. Las coordenadas no están: cada zona captura la suya.
const GRUPOS: { titulo: string; campos: Def[] }[] = [
  { titulo: 'Propietario', campos: [
    { key: 'nombre',     label: 'Nombre completo', tipo: 'text' },
    { key: 'cedula',     label: 'Cédula',          tipo: 'num', max: 12 },
    { key: 'telefono',   label: 'Teléfono',        tipo: 'phone', max: 15 },
    { key: 'propCorreo', label: 'Correo',          tipo: 'email' },
  ]},
  { titulo: 'Interventoría', campos: [
    { key: 'interNombre', label: 'Nombre del delegado', tipo: 'text' },
    { key: 'interCargo',  label: 'Cargo',               tipo: 'text' },
    { key: 'interCorreo', label: 'Correo del delegado', tipo: 'email' },
  ]},
  { titulo: 'Predio', campos: [
    // La dirección de una zona se envía como "solo la zona" y el servidor le
    // antepone la del Acta Inicial, así que aquí no se puede versionar.
    { key: 'direccion',            label: 'Dirección del edificio', tipo: 'text', fija: true },
    { key: 'longitudFrenteYFondo', label: 'Frente y fondo (m)',     tipo: 'text' },
    { key: 'numeroPisos',          label: 'No. de pisos',           tipo: 'num', max: 2 },
    { key: 'estrato',              label: 'Estrato',                tipo: 'num', max: 1 },
    { key: 'anioConstruccion',     label: 'Año de construcción',    tipo: 'num', max: 4 },
    { key: 'estaOcupada',          label: '¿Está ocupada actualmente?', tipo: 'bool' },
  ]},
  { titulo: 'Servicios públicos', campos: [
    { key: 'servicioAgua',           label: 'Agua',           tipo: 'opcion' },
    { key: 'servicioAlcantarillado', label: 'Alcantarillado', tipo: 'opcion' },
    { key: 'servicioEnergia',        label: 'Energía',        tipo: 'opcion' },
    { key: 'servicioTelefono',       label: 'Teléfono',       tipo: 'opcion' },
    { key: 'servicioGas',            label: 'Gas',            tipo: 'opcion' },
    { key: 'servicioOtros',          label: 'Otros',          tipo: 'text' },
  ]},
  { titulo: 'Uso actual del predio', campos: [
    { key: 'usoResidencial',   label: 'Residencial',              tipo: 'text', max: USO_MAX_CHARS },
    { key: 'usoComercial',     label: 'Comercial',                tipo: 'text', max: USO_MAX_CHARS },
    { key: 'usoIndustrial',    label: 'Industrial',               tipo: 'text', max: USO_MAX_CHARS },
    { key: 'usoInstitucional', label: 'Institucional',            tipo: 'text', max: USO_MAX_CHARS },
    { key: 'usoRecreacional',  label: 'Recreacional',             tipo: 'text', max: USO_MAX_CHARS },
    { key: 'usoBaldio',        label: 'Baldío',                   tipo: 'text', max: USO_MAX_CHARS },
    { key: 'usoBIC',           label: 'Bien de Interés Cultural', tipo: 'text', max: USO_MAX_CHARS },
    { key: 'usoMixto',         label: 'Mixto',                    tipo: 'text', max: USO_MAX_CHARS },
    { key: 'usoOtro',          label: 'Otro ¿cuál?',              tipo: 'text', max: USO_MAX_CHARS },
  ]},
  { titulo: 'Acceso vehicular', campos: [
    { key: 'tieneGaraje',          label: '¿Tiene garaje?',             tipo: 'bool' },
    { key: 'cantidadGarajes',      label: 'Cantidad de garajes',        tipo: 'num', max: 2 },
    { key: 'usoGaraje',            label: 'Se usa como',                tipo: 'text' },
    { key: 'usoGarajeComercial',   label: 'Uso comercial',              tipo: 'text' },
    { key: 'usoGarajeResidencial', label: 'Uso residencial',            tipo: 'text' },
    { key: 'anchoAccesoVehicular', label: 'Ancho de acceso vehicular (m)', tipo: 'text' },
  ]},
];

const norm = (v: any) => (typeof v === 'boolean' ? v : String(v ?? '').trim());

export const fechaCorta = (iso?: string) => {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const mostrar = (d: Def, v: any) => {
  if (d.tipo === 'bool') return v ? 'Sí' : 'No';
  const t = String(v ?? '').trim();
  return t || '—';
};

export default function EncabezadoInicialModal({
  visible, versiones, versionActiva, onClose, onUsarVersion, onGuardarNuevaVersion,
}: Props) {
  const [visto,    setVisto]    = useState(versionActiva);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<Record<string, any>>({});

  useEffect(() => {
    if (visible) { setVisto(versionActiva); setEditando(false); }
  }, [visible, versionActiva]);

  if (versiones.length === 0) return null;

  const version   = versiones.find(v => v.numero === visto) ?? versiones[versiones.length - 1];
  const siguiente = Math.max(...versiones.map(v => v.numero)) + 1;
  const valores   = editando ? borrador : version.cabecera;

  const hayCambios = GRUPOS.some(g => g.campos.some(
    d => !d.fija && norm(borrador[d.key]) !== norm(version.cabecera[d.key])
  ));

  const empezarEdicion = () => { setBorrador({ ...version.cabecera }); setEditando(true); };
  const setB = (key: string, v: any) => setBorrador(b => ({ ...b, [key]: v }));

  const guardar = () => {
    const resultado: Record<string, any> = {};
    Object.entries(borrador).forEach(([k, v]) => { resultado[k] = typeof v === 'string' ? v.trim() : v; });
    onGuardarNuevaVersion(resultado);
    setEditando(false);
    onClose();
  };

  const cerrar = () => { if (editando) setEditando(false); else onClose(); };

  const renderFila = (d: Def) => (
    <View key={d.key} style={styles.fila}>
      <Text style={styles.filaLabel}>{d.label}</Text>
      <Text style={styles.filaValor}>{mostrar(d, valores[d.key])}</Text>
      {editando && d.fija ? (
        <Text style={styles.filaNota}>Fija: la define el Acta Inicial.</Text>
      ) : null}
    </View>
  );

  const renderEditor = (d: Def) => {
    if (d.tipo === 'bool') {
      return (
        <View key={d.key} style={styles.editorBloque}>
          <ToggleField label={d.label} value={!!borrador[d.key]} onChange={(v) => setB(d.key, v)} />
        </View>
      );
    }
    if (d.tipo === 'opcion') {
      return (
        <View key={d.key} style={styles.editorBloque}>
          <Text style={styles.editorLabel}>{d.label}</Text>
          <View style={styles.opcionesRow}>
            {OPCIONES_SERVICIO.map(op => {
              const activa = borrador[d.key] === op;
              return (
                <Pressable key={op} onPress={() => setB(d.key, op)}
                  style={[styles.opcionBtn, activa && styles.opcionBtnActiva]}>
                  <Text style={[styles.opcionTxt, activa && styles.opcionTxtActiva]}>{op}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }
    return (
      <View key={d.key} style={styles.editorBloque}>
        <Text style={styles.editorLabel}>{d.label}</Text>
        <TextInput
          style={styles.input}
          value={String(borrador[d.key] ?? '')}
          onChangeText={(v) => setB(d.key, d.tipo === 'num' ? v.replace(/\D/g, '') : v)}
          keyboardType={d.tipo === 'num' ? 'numeric' : d.tipo === 'phone' ? 'phone-pad' : d.tipo === 'email' ? 'email-address' : 'default'}
          autoCapitalize={d.tipo === 'email' ? 'none' : 'sentences'}
          maxLength={d.max}
          placeholder="—"
          placeholderTextColor={C.textSecondary}
        />
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cerrar}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={editando ? undefined : onClose} />

        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconBg}>
              <Feather name="file-text" size={18} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Información inicial del acta</Text>
              <Text style={styles.subtitle}>
                {editando
                  ? `Editando a partir de V${visto} · se guardará como V${siguiente}`
                  : `Encabezado V${visto}${fechaCorta(version.creadoEn) ? ` · ${fechaCorta(version.creadoEn)}` : ''}`}
              </Text>
            </View>
            {!editando && (
              <Pressable
                style={({ pressed }) => [styles.lapizBtn, pressed && { opacity: 0.7 }]}
                onPress={empezarEdicion}
                hitSlop={8}
                accessibilityLabel="Editar información inicial"
              >
                <Feather name="edit-2" size={16} color={C.primary} />
              </Pressable>
            )}
          </View>

          {/* Versiones */}
          {!editando && (
            <View style={styles.versionesBloque}>
              <Text style={styles.enUso}>
                Esta acta se llenará con el encabezado <Text style={styles.enUsoNum}>V{versionActiva}</Text>
              </Text>
              {versiones.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                  {versiones.map(v => (
                    <Pressable key={v.numero} onPress={() => setVisto(v.numero)}
                      style={[styles.chip, v.numero === visto && styles.chipActivo]}>
                      <Text style={[styles.chipTxt, v.numero === visto && styles.chipTxtActivo]}>V{v.numero}</Text>
                      {v.numero === versionActiva && (
                        <Feather name="check" size={11} color={v.numero === visto ? '#fff' : C.accent} />
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Cuerpo */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
            {GRUPOS.map(g => (
              <View key={g.titulo} style={styles.grupo}>
                <Text style={styles.grupoTitulo}>{g.titulo}</Text>
                {g.campos.map(d => (editando && !d.fija ? renderEditor(d) : renderFila(d)))}
              </View>
            ))}
          </ScrollView>

          {/* Pie */}
          <View style={styles.footer}>
            {editando ? (
              <>
                <Text style={styles.footerNota}>Las actas ya enviadas conservan la versión con la que se llenaron.</Text>
                <View style={styles.footerRow}>
                  <Pressable style={[styles.btn, styles.btnSec]} onPress={() => setEditando(false)}>
                    <Text style={styles.btnSecTxt}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.btnPri, !hayCambios && styles.btnDis]}
                    onPress={guardar} disabled={!hayCambios}>
                    <Feather name="save" size={14} color="#fff" />
                    <Text style={styles.btnPriTxt}>Guardar como V{siguiente}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.footerRow}>
                <Pressable style={[styles.btn, styles.btnSec]} onPress={onClose}>
                  <Text style={styles.btnSecTxt}>Cerrar</Text>
                </Pressable>
                {visto !== versionActiva && (
                  <Pressable style={[styles.btn, styles.btnPri]}
                    onPress={() => { onUsarVersion(visto); onClose(); }}>
                    <Feather name="check" size={14} color="#fff" />
                    <Text style={styles.btnPriTxt}>Usar V{visto} en esta acta</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: C.card, borderRadius: 20, maxHeight: '90%', overflow: 'hidden' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  iconBg: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.primary + '15', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', color: C.text },
  subtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary, marginTop: 2 },
  lapizBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1.5, borderColor: C.primary + '40',
    backgroundColor: C.primary + '10', justifyContent: 'center', alignItems: 'center' },

  versionesBloque: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  enUso: { fontSize: 12, fontFamily: 'Inter_400Regular', color: C.textSecondary },
  enUsoNum: { fontFamily: 'Inter_700Bold', color: C.primary },
  chipsRow: { gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.inputBg },
  chipActivo: { backgroundColor: C.primary, borderColor: C.primary },
  chipTxt: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
  chipTxtActivo: { color: '#fff' },

  body: { flexShrink: 1, borderTopWidth: 1, borderTopColor: C.border },
  bodyContent: { padding: 16, gap: 18 },
  grupo: { gap: 8 },
  grupoTitulo: { fontSize: 10, fontFamily: 'Inter_700Bold', color: C.primary, letterSpacing: 1.2, textTransform: 'uppercase' },

  fila: { backgroundColor: C.inputBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, gap: 2 },
  filaLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  filaValor: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.text },
  filaNota: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary, fontStyle: 'italic' },

  editorBloque: { gap: 6 },
  editorLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { backgroundColor: C.inputBg, borderRadius: 13, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: 'Inter_400Regular', color: C.text },
  opcionesRow: { flexDirection: 'row', gap: 8 },
  opcionBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
    borderColor: C.border, backgroundColor: C.inputBg },
  opcionBtnActiva: { backgroundColor: C.primary, borderColor: C.primary },
  opcionTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
  opcionTxtActiva: { color: '#fff' },

  footer: { padding: 14, gap: 10, borderTopWidth: 1, borderTopColor: C.border },
  footerNota: { fontSize: 11, fontFamily: 'Inter_400Regular', color: C.textSecondary, textAlign: 'center' },
  footerRow: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 13, borderRadius: 13 },
  btnPri: { backgroundColor: C.primary },
  btnPriTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  btnSec: { backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.border },
  btnSecTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: C.textSecondary },
  btnDis: { opacity: 0.4 },
});
