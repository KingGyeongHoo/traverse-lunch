import NearbySearch from "@/components/nearby-search";
import SiteHeader from "@/components/site-header";

export const metadata = { title: "주변 식당 | 점심시간" };

export default function NearbyPage() {
  return (
    <div className="app-shell">
      <SiteHeader current="nearby" />
      <main>
        <div className="intro">
          <h1>주변 식당</h1>
        </div>
        <NearbySearch />
      </main>
    </div>
  );
}
