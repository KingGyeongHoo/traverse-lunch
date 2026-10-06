import MenuPicker from "@/components/menu-picker";
import SiteHeader from "@/components/site-header";

export const metadata = { title: "메뉴 고르기 | 점심시간" };

export default function MenusPage() {
  return (
    <div className="app-shell">
      <SiteHeader current="menus" />
      <main>
        <div className="intro">
          <div>
            <h1>메뉴 고르기</h1>
          </div>
        </div>
        <MenuPicker />
      </main>
    </div>
  );
}
