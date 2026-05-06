// components/PhotoPickerSection.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  Platform,
  TextInput,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.light;
// const MAX_PHOTOS = 6;  ← Eliminado

interface Props {
  photos: { uri: string; descripcion: string }[];
  onPhotosChange: (photos: { uri: string; descripcion: string }[]) => void;
  showDescription?: boolean;
  maxPhotos?: number; // ← Ahora es opcional (si no lo pasas = sin límite)
}

export default function PhotoPickerSection({
  photos,
  onPhotosChange,
  showDescription = false,
  maxPhotos,
}: Props) {
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = ImagePicker.useMediaLibraryPermissions();

  const hasLimit = maxPhotos !== undefined;
  const currentCount = photos.length;

  const updateDescripcion = (index: number, texto: string) => {
    const updated = photos.map((p, i) =>
      i === index ? { ...p, descripcion: texto } : p
    );
    onPhotosChange(updated);
  };

  const removePhoto = async (index: number) => {
    onPhotosChange(photos.filter((_, i) => i !== index));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const pickFromGallery = async () => {
    if (hasLimit && currentCount >= maxPhotos!) {
      Alert.alert("Límite alcanzado", `Máximo ${maxPhotos} fotos permitidas.`);
      return;
    }

    if (Platform.OS !== "web" && !mediaPermission?.granted) {
      const r = await requestMediaPermission();
      if (!r.granted) {
        Alert.alert("Permiso requerido", "Se necesita acceso a la galería.");
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: hasLimit ? maxPhotos! - currentCount : undefined, // sin límite si no se pasa
      quality: 0.7,
    });

    if (!result.canceled) {
      const nuevas = result.assets.map((a) => ({ uri: a.uri, descripcion: "" }));
      onPhotosChange([...photos, ...nuevas]);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const pickFromCamera = async () => {
    if (hasLimit && currentCount >= maxPhotos!) {
      Alert.alert("Límite alcanzado", `Máximo ${maxPhotos} fotos permitidas.`);
      return;
    }

    if (!cameraPermission?.granted) {
      const r = await requestCameraPermission();
      if (!r.granted) {
        Alert.alert("Permiso requerido", "Se necesita acceso a la cámara.");
        return;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
    });

    if (!result.canceled) {
      onPhotosChange([...photos, { uri: result.assets[0].uri, descripcion: "" }]);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const showOptions = () => {
    if (Platform.OS === "web") {
      pickFromGallery();
      return;
    }
    Alert.alert("Agregar foto", "Selecciona el origen", [
      { text: "Cámara", onPress: pickFromCamera },
      { text: "Galería", onPress: pickFromGallery },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Empty State */}
      {currentCount === 0 ? (
        <Pressable
          style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.8 }]}
          onPress={showOptions}
        >
          <View style={styles.emptyIconBg}>
            <Feather name="camera" size={26} color={C.primary} />
          </View>
          <Text style={styles.emptyTitle}>Sin fotos</Text>
          <Text style={styles.emptySubtitle}>
            Toca para agregar fotos
          </Text>
          <View style={styles.emptyActions}>
            <View style={styles.emptyChip}>
              <Feather name="camera" size={12} color={C.primary} />
              <Text style={styles.emptyChipText}>Cámara</Text>
            </View>
            <View style={styles.emptyChip}>
              <Feather name="image" size={12} color={C.primary} />
              <Text style={styles.emptyChipText}>Galería</Text>
            </View>
          </View>
        </Pressable>
      ) : showDescription ? (
        /* MODO LISTA CON DESCRIPCIÓN */
        <>
          {photos.map((foto, index) => (
            <View key={index} style={styles.photoRow}>
              <View style={styles.thumbWrapper}>
                <Image source={{ uri: foto.uri }} style={styles.thumb} resizeMode="cover" />
                <Pressable style={styles.removeBtn} onPress={() => removePhoto(index)} hitSlop={6}>
                  <Feather name="x" size={11} color="#fff" />
                </Pressable>
                <View style={styles.thumbBadge}>
                  <Text style={styles.thumbBadgeText}>{index + 1}</Text>
                </View>
              </View>

              <View style={styles.descContainer}>
                <Text style={styles.descLabel}>Descripción</Text>
                <TextInput
                  style={styles.descInput}
                  placeholder="Ej. Fachada frontal, grieta en muro..."
                  placeholderTextColor={C.textSecondary}
                  value={foto.descripcion}
                  onChangeText={(v) => updateDescripcion(index, v)}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </View>
          ))}
        </>
      ) : (
        /* MODO GRID */
        <View style={styles.grid}>
          {photos.map((foto, index) => (
            <View key={index} style={styles.gridPhotoWrapper}>
              <Image source={{ uri: foto.uri }} style={styles.gridPhoto} resizeMode="cover" />
              <Pressable style={styles.gridRemoveBtn} onPress={() => removePhoto(index)} hitSlop={4}>
                <Feather name="x" size={12} color="#fff" />
              </Pressable>
            </View>
          ))}

          <Pressable
            style={({ pressed }) => [styles.addTile, pressed && { opacity: 0.7 }]}
            onPress={showOptions}
          >
            <Feather name="plus" size={22} color={C.primary} />
            <Text style={styles.addTileText}>Añadir</Text>
          </Pressable>
        </View>
      )}

      {/* Botón Agregar más (siempre visible si hay fotos) */}
      {currentCount > 0 && (
        <Pressable
          style={({ pressed }) => [styles.addMoreBtn, pressed && { opacity: 0.7 }]}
          onPress={showOptions}
        >
          <Feather name="plus" size={16} color={C.primary} />
          <Text style={styles.addMoreText}>
            Agregar foto ({currentCount})
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/* ====================== STYLES ====================== */
const THUMB = 80;
const TILE_SIZE = 100;

const styles = StyleSheet.create({
  container: { gap: 12 },

  /* Modo Lista */
  photoRow: {
    flexDirection: "row", gap: 12, alignItems: "flex-start",
    backgroundColor: C.inputBg, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border, padding: 10,
  },
  thumbWrapper: { position: "relative", width: THUMB, height: THUMB, flexShrink: 0 },
  thumb: { width: THUMB, height: THUMB, borderRadius: 8 },
  removeBtn: {
    position: "absolute", top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center", alignItems: "center",
  },
  thumbBadge: {
    position: "absolute", bottom: 4, left: 4,
    backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  thumbBadgeText: { fontSize: 10, color: "#fff", fontFamily: "Inter_700Bold" },

  descContainer: { flex: 1, gap: 4 },
  descLabel: {
    fontSize: 10, fontFamily: "Inter_600SemiBold",
    color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5,
  },
  descInput: {
    backgroundColor: "#fff", borderRadius: 8,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 13, fontFamily: "Inter_400Regular", color: C.text,
    minHeight: 56, textAlignVertical: "top",
  },

  /* Modo Grid */
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gridPhotoWrapper: {
    width: TILE_SIZE, height: TILE_SIZE,
    borderRadius: 10, overflow: "hidden", position: "relative",
  },
  gridPhoto: { width: TILE_SIZE, height: TILE_SIZE },
  gridRemoveBtn: {
    position: "absolute", top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center",
  },
  addTile: {
    width: TILE_SIZE, height: TILE_SIZE, borderRadius: 10,
    backgroundColor: "#EFF3F8", borderWidth: 1.5,
    borderColor: C.border, borderStyle: "dashed",
    justifyContent: "center", alignItems: "center", gap: 4,
  },
  addTileText: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.primary },

  /* Compartidos */
  emptyBtn: {
    alignItems: "center", gap: 8, paddingVertical: 20,
    backgroundColor: "#EFF3F8", borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border, borderStyle: "dashed",
  },
  emptyIconBg: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: "#fff", justifyContent: "center", alignItems: "center",
  },
  emptyTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  emptySubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: C.textSecondary, textAlign: "center", paddingHorizontal: 20 },
  emptyActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  emptyChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
  },
  emptyChipText: { fontSize: 11, fontFamily: "Inter_500Medium", color: C.primary },

  addMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.primary + "40",
    backgroundColor: C.primary + "08", borderStyle: "dashed",
  },
  addMoreText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: C.primary },
});