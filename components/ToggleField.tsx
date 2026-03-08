import React from "react";
import { View, Text, StyleSheet, Switch, Platform } from "react-native";
import Colors from "@/constants/colors";

const C = Colors.light;

interface Props {
  label: string;
  description?: string;
  value: boolean;
  onChange: (val: boolean) => void;
}

export default function ToggleField({ label, description, value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        <Text style={styles.label}>{label}</Text>
        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: C.border, true: C.accent }}
        thumbColor={Platform.OS === "android" ? (value ? "#fff" : "#f4f3f4") : undefined}
        ios_backgroundColor={C.border}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: C.text,
    lineHeight: 20,
  },
  description: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: C.textSecondary,
    lineHeight: 16,
  },
});
