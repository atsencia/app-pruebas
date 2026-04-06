import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";


type Props ={
    onChange?:(value:boolean)=> void;
};

export default function TrueFalseButton({ onChange}: Props) {
  const [value, setValue] = useState(null); // null | true | false

  const handlePress = (val: any) => {
    setValue(val);
    onChange && onChange(val);
  };

  return (
    <View style={styles.container}>
      
      <Pressable
        style={[
          styles.button,
          value === true && styles.trueActive
        ]}
        onPress={() => handlePress(true)}
      >
        <Text style={[
          styles.text,
          value === true && styles.activeText
        ]}>
          Verdadero
        </Text>
      </Pressable>

      <Pressable
        style={[
          styles.button,
          value === false && styles.falseActive
        ]}
        onPress={() => handlePress(false)}
      >
        <Text style={[
          styles.text,
          value === false && styles.activeText
        ]}>
          Falso
        </Text>
      </Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
  },
  text: {
    color: "#555",
    fontWeight: "600",
  },

  // Estados activos
  trueActive: {
    backgroundColor: "#22c55e",
    borderColor: "#22c55e",
  },
  falseActive: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  activeText: {
    color: "#fff",
  },
});