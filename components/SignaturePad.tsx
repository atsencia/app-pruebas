import React, { useRef, useState } from "react";
import {
  View,
  PanResponder,
  StyleSheet,
  Pressable,
  Text,
  Platform,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.light;

interface Point {
  x: number;
  y: number;
}

interface Props {
  onSignatureChange: (svgPaths: string | null) => void;
}

export default function SignaturePad({ onSignatureChange }: Props) {
  const [paths, setPaths] = useState<string[]>([]);
  const currentPath = useRef<Point[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const pointsToPath = (points: Point[]): string => {
    if (points.length === 0) return "";
    if (points.length === 1) {
      return `M${points[0].x},${points[0].y} L${points[0].x + 0.1},${points[0].y}`;
    }
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L${points[i].x},${points[i].y}`;
    }
    return d;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPath.current = [{ x: locationX, y: locationY }];
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPath.current.push({ x: locationX, y: locationY });
        setPaths((prev) => {
          const updated = [...prev];
          updated[updated.length] = pointsToPath(currentPath.current);
          return updated;
        });
      },
      onPanResponderRelease: () => {
        const pathStr = pointsToPath(currentPath.current);
        if (pathStr) {
          setPaths((prev) => {
            const newPaths = [...prev, pathStr];
            onSignatureChange(newPaths.join("|"));
            return newPaths;
          });
        }
        currentPath.current = [];
      },
    })
  ).current;

  const clearSignature = () => {
    setPaths([]);
    currentPath.current = [];
    onSignatureChange(null);
  };

  const isEmpty = paths.length === 0;

  return (
    <View style={styles.container}>
      <View
        style={styles.padWrapper}
        onLayout={(e) =>
          setDimensions({
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          })
        }
        {...panResponder.panHandlers}
      >
        {dimensions.width > 0 && (
          <Svg
            width={dimensions.width}
            height={dimensions.height}
            style={StyleSheet.absoluteFill}
          >
            {paths.map((d, i) => (
              <Path
                key={i}
                d={d}
                stroke={C.primary}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
        )}
        {isEmpty && (
          <View style={styles.placeholder} pointerEvents="none">
            <Feather name="edit-3" size={22} color={C.textSecondary} />
            <Text style={styles.placeholderText}>
              Firme en este espacio
            </Text>
          </View>
        )}
      </View>
      <Pressable
        style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.6 }]}
        onPress={clearSignature}
      >
        <Feather name="trash-2" size={14} color={C.error} />
        <Text style={styles.clearText}>Limpiar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  padWrapper: {
    height: 150,
    backgroundColor: "#EFF3F8",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholder: {
    alignItems: "center",
    gap: 6,
  },
  placeholderText: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  clearText: {
    fontSize: 12,
    color: C.error,
    fontFamily: "Inter_500Medium",
  },
});
