import { Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LunchProvider } from "../lib/store";
import { colors } from "../components/ui";

export default function Layout() {
  return (
    <SafeAreaProvider
      style={
        Platform.OS === "web"
          ? {
              width: "100%",
              maxWidth: 480,
              alignSelf: "center",
              backgroundColor: colors.background,
            }
          : undefined
      }
    >
      <LunchProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.ink,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="restaurants" options={{ title: "식당 고르기" }} />
          <Stack.Screen name="menus" options={{ title: "메뉴 고르기" }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen
            name="editor"
            options={{
              title: "식당 정보",
              presentation: "modal",
              gestureEnabled: false,
            }}
          />
        </Stack>
      </LunchProvider>
    </SafeAreaProvider>
  );
}
