import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.light;

interface Option {
  value: string;
  label: string;
  icon?: string;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (val: string) => void;
}

export default function SelectButtonGroup({ options, value, onChange }: Props) {
  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionSelected,
              pressed && !selected && styles.optionPressed,
            ]}
            onPress={() => onChange(opt.value)}
          >
            {opt.icon && (
              <Feather
                name={opt.icon as any}
                size={14}
                color={selected ? "#fff" : C.textSecondary}
              />
            )}
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
              {opt.label}
            </Text>
            {selected && (
              <Feather name="check" size={12} color="#fff" />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.inputBg,
  },
  optionSelected: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  optionPressed: {
    opacity: 0.75,
  },
  optionText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: C.textSecondary,
  },
  optionTextSelected: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },
});
