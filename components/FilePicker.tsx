import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.light;
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface PickedFile {
  name: string;
  uri: string;
  size: number;
}

interface FilePickerProps {
  label: string;
  value: PickedFile | null;
  onChange: (file: PickedFile | null) => void;
}

export const FilePicker = ({ label, value, onChange }: FilePickerProps) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pick = async () => {
    setError(null);
    try {
      setLoading(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,   // expo-file-system puede leerlo desde cache
      });

      // Usuario canceló
      if (result.canceled) return;

      const asset = result.assets[0];

      // Validar tamaño — expo nos da el size directamente
      if (asset.size && asset.size > MAX_SIZE_BYTES) {
        setError(`El archivo supera el límite de ${MAX_SIZE_MB} MB.`);
        return;
      }

      // Copiar a directorio de documentos para acceso persistente
      const destUri = Paths.document + "/" + asset.name;
      const file = new File(asset.uri);
        await file.copy(new File(destUri));

      onChange({
        name: asset.name,
        uri: destUri,
        size: asset.size ?? 0,
      });

    } catch (e) {
      setError("No se pudo seleccionar el archivo.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const remove = () => {
    onChange(null);
    setError(null);
  };

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      {!value ? (
        <TouchableOpacity style={styles.button} onPress={pick} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={C.primary} />
          ) : (
            <>
              <Feather name="paperclip" size={16} color={C.primary} />
              <Text style={styles.buttonText}>Seleccionar PDF</Text>
              <Text style={styles.buttonHint}>Máx. {MAX_SIZE_MB} MB</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.fileCard}>
          <Feather name="file-text" size={22} color={C.primary} />
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>{value.name}</Text>
            <Text style={styles.fileSize}>{formatSize(value.size)}</Text>
          </View>
          <TouchableOpacity onPress={remove} hitSlop={8}>
            <Feather name="x-circle" size={18} color="#A32D2D" />
          </TouchableOpacity>
        </View>
      )}

      {error && (
        <View style={styles.errorRow}>
          <Feather name="alert-circle" size={12} color="#A32D2D" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container:  { gap: 6 },
  label:      { fontSize: 12, fontFamily: "Inter_600SemiBold", color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  button:     {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1.5, borderColor: C.primary, borderStyle: "dashed",
    borderRadius: 12, padding: 14, backgroundColor: C.inputBg,
  },
  buttonText: { flex: 1, color: C.primary, fontFamily: "Inter_500Medium", fontSize: 14 },
  buttonHint: { color: C.textSecondary, fontFamily: "Inter_400Regular", fontSize: 12 },
  fileCard:   {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: C.border, borderRadius: 12,
    padding: 12, backgroundColor: C.inputBg,
  },
  fileInfo:   { flex: 1 },
  fileName:   { fontSize: 13, fontFamily: "Inter_500Medium", color: C.text },
  fileSize:   { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary, marginTop: 2 },
  errorRow:   { flexDirection: "row", alignItems: "center", gap: 4 },
  errorText:  { fontSize: 11, fontFamily: "Inter_400Regular", color: "#A32D2D" },
});