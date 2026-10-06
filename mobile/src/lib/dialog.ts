import { Alert } from "react-native";
export const showAlert = (title: string, message: string) =>
  Alert.alert(title, message);
export function confirmDelete(onConfirm: () => void) {
  Alert.alert("식당을 삭제할까요?", "동료들의 목록에서도 삭제돼요.", [
    { text: "취소", style: "cancel" },
    { text: "삭제", style: "destructive", onPress: onConfirm },
  ]);
}
