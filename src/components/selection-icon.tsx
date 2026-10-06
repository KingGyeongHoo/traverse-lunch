export default function SelectionIcon({
  kind,
}: {
  kind: "restaurants" | "menus";
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "restaurants" ? (
        <>
          <path d="M20 51v53h80V51M15 32l10-17h70l10 17v10a15 15 0 0 1-30 0 15 15 0 0 1-30 0 15 15 0 0 1-30 0V32ZM15 32h90M45 32v10M75 32v10" />
          <path d="M34 70h20v16H34zM70 104V70h17v34" />
        </>
      ) : (
        <>
          <circle cx="64" cy="61" r="36" />
          <circle cx="64" cy="61" r="24" />
          <path d="M12 16v28m-6-28v19a6 6 0 0 0 12 0V16M12 44v61M110 16v89M110 16c-10 9-10 33 0 38" />
        </>
      )}
    </svg>
  );
}
