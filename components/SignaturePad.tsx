import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  PanResponder,
  StyleSheet,
  Pressable,
  Text,
  Alert,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import ViewShot from "react-native-view-shot";

const C = Colors.light;

interface Point {
  x: number;
  y: number;
}

interface Props {
  // Firma a mano: paths SVG separados por "|". Firma con el nombre: PNG en
  // data URI (data:image/png;base64,...), igual que la firma por link.
  onSignatureChange: (firma: string | null) => void;
  // Nombre del firmante (el input de arriba). Habilita "Firmar con el nombre".
  nombre?: string;
}

export const FUENTE_FIRMA_NOMBRE = "GreatVibes_400Regular";

export default function SignaturePad({ onSignatureChange, nombre = "" }: Props) {
  const [paths, setPaths] = useState<string[]>([]);
  // "dibujo": firma con el dedo. "nombre": el nombre en cursiva, capturado como PNG.
  const [modo, setModo] = useState<"dibujo" | "nombre">("dibujo");
  const modoRef = useRef(modo);
  modoRef.current = modo;
  const shotRef = useRef<ViewShot>(null);
  const nombreFirma = nombre.trim();
  const currentPath = useRef<Point[]>([]);
  const allPaths = useRef<string[]>([]);
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
      // Con la firma por nombre puesta no se dibuja encima (primero "Limpiar").
      onStartShouldSetPanResponder: () => modoRef.current === "dibujo",
      onMoveShouldSetPanResponder: () => modoRef.current === "dibujo",
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPath.current = [{ x: locationX, y: locationY }];
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        currentPath.current.push({ x: locationX, y: locationY });
        const pathStr = pointsToPath(currentPath.current);
        const preview = [...allPaths.current, pathStr];
        setPaths(preview);
      },
      onPanResponderRelease: () => {
        const pathStr = pointsToPath(currentPath.current);
        if (pathStr) {
          allPaths.current = [...allPaths.current, pathStr];
          setPaths([...allPaths.current]);
        }
        currentPath.current = [];
      },
    })
  ).current;

  const clearSignature = useCallback(() => {
    allPaths.current = [];
    setPaths([]);
    setModo("dibujo");
    onSignatureChange(null);
  }, [onSignatureChange]);

  const firmarConNombre = () => {
    if (!nombreFirma) {
      Alert.alert("Falta el nombre", "Escribe primero el nombre del firmante.");
      return;
    }
    allPaths.current = [];
    setPaths([]);
    setModo("nombre");
  };

  // En modo nombre la firma es la vista previa capturada como PNG; se vuelve a
  // capturar si cambia el nombre, para que la firma siempre diga lo que se ve.
  useEffect(() => {
    if (modo !== "nombre") return;
    if (!nombreFirma) {
      onSignatureChange(null);
      return;
    }
    let cancelado = false;
    // Un momento para que el texto termine de dibujarse antes de capturarlo.
    const t = setTimeout(async () => {
      try {
        const uri = await shotRef.current?.capture?.();
        if (!cancelado && uri) onSignatureChange(uri);
      } catch (e: any) {
        console.warn("[SignaturePad] no se pudo capturar la firma:", e?.message);
      }
    }, 150);
    return () => { cancelado = true; clearTimeout(t); };
    // onSignatureChange cambia en cada render del formulario; no debe recapturar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, nombreFirma, dimensions.width]);

  const isEmpty = paths.length === 0 && modo === "dibujo";

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
        onTouchEnd={() => {
          if (modoRef.current === "dibujo" && allPaths.current.length > 0) {
            onSignatureChange(allPaths.current.join("|"));
          }
        }}
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
        {modo === "nombre" && dimensions.width > 0 && (
          <ViewShot
            ref={shotRef}
            options={{ format: "png", quality: 1, result: "data-uri" }}
            style={[styles.nombreShot, { width: dimensions.width, height: dimensions.height }]}
          >
            <Text
              style={styles.nombreTexto}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.3}
            >
              {nombreFirma}
            </Text>
          </ViewShot>
        )}
        {isEmpty && (
          <View style={styles.placeholder} pointerEvents="none">
            <Feather name="edit-3" size={22} color={C.textSecondary} />
            <Text style={styles.placeholderText}>Firme en este espacio</Text>
          </View>
        )}
      </View>
      <View style={styles.acciones}>
        <Pressable
          style={({ pressed }) => [
            styles.nombreBtn,
            modo === "nombre" && styles.nombreBtnActivo,
            pressed && { opacity: 0.6 },
          ]}
          onPress={firmarConNombre}
        >
          <Feather name="type" size={14} color={C.primary} />
          <Text style={styles.nombreBtnText}>Firmar con el nombre</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.6 }]}
          onPress={clearSignature}
        >
          <Feather name="trash-2" size={14} color={C.error} />
          <Text style={styles.clearText}>Limpiar</Text>
        </Pressable>
      </View>
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
  nombreShot: {
    position: "absolute",
    top: 0,
    left: 0,
    // Fondo blanco: la captura es la imagen que queda en el acta.
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  nombreTexto: {
    fontFamily: FUENTE_FIRMA_NOMBRE,
    fontSize: 52,
    color: "#000",
    textAlign: "center",
  },
  acciones: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  nombreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.primary,
  },
  nombreBtnActivo: {
    backgroundColor: "#E8EFF6",
  },
  nombreBtnText: {
    fontSize: 12,
    color: C.primary,
    fontFamily: "Inter_600SemiBold",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  clearText: {
    fontSize: 12,
    color: C.error,
    fontFamily: "Inter_500Medium",
  },
});
