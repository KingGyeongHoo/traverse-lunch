"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type CSSProperties,
} from "react";
import SiteHeader from "./site-header";
import SelectionIcon from "./selection-icon";
import { lunchClient } from "@/lib/lunch-client";
import officeRestaurantDistances from "@/data/office-restaurant-distances.json";
import { OFFICE, type RestaurantLocation } from "@/lib/restaurant-location";
import {
  availability,
  CATEGORIES,
  DAYS,
  DISTANCES,
  matchesDistance,
  duplicateRestaurant,
  DUPLICATE_RESTAURANT_MESSAGE,
  type Category,
  type Distance,
  type LunchSnapshot,
  type Restaurant,
  type RestaurantInput,
} from "@/lib/lunch";

const WEEK = [1, 2, 3, 4, 5, 6, 0];

function distanceMetersOf(item: Restaurant): number | null {
  if (item.distanceMeters !== undefined) return item.distanceMeters;
  // Imported restaurants: meters from 양평로 12, independent of editable notes.
  const savedDistance = (officeRestaurantDistances as Record<string, number>)[
    item.id
  ];
  if (savedDistance !== undefined) return savedDistance;
  const match = item.note.match(/^양평로12 직선 약 (\d+)m(?:\r?\n|$)/);
  if (!match) return null;
  const meters = Number(match[1]);
  return Number.isSafeInteger(meters) ? meters : null;
}

type IconName =
  | "plus"
  | "shuffle"
  | "arrow"
  | "edit"
  | "close"
  | "search"
  | "check"
  | "clock";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    shuffle: (
      <>
        <path d="m17 3 4 4-4 4M3 17h3c5 0 5-10 10-10h5M3 7h3c2 0 3 1 4 3m4 4c1 2 2 3 4 3h3m-4-4 4 4-4 4" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    edit: (
      <>
        <path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

const messageOf = (error: unknown) =>
  error instanceof Error && error.name !== "TimeoutError"
    ? error.message
    : "연결이 지연되고 있어요. 잠시 후 다시 시도해 주세요.";

export default function LunchApp() {
  const [data, setData] = useState<LunchSnapshot | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<Restaurant | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [picked, setPicked] = useState<Restaurant | null>(null);
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [distanceFilter, setDistanceFilter] = useState<Distance>("매우 멂");
  const active = useRef(false);
  const sequence = useRef(0);

  const apply = useCallback(
    (next: LunchSnapshot) => {
      setData(next);
      setPicked((previous) => {
        const current = next.restaurants.find(
          (item) => item.id === previous?.id,
        );
        return current &&
          availability(current, next.today, next.weekday) === "available" &&
          matchesDistance(current, distanceFilter)
          ? current
          : null;
      });
    },
    [distanceFilter],
  );

  const refresh = useCallback(() => {
    if (active.current) return;
    const seq = ++sequence.current;
    return lunchClient
      .load()
      .then((next) => {
        if (seq !== sequence.current) return;
        apply(next);
        setError("");
      })
      .catch((error: unknown) => {
        if (seq === sequence.current) setError(messageOf(error));
      });
  }, [apply]);

  useEffect(() => {
    const requests = sequence;
    void refresh();
    const interval = setInterval(() => void refresh(), 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      requests.current++;
    };
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!spinning) return;
    const interval = setInterval(() => setTick((value) => value + 1), 95);
    return () => clearInterval(interval);
  }, [spinning]);

  async function mutate(action: () => Promise<LunchSnapshot>) {
    if (active.current) throw new Error("진행 중인 작업을 잠시 기다려 주세요.");
    active.current = true;
    sequence.current++;
    setBusy(true);
    setError("");
    try {
      apply(await action());
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  async function save(input: RestaurantInput) {
    await mutate(() =>
      lunchClient.save(
        input,
        editor === "new" ? undefined : (editor as Restaurant).id,
      ),
    );
    setEditor(null);
    setNotice("식당을 저장했어요.");
  }

  async function remove(id: string) {
    await mutate(() => lunchClient.remove(id));
    setEditor(null);
    setNotice("식당을 삭제했어요.");
  }

  async function pick() {
    if (active.current) return;
    active.current = true;
    sequence.current++;
    setSpinning(true);
    setError("");
    setPicked(null);
    try {
      const [next] = await Promise.all([
        lunchClient.pick(distanceFilter),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
      apply(next);
      setPicked(next.picked);
    } catch (error) {
      setError(messageOf(error));
    } finally {
      active.current = false;
      setSpinning(false);
    }
  }

  const items = data?.restaurants || [];
  const stateOf = (item: Restaurant) =>
    availability(item, data!.today, data!.weekday);
  const available = items.filter((item) => stateOf(item) === "available");
  const candidates = available.filter((item) =>
    matchesDistance(item, distanceFilter),
  );
  const closed = items.filter((item) => stateOf(item) === "closed");
  const open = items.filter((item) => stateOf(item) !== "closed");
  const visible = items
    .filter(
      (item) =>
        (filter === "all" ||
          (filter === "available"
            ? stateOf(item) !== "closed"
            : stateOf(item) === "closed")) &&
        `${item.name} ${item.category} ${item.note}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (distanceMetersOf(a) ?? Number.MAX_SAFE_INTEGER) -
          (distanceMetersOf(b) ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name, "ko"),
    );
  const rolling = candidates[tick % (candidates.length || 1)];
  const disabled = busy || spinning;
  const dateLabel = data
    ? `${Number(data.today.slice(5, 7))}월 ${Number(data.today.slice(8))}일 ${DAYS[data.weekday]}요일`
    : "날짜 확인 중";

  return (
    <div className="app-shell">
      <SiteHeader current="restaurants" />
      <main>
        <div className="intro">
          <div>
            <h1>식당 고르기</h1>
          </div>
          <div className="date-badge">
            <Icon name="clock" size={17} />
            <span>{dateLabel}</span>
          </div>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button onClick={() => void refresh()} disabled={disabled}>
              다시 불러오기
            </button>
          </div>
        )}

        <section
          className={`picker ${picked ? "has-result" : ""}`}
          aria-labelledby="picker-title"
          aria-busy={spinning}
        >
          <div className={`pick-result ${spinning ? "spinning" : ""}`}>
            <span className="result-label">
              {spinning ? "추첨 중" : picked ? "선택된 식당" : "추첨 가능 식당"}
            </span>
            <div
              className="result-value"
              aria-live={spinning ? "off" : "polite"}
              aria-atomic="true"
            >
              {spinning || picked ? (
                <strong className="result-name">
                  {spinning ? rolling?.name || "추첨 중" : picked?.name}
                </strong>
              ) : (
                <>
                  <strong className="candidate-count">
                    {data ? candidates.length : "—"}
                  </strong>
                  <span className="count-unit">곳</span>
                </>
              )}
            </div>
            <div className="result-symbol">
              <SelectionIcon kind="restaurants" />
            </div>
          </div>
          <div className="picker-copy">
            <div
              className="picker-heading"
              aria-live="polite"
              aria-atomic="true"
            >
              <h2 id="picker-title">
                {spinning ? "추첨 중" : picked ? "추첨 결과" : "식당 추첨"}
              </h2>
              <p className="result-description">
                {picked &&
                  `${picked.category} · ${picked.distance || "거리 미설정"}`}
              </p>
            </div>
            <fieldset className="distance-filter" disabled={disabled}>
              <legend>최대 거리</legend>
              <input
                className="distance-range"
                type="range"
                min={0}
                max={DISTANCES.length - 1}
                step={1}
                value={DISTANCES.indexOf(distanceFilter)}
                aria-label="추천 최대 거리"
                aria-valuetext={
                  distanceFilter === "매우 멂"
                    ? "매우 멂, 모든 거리 포함"
                    : `${distanceFilter}까지 포함`
                }
                style={
                  {
                    "--range-progress": `${(DISTANCES.indexOf(distanceFilter) / (DISTANCES.length - 1)) * 100}%`,
                  } as CSSProperties
                }
                onChange={(event) => {
                  setDistanceFilter(DISTANCES[Number(event.target.value)]);
                  setPicked(null);
                }}
              />
              <div className="distance-stops">
                {DISTANCES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={distanceFilter === value}
                    className={distanceFilter === value ? "selected" : ""}
                    onClick={() => {
                      setDistanceFilter(value);
                      setPicked(null);
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <p className="distance-summary" aria-live="polite">
                {distanceFilter === "가까움"
                  ? "가까운 식당만"
                  : distanceFilter === "중간"
                    ? "가까움 + 중간까지"
                    : distanceFilter === "멂"
                      ? "멂까지 · 750m 이하"
                      : "모든 거리 포함"}
                <span>오늘의 후보 {candidates.length}곳</span>
              </p>
            </fieldset>
            <button
              className="primary pick-button"
              onClick={pick}
              disabled={disabled || !data || !candidates.length}
            >
              <Icon name="shuffle" />
              {spinning
                ? "추첨 중…"
                : picked
                  ? "한 번 더 뽑기"
                  : "오늘 점심 뽑기"}
              <Icon name="arrow" size={18} />
            </button>
            <p className="picker-footnote">
              {!data
                ? "식당 목록을 불러오고 있어요"
                : !items.length
                  ? "식당을 추가해 주세요"
                  : !candidates.length
                    ? distanceFilter === "매우 멂"
                      ? "오늘 가능한 식당이 없어요. 휴무 설정을 확인해 주세요"
                      : `‘${distanceFilter}’까지 후보가 없어요. 거리를 늘리거나 식당의 거리를 설정해 주세요`
                    : "정기휴무 식당은 추첨에서 제외"}
            </p>
          </div>
        </section>

        <section className="restaurants" aria-labelledby="list-title">
          <div className="section-heading">
            <div>
              <h2 id="list-title">
                우리 팀 식당 목록 <span>{items.length}</span>
              </h2>
            </div>
            <button
              className="dark-button"
              onClick={() => setEditor("new")}
              disabled={disabled || !data}
            >
              <Icon name="plus" size={18} />
              식당 추가
            </button>
          </div>
          <div className="list-toolbar">
            <div className="filters" aria-label="식당 상태 필터">
              {[
                ["all", "전체", items.length],
                ["available", "영업중", open.length],
                ["closed", "휴무", closed.length],
              ].map(([key, label, count]) => (
                <button
                  key={key}
                  className={filter === key ? "active" : ""}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(String(key))}
                >
                  {label}
                  <span>{count}</span>
                </button>
              ))}
            </div>
            <label className="search">
              <Icon name="search" size={17} />
              <input
                aria-label="식당 검색"
                placeholder="식당 이름, 메뉴 검색"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          {!data ? (
            <div className="empty-state">
              <span className="empty-icon">
                <SelectionIcon kind="restaurants" />
              </span>
              <h3>{error ? "목록을 불러오지 못했어요" : "목록 불러오는 중"}</h3>
              <p>
                {error
                  ? "위의 다시 불러오기 버튼으로 재시도해 주세요."
                  : "잠시만 기다려 주세요."}
              </p>
            </div>
          ) : !items.length ? (
            <div className="empty-state">
              <span className="empty-icon">
                <SelectionIcon kind="restaurants" />
              </span>
              <h3>등록된 식당이 없습니다</h3>
              <button className="text-button" onClick={() => setEditor("new")}>
                <Icon name="plus" size={17} />첫 식당 추가하기
              </button>
            </div>
          ) : !visible.length ? (
            <div className="empty-state compact">
              <h3>조건에 맞는 식당이 없어요</h3>
              <p>다른 상태를 선택하거나 검색어를 바꿔보세요.</p>
              <button
                className="text-button"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                전체 목록 보기
              </button>
            </div>
          ) : (
            <div className="restaurant-grid">
              {visible.map((item) => {
                const meters = distanceMetersOf(item);
                const status =
                  stateOf(item) === "closed" ? "closed" : "available";
                return (
                  <article
                    key={item.id}
                    className={`restaurant-card ${status}`}
                  >
                    <div className="card-top">
                      <span className={`status-tag ${status}`}>
                        <span />
                        {status === "closed" ? "휴무" : "영업중"}
                      </span>
                      <button
                        className="icon-button edit-button"
                        aria-label={`${item.name} 수정`}
                        onClick={() => setEditor(item)}
                        disabled={disabled}
                      >
                        <Icon name="edit" size={17} />
                      </button>
                    </div>
                    <div className="card-meta">
                      <span className="category-label">{item.category}</span>
                      <span
                        className="distance-tag"
                        title={
                          meters !== null
                            ? "양평로 12 기준 직선거리"
                            : undefined
                        }
                      >
                        {item.distance || "거리 미설정"}
                        {meters !== null &&
                          ` (${meters.toLocaleString("ko-KR")}m)`}
                      </span>
                    </div>
                    <h3>{item.name}</h3>
                    <div className="closed-days">
                      <Icon name="clock" size={14} />
                      <span>
                        {item.closedDays.length
                          ? `${WEEK.filter((day) =>
                              item.closedDays.includes(day),
                            )
                              .map((day) => DAYS[day])
                              .join("·")}요일 정기휴무`
                          : "등록된 정기휴무 없음"}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div className="list-tip">
            <Icon name="clock" size={15} />
            <span>영업 상태는 등록된 정기휴무 기준</span>
            <span className="timezone">한국 시간 기준</span>
          </div>
        </section>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" size={17} />
          {notice}
        </div>
      )}
      {editor !== null && (
        <RestaurantEditor
          restaurants={items}
          item={editor === "new" ? null : editor}
          busy={busy}
          onClose={() => setEditor(null)}
          onSave={save}
          onDelete={remove}
        />
      )}
    </div>
  );
}

function RestaurantEditor({
  restaurants,
  item,
  busy: saving,
  onClose,
  onSave,
  onDelete,
}: {
  restaurants: Restaurant[];
  item: Restaurant | null;
  busy: boolean;
  onClose: () => void;
  onSave: (value: RestaurantInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(item?.name || "");
  const [category, setCategory] = useState<Category>(item?.category || "한식");
  const [distance, setDistance] = useState<Distance | null>(
    item?.distance ?? null,
  );
  const [address, setAddress] = useState(item?.address || "");
  const [location, setLocation] = useState<RestaurantLocation | null>(
    item?.address &&
      item.latitude != null &&
      item.longitude != null &&
      item.distanceMeters != null &&
      item.distance
      ? {
          address: item.address,
          latitude: item.latitude,
          longitude: item.longitude,
          distanceMeters: item.distanceMeters,
          distance: item.distance,
        }
      : null,
  );
  const [locating, setLocating] = useState(false);
  const [addressError, setAddressError] = useState("");
  const duplicate = duplicateRestaurant(
    restaurants,
    { name, address: location?.address || address },
    item?.id,
  );
  const [submitting, setSubmitting] = useState(false);
  const busy = saving || locating || submitting;
  const [note, setNote] = useState(item?.note || "");
  const [days, setDays] = useState<number[]>(item?.closedDays || []);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const viewport = window.visualViewport;
    const resize = () => {
      element?.style.setProperty(
        "--editor-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      element?.style.setProperty(
        "--editor-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
    };
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    return () => {
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
    };
  }, []);

  async function locate() {
    if (location && location.address === address.trim()) return location;
    setLocating(true);
    setError("");
    setAddressError("");
    try {
      const next = await lunchClient.resolveAddress(address.trim());
      setAddress(next.address);
      setLocation(next);
      setDistance(next.distance);
      return next;
    } catch (error) {
      setAddressError(messageOf(error));
      throw error;
    } finally {
      setLocating(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setSubmitting(true);
    try {
      if (!item && !address.trim())
        throw new Error("식당 주소를 입력해 주세요.");
      const verified = address.trim() ? await locate().catch(() => null) : null;
      if (address.trim() && !verified) return;
      if (
        duplicateRestaurant(
          restaurants,
          { name, address: verified?.address || "" },
          item?.id,
        )
      )
        throw new Error(DUPLICATE_RESTAURANT_MESSAGE);
      await onSave({
        name,
        category,
        note,
        closedDays: days,
        distance: verified?.distance ?? distance,
        address: verified?.address ?? "",
        latitude: verified?.latitude ?? null,
        longitude: verified?.longitude ?? null,
        ...(verified ? { distanceMeters: verified.distanceMeters } : {}),
      });
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      className="editor"
      ref={dialog}
      aria-labelledby="editor-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="editor-header">
          <div>
            <h2 id="editor-title">{item ? "식당 수정" : "식당 추가"}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="닫기"
            onClick={onClose}
            disabled={busy}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="editor-body">
          <fieldset disabled={busy} className="editor-fields">
            <label className="field-label" htmlFor="restaurant-name">
              식당 또는 메뉴 이름 <span>*</span>
            </label>
            <input
              id="restaurant-name"
              required
              maxLength={50}
              placeholder="예: 회사 앞 국밥집, 돈까스"
              value={name}
              aria-invalid={!!duplicate}
              aria-describedby={duplicate ? "duplicate-name-error" : undefined}
              onChange={(event) => setName(event.target.value)}
            />
            {duplicate && (
              <p id="duplicate-name-error" className="form-error" role="alert">
                {DUPLICATE_RESTAURANT_MESSAGE}
              </p>
            )}
            <label className="field-label" htmlFor="restaurant-category">
              음식 종류
            </label>
            <select
              id="restaurant-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as Category)}
            >
              {CATEGORIES.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <label className="field-label" htmlFor="restaurant-address">
              식당 주소 {!item && <span>*</span>}
            </label>
            <div className="address-entry">
              <input
                id="restaurant-address"
                required={!item}
                maxLength={200}
                placeholder="예: 서울 영등포구 양평로 12"
                autoComplete="street-address"
                value={address}
                aria-invalid={!!addressError}
                aria-describedby={addressError ? "address-error" : undefined}
                onChange={(event) => {
                  setAddress(event.target.value);
                  setLocation(null);
                  setDistance(
                    !event.target.value.trim() && !item?.address
                      ? (item?.distance ?? null)
                      : null,
                  );
                  setError("");
                  setAddressError("");
                }}
              />
              <button
                type="button"
                className="secondary"
                disabled={busy || !address.trim()}
                onClick={() => void locate().catch(() => {})}
              >
                {locating ? "확인 중…" : "주소 확인"}
              </button>
            </div>
            {addressError && (
              <p id="address-error" className="form-error" role="alert">
                {addressError}
              </p>
            )}
            <p className="field-help" aria-live="polite">
              {location
                ? `${location.distance} (${location.distanceMeters.toLocaleString("ko-KR")}m) · 직선거리`
                : `${OFFICE.address} 기준 · 저장 시 자동 계산`}
            </p>
            <label className="field-label" htmlFor="restaurant-distance">
              거리
            </label>
            <select
              id="restaurant-distance"
              disabled={
                !item ||
                !!address.trim() ||
                (!item.address && item.distanceMeters != null)
              }
              value={distance ?? ""}
              onChange={(event) =>
                setDistance(
                  event.target.value ? (event.target.value as Distance) : null,
                )
              }
            >
              <option value="">거리 미설정</option>
              {DISTANCES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <p className="field-help">
              {!item || address.trim()
                ? "가까움 ≤250m · 중간 ≤500m · 멂 ≤750m · 매우 멂 >750m"
                : item.distanceMeters != null && !item.address
                  ? `회사 기준 직선거리 ${item.distanceMeters.toLocaleString("ko-KR")}m`
                  : "주소가 없는 기존 식당은 거리를 직접 선택할 수 있습니다."}
            </p>
            <span className="field-label" id="closed-label">
              정기휴무 <small>여러 요일을 선택할 수 있어요</small>
            </span>
            <div
              className="weekday-picker"
              role="group"
              aria-labelledby="closed-label"
            >
              {WEEK.map((day) => (
                <button
                  type="button"
                  key={day}
                  aria-label={`${DAYS[day]}요일 휴무`}
                  aria-pressed={days.includes(day)}
                  className={days.includes(day) ? "selected" : ""}
                  onClick={() =>
                    setDays((previous) =>
                      previous.includes(day)
                        ? previous.filter((value) => value !== day)
                        : [...previous, day],
                    )
                  }
                >
                  {DAYS[day]}
                </button>
              ))}
            </div>
            <p className="field-help">
              {days.length === 7
                ? "매일 휴무로 설정되어 뽑기에서 항상 제외돼요."
                : days.length
                  ? "선택한 요일에는 자동으로 뽑기에서 제외돼요."
                  : "정기휴무가 없으면 선택하지 않아도 돼요."}
            </p>
            <label className="field-label" htmlFor="restaurant-note">
              메모 <small>선택</small>
            </label>
            <textarea
              id="restaurant-note"
              maxLength={200}
              rows={3}
              placeholder="추천 메뉴, 위치, 점심 영업시간 등을 적어주세요."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <span className="character-count">{note.length}/200</span>
          </fieldset>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {confirmDelete && item && (
            <div className="delete-confirm">
              <p>‘{item.name}’을 목록에서 삭제할까요?</p>
              <div>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="danger-text"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await onDelete(item.id);
                    } catch (error) {
                      setError(messageOf(error));
                    }
                  }}
                >
                  삭제하기
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="editor-actions">
          {item && !confirmDelete ? (
            <button
              type="button"
              className="delete-button"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
            >
              식당 삭제
            </button>
          ) : (
            <span />
          )}
          <div>
            <button
              type="button"
              className="secondary"
              onClick={onClose}
              disabled={busy}
            >
              취소
            </button>
            <button
              className="primary"
              type="submit"
              disabled={busy || !name.trim() || !!duplicate}
            >
              {busy ? "저장 중…" : "저장하기"}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
