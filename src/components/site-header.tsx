import Link from "next/link";

export default function SiteHeader({
  current,
}: {
  current?: "restaurants" | "menus";
}) {
  return (
    <header className="header">
      <Link href="/" className="brand" aria-label="점심시간 홈">
        <span className="brand-icon" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M7 6v20h18" stroke="currentColor" strokeWidth="5" />
            <circle cx="23" cy="9" r="4" fill="currentColor" />
          </svg>
        </span>
        점심시간
      </Link>
      <nav className="site-nav" aria-label="주 메뉴">
        <Link
          href="/restaurants"
          aria-current={current === "restaurants" ? "page" : undefined}
        >
          식당 고르기
        </Link>
        <Link
          href="/menus"
          aria-current={current === "menus" ? "page" : undefined}
        >
          메뉴 고르기
        </Link>
      </nav>
    </header>
  );
}
