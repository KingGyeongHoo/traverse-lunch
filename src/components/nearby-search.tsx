"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  SEARCH_RADII,
  containsPlace,
  distanceLabel,
  placeInput,
  type NearbyPlace,
  type NearbyResult,
  type SearchLocation,
  type SearchRadius,
} from "@/lib/places";
import { lunchClient } from "@/lib/lunch-client";
import type { Restaurant, RestaurantInput } from "@/lib/lunch";
import { RestaurantEditor } from "./lunch-app";

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "검색을 완료하지 못했어요.";

async function request<T>(
  path: string,
  body: unknown,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "검색을 완료하지 못했어요.");
  return value;
}

export default function NearbySearch() {
  const [location, setLocation] = useState<SearchLocation | null>(null);
  const [radius, setRadius] = useState<SearchRadius>(500);
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<SearchLocation[] | null>(null);
  const [result, setResult] = useState<NearbyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");
  const [editor, setEditor] = useState<NearbyPlace | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Restaurant[]>([]);
  const active = useRef(false);
  const savingRef = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    void lunchClient
      .load()
      .then((data) => {
        if (mounted) setSaved(data.restaurants);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      controller.current?.abort();
    };
  }, []);

  async function run(
    action: (signal: AbortSignal, current: () => boolean) => Promise<void>,
  ) {
    if (active.current) return;
    active.current = true;
    const abort = new AbortController();
    controller.current = abort;
    const current = () => !abort.signal.aborted;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action(abort.signal, current);
    } catch (error) {
      if (current()) setError(messageOf(error));
    } finally {
      if (current()) {
        active.current = false;
        setBusy(false);
      }
    }
  }

  async function findRestaurants(
    center: SearchLocation,
    range: SearchRadius,
    page = 1,
  ) {
    await run(async (signal, current) => {
      if (page === 1) {
        setResult(null);
        setFilter("");
      }
      const next = await request<NearbyResult>(
        "/api/places",
        { lat: center.lat, lng: center.lng, radius: range, page },
        signal,
      );
      if (!current()) return;
      setResult((previous) =>
        page === 1
          ? next
          : {
              ...next,
              places: [
                ...new Map(
                  [...(previous?.places ?? []), ...next.places].map((place) => [
                    place.id,
                    place,
                  ]),
                ).values(),
              ],
            },
      );
    });
  }

  async function locate() {
    await run(async (signal, current) => {
      if (!window.isSecureContext)
        throw new Error(
          "현재 위치는 HTTPS에서 사용할 수 있어요. 주소 검색을 이용해 주세요.",
        );
      if (!navigator.geolocation)
        throw new Error("이 브라우저에서는 주소 검색을 이용해 주세요.");
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(
            resolve,
            (e) =>
              reject(
                new Error(
                  e.code === 1
                    ? "위치 권한이 꺼져 있어요. 권한을 허용하거나 주소를 검색해 주세요."
                    : "현재 위치를 확인하지 못했어요. 주소 검색을 이용해 주세요.",
                ),
              ),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
          ),
      );
      if (!current()) return;
      const center = {
        name: "현재 위치",
        address: "",
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      setLocation(center);
      setLocations(null);
      setResult(null);
      setFilter("");
      const next = await request<NearbyResult>(
        "/api/places",
        { lat: center.lat, lng: center.lng, radius },
        signal,
      );
      if (current()) setResult(next);
    });
  }

  async function findLocation(event: FormEvent) {
    event.preventDefault();
    await run(async (signal, current) => {
      setLocations(null);
      const next = await request<{ locations: SearchLocation[] }>(
        "/api/places/locations",
        { query },
        signal,
      );
      if (current()) setLocations(next.locations);
    });
  }

  function chooseLocation(center: SearchLocation) {
    setLocation(center);
    setLocations(null);
    void findRestaurants(center, radius);
  }

  function savedPlace(place: NearbyPlace, list = saved) {
    return list.some((item) => containsPlace(item.note, place.url));
  }

  async function save(input: RestaurantInput) {
    if (!editor || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const latest = await lunchClient.load();
      if (savedPlace(editor, latest.restaurants)) {
        setSaved(latest.restaurants);
        setEditor(null);
        setNotice("이미 목록에 추가된 식당입니다.");
        return;
      }
      const note =
        `${editor.url}\n${input.note.replaceAll(editor.url, "").trim()}`
          .trim()
          .slice(0, 200);
      const next = await lunchClient.save({ ...input, note });
      setSaved(next.restaurants);
      setEditor(null);
      setNotice("공용 식당 목록에 추가했어요.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const visible =
    result?.places.filter((place) =>
      `${place.name} ${place.category} ${place.address}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    ) ?? [];

  return (
    <>
      <section className="nearby-controls" aria-label="주변 식당 검색">
        <button
          className="primary nearby-locate"
          onClick={() => void locate()}
          disabled={busy}
        >
          현재 위치로 찾기 <span aria-hidden="true">◎</span>
        </button>
        <form onSubmit={findLocation} className="nearby-location-form">
          <label htmlFor="location-query">주소 또는 장소</label>
          <div>
            <input
              id="location-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="회사 주소, 건물명, 역 이름"
              minLength={2}
              maxLength={100}
              required
              disabled={busy}
            />
            <button
              className="secondary"
              disabled={busy || query.trim().length < 2}
            >
              위치 검색
            </button>
          </div>
        </form>
        {locations !== null && (
          <div className="location-results" aria-live="polite">
            {locations.length ? (
              locations.map((center, index) => (
                <button
                  key={`${center.lat}-${center.lng}-${index}`}
                  disabled={busy}
                  onClick={() => chooseLocation(center)}
                >
                  <strong>{center.name}</strong>
                  {center.address !== center.name && (
                    <span>{center.address}</span>
                  )}
                </button>
              ))
            ) : (
              <p>검색된 위치가 없습니다. 주소를 다시 입력해 주세요.</p>
            )}
          </div>
        )}
        <fieldset className="nearby-radius" disabled={busy}>
          <legend>검색 반경</legend>
          <div className="filters">
            {SEARCH_RADII.map((value) => (
              <button
                type="button"
                key={value}
                className={radius === value ? "active" : ""}
                aria-pressed={radius === value}
                onClick={() => {
                  setRadius(value);
                  if (location) void findRestaurants(location, value);
                }}
              >
                {distanceLabel(value)}
              </button>
            ))}
          </div>
        </fieldset>
        {location && (
          <p className="nearby-location">
            <strong>기준 위치</strong> {location.name}
          </p>
        )}
      </section>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          {location && (
            <button
              onClick={() => void findRestaurants(location, radius)}
              disabled={busy}
            >
              다시 검색
            </button>
          )}
        </div>
      )}
      {busy && (
        <p className="nearby-hint" role="status">
          검색 중…
        </p>
      )}
      {notice && (
        <p className="nearby-notice" role="status">
          {notice} <Link href="/restaurants">목록 보기 ↗</Link>
        </p>
      )}
      {result && location && (
        <section className="nearby-results" aria-label="주변 식당 검색 결과">
          <div className="section-heading">
            <h2>
              검색 결과 <span>{result.places.length}</span>
            </h2>
          </div>
          <p className="nearby-hint">
            반경 {distanceLabel(radius)} · 가까운 순 · 직선거리 기준
          </p>
          {result.places.length > 0 && (
            <label className="nearby-filter">
              불러온 결과 필터
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="식당 이름, 음식 종류, 주소"
              />
            </label>
          )}
          {!visible.length ? (
            <div className="empty-state compact">
              <h3>
                {filter
                  ? "조건에 맞는 식당이 없습니다"
                  : "반경 안에 검색된 식당이 없습니다"}
              </h3>
              <p>
                {filter
                  ? "검색어를 바꾸거나 결과를 더 불러오세요."
                  : "반경을 늘리거나 기준 위치를 변경해 주세요."}
              </p>
            </div>
          ) : (
            <div className="nearby-grid">
              {visible.map((place) => (
                <article className="nearby-card" key={place.id}>
                  <div className="nearby-card-heading">
                    <h3>{place.name}</h3>
                    <strong>{distanceLabel(place.distance)}</strong>
                  </div>
                  <p className="nearby-category">
                    {place.category.replace(/^음식점\s*>?\s*/, "") || "음식점"}
                  </p>
                  <p>{place.address}</p>
                  {place.phone && (
                    <a
                      className="nearby-phone"
                      href={`tel:${place.phone.replace(/[^\d+]/g, "")}`}
                    >
                      {place.phone}
                    </a>
                  )}
                  <div className="nearby-card-actions">
                    <a
                      className="secondary"
                      href={place.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      지도·상세 ↗
                    </a>
                    <button
                      className="primary"
                      onClick={() => setEditor(place)}
                      disabled={saving || savedPlace(place)}
                    >
                      {savedPlace(place) ? "추가됨" : "목록에 추가"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {result.hasMore && (
            <button
              className="secondary nearby-more"
              disabled={busy}
              onClick={() =>
                void findRestaurants(location, radius, result.page + 1)
              }
            >
              더 불러오기
            </button>
          )}
          <p className="nearby-hint">
            카카오맵 제공 · 검색당 최대 45곳. 주변의 모든 식당이 포함되지는 않을
            수 있습니다.
          </p>
          <p className="nearby-hint">
            영업시간·휴무는 식당 상세에서 확인해 주세요.
          </p>
        </section>
      )}
      {!result && !busy && !error && (
        <p className="nearby-hint">
          현재 위치를 허용하거나 주소를 검색해 기준 위치를 선택하세요.
        </p>
      )}
      {editor && (
        <RestaurantEditor
          key={editor.id}
          item={null}
          initialInput={placeInput(editor)}
          busy={saving}
          onClose={() => {
            if (!saving) setEditor(null);
          }}
          onSave={save}
          onDelete={async () => {}}
        />
      )}
    </>
  );
}
