import { Redirect } from "expo-router";

// Keep old preview links working without a setup screen.
export default function Settings() {
  return <Redirect href="/" />;
}
