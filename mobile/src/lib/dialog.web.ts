export function showAlert(title: string, message: string) {
  window.alert(`${title}\n\n${message}`);
}
export function confirmDelete(onConfirm: () => void) {
  if (window.confirm("식당을 삭제할까요? 동료들의 목록에서도 삭제돼요."))
    onConfirm();
}
