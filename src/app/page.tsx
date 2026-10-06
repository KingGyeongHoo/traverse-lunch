import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SelectionIcon from "@/components/selection-icon";

export default function Home() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="home-main">
        <div className="intro home-intro">
          <div>
            <h1>점심 선택</h1>
          </div>
        </div>
        <div className="home-choices">
          <Link href="/restaurants" className="home-choice">
            <div className="choice-top">
              <span className="choice-symbol">
                <SelectionIcon kind="restaurants" />
              </span>
              <span className="choice-arrow" aria-hidden="true">
                ↗
              </span>
            </div>
            <h2>식당 고르기</h2>
          </Link>
          <Link href="/menus" className="home-choice menu-choice">
            <div className="choice-top">
              <span className="choice-symbol">
                <SelectionIcon kind="menus" />
              </span>
              <span className="choice-arrow" aria-hidden="true">
                ↗
              </span>
            </div>
            <h2>메뉴 고르기</h2>
          </Link>
        </div>
        <Link href="/nearby" className="nearby-home-link">
          주변 식당 찾기 <span aria-hidden="true">↗</span>
        </Link>
      </main>
    </div>
  );
}
