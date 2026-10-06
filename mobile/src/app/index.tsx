import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, s } from "../components/ui";

export default function Home() {
  return (
    <SafeAreaView style={s.screen}>
      <View style={styles.choices}>
        {(
          [
            ["식당 고르기", "/restaurants"],
            ["메뉴 고르기", "/menus"],
          ] as const
        ).map(([label, route], index) => (
          <Pressable
            key={route}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => router.push(route)}
            style={({ pressed }) => [
              styles.choice,
              index === 1 && styles.lightChoice,
              pressed && { opacity: 0.8, transform: [{ scale: 0.985 }] },
            ]}
          >
            <Text style={styles.label}>{label}</Text>
            <Text accessible={false} aria-hidden style={styles.arrow}>
              ↗
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  choices: { flex: 1, justifyContent: "center", gap: 16, padding: 24 },
  choice: {
    minHeight: 164,
    padding: 28,
    borderRadius: 20,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  lightChoice: {
    backgroundColor: colors.soft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  label: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -1,
    color: colors.ink,
    flexShrink: 1,
  },
  arrow: { fontSize: 34, color: colors.ink },
});
