import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextInputProps,
  TextInput,
} from "react-native";

export const colors = {
  background: "#FFFFFF",
  ink: "#202020",
  muted: "#686868",
  primary: "#FFD43B",
  accentText: "#755600",
  soft: "#FFF8DA",
  surface: "#F6F6F6",
  line: "#E6E6E6",
  white: "#FFFFFF",
  red: "#A13832",
};
export function Button({
  label,
  onPress,
  disabled,
  secondary,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        danger && s.danger,
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.75 },
      ]}
    >
      <Text
        style={[
          s.buttonText,
          secondary && { color: colors.ink },
          danger && { color: colors.red },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[s.chip, selected && s.chipSelected, disabled && { opacity: 0.5 }]}
    >
      <Text style={s.chipText}>{label}</Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 96, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, gap: 22, paddingBottom: 36 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  title: {
    fontSize: 30,
    lineHeight: 40,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -1,
  },
  heading: { fontSize: 21, fontWeight: "700", color: colors.ink },
  text: { fontSize: 15, lineHeight: 23, color: colors.muted },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  button: {
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  secondary: { backgroundColor: colors.surface },
  danger: { backgroundColor: "#FAECE8" },
  chip: {
    minHeight: 44,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  field: { gap: 8 },
  label: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 50,
    padding: 14,
    fontSize: 16,
    color: colors.ink,
  },
  error: { color: colors.red, fontSize: 14, lineHeight: 22 },
  center: { flex: 1, padding: 28, justifyContent: "center", gap: 20 },
});
