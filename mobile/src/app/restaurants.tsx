import { showAlert } from "../lib/dialog";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button, Chip, colors, Field, s } from "../components/ui";
import { useLunch } from "../lib/store";
import {
  availability,
  DAYS,
  DISTANCES,
  matchesDistance,
  type Distance,
  type Restaurant,
} from "../lib/domain";
import { messageOf } from "../lib/api";

const FOOD = {
  한식: "🍚",
  중식: "🥟",
  일식: "🍣",
  양식: "🍝",
  분식: "🍜",
  기타: "🍽️",
};
const FILTERS = [
  ["all", "전체"],
  ["available", "오늘 가능"],
  ["closed", "정기휴무"],
  ["excluded", "오늘 제외"],
] as const;

export default function Restaurants() {
  const { ready, team, data, error, busy, refreshing, refresh, mutate } =
    useLunch();
  const [distance, setDistance] = useState<Distance>("멂");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<{
    id: string;
    today: string;
    teamId: string;
  } | null>(null);
  const [picking, setPicking] = useState(false);
  const items = data?.restaurants ?? [];
  const stateOf = (item: Restaurant) =>
    data ? availability(item, data.today, data.weekday) : "closed";
  const candidates = items.filter(
    (item) => stateOf(item) === "available" && matchesDistance(item, distance),
  );
  const picked =
    result?.today === data?.today && result?.teamId === team?.id
      ? candidates.find((item) => item.id === result?.id)
      : undefined;
  const visible = items.filter(
    (item) =>
      (filter === "all" || stateOf(item) === filter) &&
      `${item.name} ${item.category} ${item.note}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );

  async function pick() {
    setPicking(true);
    setResult(null);
    try {
      const next = await mutate("pick", { distance });
      if (next.picked)
        setResult({ id: next.picked.id, today: next.today, teamId: team!.id });
    } catch (error) {
      showAlert("추첨을 마치지 못했어요", messageOf(error));
    } finally {
      setPicking(false);
    }
  }
  async function toggle(item: Restaurant) {
    try {
      await mutate("exclude", {
        id: item.id,
        excludedToday: item.excludedDate !== data?.today,
      });
    } catch (error) {
      showAlert("변경을 마치지 못했어요", messageOf(error));
    }
  }

  if (!ready)
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator
          color={colors.accentText}
          accessibilityLabel="앱 준비 중"
        />
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={s.screen} edges={["left", "right", "bottom"]}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.accentText}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 22 }}>
            {!!error && (
              <View style={s.card}>
                <Text accessibilityRole="alert" style={s.error}>
                  {error}
                </Text>
                {!!data && (
                  <Text style={s.text}>마지막으로 불러온 목록이에요.</Text>
                )}
                <Button
                  secondary
                  label="다시 불러오기"
                  disabled={busy || refreshing}
                  onPress={() => void refresh()}
                />
              </View>
            )}
            <View
              style={[
                s.card,
                {
                  backgroundColor: colors.soft,
                  borderWidth: 0,
                  padding: 24,
                  gap: 18,
                },
              ]}
            >
              {!!picked && (
                <View accessibilityLiveRegion="polite" style={{ gap: 8 }}>
                  <Text style={s.title}>{picked.name}</Text>
                  <Text style={s.text}>
                    {picked.category} · {picked.distance || "거리 미설정"}
                  </Text>
                  {!!picked.note && <Text style={s.text}>{picked.note}</Text>}
                </View>
              )}
              <Text style={s.label}>최대 거리</Text>
              <View style={s.wrap}>
                {DISTANCES.map((value) => (
                  <Chip
                    key={value}
                    label={value}
                    selected={distance === value}
                    disabled={busy}
                    onPress={() => {
                      setDistance(value);
                      setResult(null);
                    }}
                  />
                ))}
              </View>
              <Text style={s.text}>
                {distance === "가까움"
                  ? "가까운 식당만"
                  : distance === "중간"
                    ? "가까움 + 중간까지"
                    : "모든 거리 포함"}{" "}
                · 오늘의 후보 {candidates.length}곳
              </Text>
              <Button
                label={
                  picking ? "고르는 중…" : picked ? "다시 뽑기" : "식당 뽑기"
                }
                onPress={() => void pick()}
                disabled={busy || !data || !candidates.length || !!error}
              />
              <Text style={[s.text, { fontSize: 12 }]}>
                {!items.length
                  ? "식당을 추가해 주세요."
                  : !candidates.length
                    ? "후보가 없어요. 거리·휴무·제외 설정을 확인해 주세요."
                    : ""}
              </Text>
            </View>
            <View style={s.row}>
              <Text style={[s.heading, { flex: 1 }]}>식당 {items.length}</Text>
              <Button
                label="식당 추가"
                disabled={busy || !data}
                onPress={() => router.push("/editor")}
              />
            </View>
            <Field
              label="식당 검색"
              placeholder="이름, 종류, 메모로 검색"
              value={search}
              onChangeText={setSearch}
            />
            <View style={s.wrap}>
              {FILTERS.map(([key, label]) => (
                <Chip
                  key={key}
                  label={`${label} ${key === "all" ? items.length : items.filter((item) => stateOf(item) === key).length}`}
                  selected={filter === key}
                  onPress={() => setFilter(key)}
                />
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <Text style={{ fontSize: 32 }}>{FOOD[item.category]}</Text>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={s.heading}>{item.name}</Text>
                <Text style={s.text}>
                  {item.category} · {item.distance || "거리 미설정"}
                </Text>
              </View>
              <Text
                style={{
                  color:
                    stateOf(item) === "available"
                      ? colors.accentText
                      : colors.muted,
                  fontSize: 12,
                }}
              >
                {stateOf(item) === "available"
                  ? "오늘 가능"
                  : stateOf(item) === "closed"
                    ? "정기휴무"
                    : "오늘 제외"}
              </Text>
            </View>
            {!!item.note && <Text style={s.text}>{item.note}</Text>}
            {!!item.closedDays.length && (
              <Text style={s.text}>
                매주 {item.closedDays.map((day) => DAYS[day]).join("·")}요일
                휴무
              </Text>
            )}
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Button
                  secondary
                  label={
                    item.excludedDate === data?.today
                      ? "오늘 제외 해제"
                      : "오늘만 제외"
                  }
                  disabled={busy || stateOf(item) === "closed"}
                  onPress={() => void toggle(item)}
                />
              </View>
              <Button
                secondary
                label="수정"
                disabled={busy}
                onPress={() =>
                  router.push({ pathname: "/editor", params: { id: item.id } })
                }
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={s.text}>
            {!data
              ? "목록을 불러오지 못했어요."
              : !items.length
                ? "등록된 식당이 없습니다."
                : "검색 결과가 없습니다."}
          </Text>
        }
      />
    </SafeAreaView>
  );
}
