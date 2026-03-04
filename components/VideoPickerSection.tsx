import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.light;
const MAX_VIDEOS = 3;

interface VideoItem {
  uri: string;
  thumbnail: string | null;
  duration: number | null;
  filename: string;
}

interface Props {
  videos: VideoItem[];
  onVideosChange: (videos: VideoItem[]) => void;
}

function formatDuration(ms: number | null): string {
  if (!ms) return "";
  const secs = Math.round(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VideoPickerSection({ videos, onVideosChange }: Props) {
  const [cameraPermission, requestCameraPermission] =
    ImagePicker.useCameraPermissions();
  const [mediaPermission, requestMediaPermission] =
    ImagePicker.useMediaLibraryPermissions();

  const pickFromGallery = async () => {
    if (videos.length >= MAX_VIDEOS) {
      Alert.alert("Límite alcanzado", `Máximo ${MAX_VIDEOS} videos por registro.`);
      return;
    }

    if (Platform.OS !== "web") {
      if (!mediaPermission?.granted) {
        const result = await requestMediaPermission();
        if (!result.granted) {
          Alert.alert(
            "Permiso requerido",
            "Se necesita acceso a la galería para seleccionar videos."
          );
          return;
        }
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      quality: 0.7,
      videoMaxDuration: 120,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const item: VideoItem = {
        uri: asset.uri,
        thumbnail: null,
        duration: asset.duration ?? null,
        filename: asset.fileName ?? `video_${Date.now()}.mp4`,
      };
      onVideosChange([...videos, item]);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const pickFromCamera = async () => {
    if (videos.length >= MAX_VIDEOS) {
      Alert.alert("Límite alcanzado", `Máximo ${MAX_VIDEOS} videos por registro.`);
      return;
    }

    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert(
          "Permiso requerido",
          "Se necesita acceso a la cámara para grabar videos."
        );
        return;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 120,
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const item: VideoItem = {
        uri: asset.uri,
        thumbnail: null,
        duration: asset.duration ?? null,
        filename: asset.fileName ?? `video_${Date.now()}.mp4`,
      };
      onVideosChange([...videos, item]);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const removeVideo = async (index: number) => {
    const updated = videos.filter((_, i) => i !== index);
    onVideosChange(updated);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const showOptions = () => {
    if (Platform.OS === "web") {
      pickFromGallery();
      return;
    }
    Alert.alert("Agregar video", "Selecciona el origen", [
      { text: "Grabar con cámara", onPress: pickFromCamera },
      { text: "Seleccionar de galería", onPress: pickFromGallery },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  return (
    <View style={styles.container}>
      {videos.length > 0 ? (
        <View style={styles.videoList}>
          {videos.map((video, index) => (
            <View key={index} style={styles.videoCard}>
              <View style={styles.videoPreview}>
                <View style={styles.videoIconBg}>
                  <Feather name="film" size={24} color={C.primary} />
                </View>
                <View style={styles.playBadge}>
                  <Feather name="play" size={10} color="#fff" />
                </View>
              </View>
              <View style={styles.videoInfo}>
                <Text style={styles.videoFilename} numberOfLines={1}>
                  {video.filename}
                </Text>
                {video.duration !== null && (
                  <View style={styles.videoDurationRow}>
                    <Feather name="clock" size={11} color={C.textSecondary} />
                    <Text style={styles.videoDuration}>
                      {formatDuration(video.duration)}
                    </Text>
                  </View>
                )}
                <View style={styles.videoStatusBadge}>
                  <Feather name="check-circle" size={11} color={C.accent} />
                  <Text style={styles.videoStatusText}>Listo</Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.removeVideoBtn,
                  pressed && { opacity: 0.6 },
                ]}
                onPress={() => removeVideo(index)}
                hitSlop={8}
              >
                <Feather name="trash-2" size={16} color={C.error} />
              </Pressable>
            </View>
          ))}
          {videos.length < MAX_VIDEOS && (
            <Pressable
              style={({ pressed }) => [
                styles.addMoreVideoBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={showOptions}
            >
              <Feather name="plus" size={16} color={C.primary} />
              <Text style={styles.addMoreVideoBtnText}>Agregar otro video</Text>
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
            <Feather name="video" size={26} color={C.primary} />
          </View>
          <Text style={styles.emptyTitle}>Sin videos</Text>
          <Text style={styles.emptySubtitle}>
            Toca para grabar o seleccionar hasta {MAX_VIDEOS} videos (máx. 2 min c/u)
          </Text>
          <View style={styles.emptyActions}>
            <View style={styles.emptyChip}>
              <Feather name="video" size={12} color={C.primary} />
              <Text style={styles.emptyChipText}>Grabar</Text>
            </View>
            <View style={styles.emptyChip}>
              <Feather name="folder" size={12} color={C.primary} />
              <Text style={styles.emptyChipText}>Galería</Text>
            </View>
          </View>
        </Pressable>
      )}

      <Text style={styles.footerText}>
        {videos.length}/{MAX_VIDEOS} videos agregados
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  videoList: {
    gap: 10,
  },
  videoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF3F8",
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  videoPreview: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    flexShrink: 0,
    borderWidth: 1,
    borderColor: C.border,
  },
  videoIconBg: {
    justifyContent: "center",
    alignItems: "center",
  },
  playBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  videoInfo: {
    flex: 1,
    gap: 4,
  },
  videoFilename: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.text,
  },
  videoDurationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  videoDuration: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
  videoStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  videoStatusText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: C.accent,
  },
  removeVideoBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    flexShrink: 0,
  },
  addMoreVideoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#EFF3F8",
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: "dashed",
  },
  addMoreVideoBtnText: {
    fontSize: 13,
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
  footerText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
  },
});
