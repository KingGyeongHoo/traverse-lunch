"use client";

import { useState, type FormEvent } from "react";
import {
  foodCategory,
  NEARBY_CATEGORIES,
  type NearbyCategory,
  type NearbyResult,
  type PlaceType,
} from "@/lib/nearby";

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("이 브라우저에서는 현재 위치를 사용할 수 없습니다."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "현재 위치 권한을 허용해 주세요."
              : error.code === error.TIMEOUT
                ? "현재 위치 확인 시간이 초과됐습니다. 다시 시도해 주세요."
                : "현재 위치를 확인하지 못했습니다. 다시 시도해 주세요.",
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}

export default function NearbySearch() {
  const [type, setType] = useState<PlaceType>("restaurant");
  const [radius, setRadius] = useState("200");
  const [categories, setCategories] = useState<NearbyCategory[]>([]);
  const [result, setResult] = useState<NearbyResult | null>(null);
  const [resultType, setResultType] = useState<PlaceType>("restaurant");
  const [resultRadius, setResultRadius] = useState(200);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const distance = Number(radius);
    if (!Number.isInteger(distance) || distance < 1 || distance > 20000) {
      setError("거리는 1~20,000m로 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const position = await currentPosition();
      const response = await fetch("/api/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          radius: distance,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "주변 장소를 검색하지 못했습니다.");
      setResult(data as NearbyResult);
      setResultType(type);
      setResultRadius(distance);
    } catch (reason) {
      setError(
        reason instanceof Error && reason.name !== "TimeoutError"
          ? reason.message
          : "검색 시간이 초과됐습니다. 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  const visible =
    result?.places.filter(
      (place) =>
        resultType !== "restaurant" ||
        categories.length === 0 ||
        categories.includes(foodCategory(place.category)),
    ) ?? [];
  return (
    <>
      <form className="nearby-form" onSubmit={search}>
        <fieldset className="nearby-options" disabled={busy}>
          <legend>장소</legend>
          <div className="nearby-choice">
            {(
              [
                ["restaurant", "음식점"],
                ["cafe", "카페"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className={type === value ? "selected" : ""}>
                <input
                  type="radio"
                  name="place-type"
                  value={value}
                  checked={type === value}
                  onChange={() => {
                    setType(value);
                    setResult(null);
                    setError("");
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="nearby-distance" htmlFor="nearby-radius">
          <span>거리 (m)</span>
          <input
            id="nearby-radius"
            type="number"
            inputMode="numeric"
            min="1"
            max="20000"
            step="1"
            required
            value={radius}
            disabled={busy}
            onChange={(event) => setRadius(event.target.value)}
          />
        </label>
        {type === "restaurant" && (
          <fieldset className="nearby-options nearby-food" disabled={busy}>
            <legend>메뉴</legend>
            <div className="nearby-choice">
              {NEARBY_CATEGORIES.map((category) => (
                <label
                  key={category}
                  className={categories.includes(category) ? "selected" : ""}
                >
                  <input
                    type="checkbox"
                    checked={categories.includes(category)}
                    onChange={() =>
                      setCategories((previous) =>
                        previous.includes(category)
                          ? previous.filter((item) => item !== category)
                          : [...previous, category],
                      )
                    }
                  />
                  {category}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <button className="primary nearby-submit" disabled={busy} type="submit">
          {busy ? "찾는 중…" : "찾기"}
        </button>
      </form>
      {error && (
        <div className="error-banner nearby-error" role="alert">
          <span>{error}</span>
        </div>
      )}
      <section
        className="nearby-results"
        aria-labelledby="nearby-results-title"
        aria-busy={busy}
      >
        <div className="section-heading">
          <h2 id="nearby-results-title">
            검색 결과 <span>{result ? visible.length : 0}</span>
          </h2>
        </div>
        {result && (
          <p className="nearby-help">
            현재 위치 기준 {resultRadius.toLocaleString("ko-KR")}m · 직선거리순
          </p>
        )}
        {result?.truncated && (
          <p className="nearby-help">
            가까운 검색 결과 최대 45곳에서 필터링합니다.
          </p>
        )}
        {!result ? (
          <div className="empty-state compact">
            <p>
              {busy
                ? "현재 위치에서 검색하고 있습니다."
                : "조건을 선택하고 찾아보세요."}
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state compact">
            <p>조건에 맞는 장소가 없습니다.</p>
          </div>
        ) : (
          <ul className="nearby-list">
            {visible.map((place) => (
              <li className="nearby-card" key={place.id}>
                <div className="nearby-card-meta">
                  <span>
                    {place.category
                      .split(">")
                      .map((part) => part.trim())
                      .filter(Boolean)
                      .slice(1)
                      .join(" · ") || place.category}
                  </span>
                  <strong>{place.distance.toLocaleString("ko-KR")}m</strong>
                </div>
                <h3>{place.name}</h3>
                {place.address && <p>{place.address}</p>}
                {place.phone && <p>{place.phone}</p>}
                <a
                  href={place.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${place.name} 카카오맵 상세 보기 (새 창)`}
                >
                  카카오맵 보기 <span aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
