import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.light;
const MAX_PHOTOS = 6;

interface Props {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
}

export default function PhotoPickerSection({ photos, onPhotosChange }: Props) {
  const [cameraPermission, requestCameraPermission] =
    ImagePicker.useCameraPermissions();
  const [mediaPermission, requestMediaPermission] =
    ImagePicker.useMediaLibraryPermissions();

  const pickFromGallery = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert("Límite alcanzado", `Máximo ${MAX_PHOTOS} fotos por registro.`);
      return;
    }

    if (Platform.OS !== "web") {
      if (!mediaPermission?.granted) {
        const result = await requestMediaPermission();
        if (!result.granted) {
          Alert.alert(
            "Permiso requerido",
            "Se necesita acceso a la galería para seleccionar fotos."
          );
          return;
        }
      }
    }

    const remaining = MAX_PHOTOS - photos.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newUris = result.assets.map((a) => a.uri);
      onPhotosChange([...photos, ...newUris].slice(0, MAX_PHOTOS));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const pickFromCamera = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert("Límite alcanzado", `Máximo ${MAX_PHOTOS} fotos por registro.`);
      return;
    }

    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert(
          "Permiso requerido",
          "Se necesita acceso a la cámara para tomar fotos."
        );
        return;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      onPhotosChange([...photos, result.assets[0].uri]);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const removePhoto = async (index: number) => {
    const updated = photos.filter((_, i) => i !== index);
    onPhotosChange(updated);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      {photos.length > 0 ? (
        <View style={styles.grid}>
          {photos.map((uri, index) => (
            <View key={index} style={styles.photoWrapper}>
              <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
              <Pressable
                style={styles.removeBtn}
                onPress={() => removePhoto(index)}
                hitSlop={4}
              >
                <Feather name="x" size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
          {photos.length < MAX_PHOTOS && (
            <Pressable
              style={({ pressed }) => [
                styles.addTile,
                pressed && { opacity: 0.7 },
              ]}
              onPress={showOptions}
            >
              <Feather name="plus" size={22} color={C.primary} />
              <Text style={styles.addTileText}>Añadir</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [
            styles.emptyBtn,
            pressed && { opacity: 0.8 },
          ]}
          onPress={showOptions}
        >
          <View style={styles.emptyIconBg}>
            <Feather name="camera" size={26} color={C.primary} />
          </View>
          <Text style={styles.emptyTitle}>Sin fotos</Text>
          <Text style={styles.emptySubtitle}>
            Toca para agregar hasta {MAX_PHOTOS} fotos
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
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {photos.length}/{MAX_PHOTOS} fotos agregadas
        </Text>
        {photos.length > 0 && photos.length < MAX_PHOTOS && (
          <Pressable
            onPress={showOptions}
            style={({ pressed }) => [
              styles.addMoreBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather name="plus" size={12} color={C.primary} />
            <Text style={styles.addMoreText}>Agregar más</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const TILE_SIZE = 100;

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoWrapper: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  photo: {
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  addTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 10,
    backgroundColor: "#EFF3F8",
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  addTileText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: C.primary,
  },
  emptyBtn: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 20,
    backgroundColor: "#EFF3F8",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: "dashed",
  },
  emptyIconBg: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  emptySubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  emptyActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  emptyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyChipText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: C.primary,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  addMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addMoreText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: C.primary,
  },
});
