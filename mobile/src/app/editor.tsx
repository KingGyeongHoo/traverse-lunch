import { confirmDelete } from "../lib/dialog";
import { useEffect, useState } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Button, Chip, Field, s } from "../components/ui";
import { useLunch } from "../lib/store";
import {
  CATEGORIES,
  DAYS,
  DISTANCES,
  parseRestaurant,
  type Category,
  type Distance,
} from "../lib/domain";
import { messageOf } from "../lib/api";

export default function Editor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, busy, mutate } = useLunch();
  const original = data?.restaurants.find((item) => item.id === id);
  const [name, setName] = useState(original?.name ?? "");
  const [category, setCategory] = useState<Category>(
    original?.category ?? "한식",
  );
  const [distance, setDistance] = useState<Distance | null>(
    original?.distance ?? null,
  );
  const [note, setNote] = useState(original?.note ?? "");
  const [closedDays, setClosedDays] = useState<number[]>(
    original?.closedDays ?? [],
  );
  const [error, setError] = useState("");
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => busy);
    return () => sub.remove();
  }, [busy]);
  async function save() {
    setError("");
    try {
      const input = parseRestaurant({
        name,
        category,
        distance,
        note,
        closedDays,
      });
      await mutate("save", { id: id ?? null, input });
      router.back();
    } catch (error) {
      setError(messageOf(error));
    }
  }
  function remove() {
    confirmDelete(() => {
      void mutate("delete", { id })
        .then(() => router.back())
        .catch((error: unknown) => setError(messageOf(error)));
    });
  }
  if (!data || (id && !original))
    return (
      <View style={s.center}>
        <Text style={s.heading}>식당을 찾을 수 없어요</Text>
        <Text style={s.text}>
          다른 동료가 삭제했을 수 있어요. 목록을 다시 확인해 주세요.
        </Text>
        <Button label="목록으로" onPress={() => router.back()} />
      </View>
    );
  return (
    <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
      <Stack.Screen
        options={{
          title: id ? "식당 수정" : "새 식당 추가",
          headerBackVisible: !busy,
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <Field
            label="식당 이름"
            placeholder="예: 회사 앞 국밥집"
            value={name}
            onChangeText={setName}
            maxLength={50}
            editable={!busy}
          />
          <View style={{ gap: 10 }}>
            <Text style={s.label}>음식 종류</Text>
            <View style={s.wrap}>
              {CATEGORIES.map((value) => (
                <Chip
                  key={value}
                  label={value}
                  selected={category === value}
                  onPress={() => setCategory(value)}
                  disabled={busy}
                />
              ))}
            </View>
          </View>
          <View style={{ gap: 10 }}>
            <Text style={s.label}>거리</Text>
            <View style={s.wrap}>
              {[...DISTANCES, null].map((value) => (
                <Chip
                  key={value ?? "unset"}
                  label={value ?? "미설정"}
                  selected={distance === value}
                  onPress={() => setDistance(value)}
                  disabled={busy}
                />
              ))}
            </View>
          </View>
          <View style={{ gap: 10 }}>
            <Text style={s.label}>정기휴무 · 여러 요일 선택 가능</Text>
            <View style={s.wrap}>
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <Chip
                  key={day}
                  label={`${DAYS[day]}요일`}
                  selected={closedDays.includes(day)}
                  disabled={busy}
                  onPress={() =>
                    setClosedDays((days) =>
                      days.includes(day)
                        ? days.filter((value) => value !== day)
                        : [...days, day],
                    )
                  }
                />
              ))}
            </View>
            <Text style={s.text}>
              {closedDays.length
                ? "선택한 요일에는 추첨에서 자동으로 빠져요."
                : "선택하지 않으면 정기휴무가 없는 식당이에요."}
            </Text>
          </View>
          <Field
            label="메모"
            placeholder="추천 메뉴나 알아둘 점"
            multiline
            value={note}
            onChangeText={setNote}
            maxLength={200}
            editable={!busy}
          />
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <Button
            label={busy ? "저장 중…" : "저장"}
            onPress={() => void save()}
            disabled={busy}
          />
          <Button
            secondary
            label="취소"
            onPress={() => router.back()}
            disabled={busy}
          />
          {!!id && (
            <Button
              danger
              label="이 식당 삭제"
              onPress={remove}
              disabled={busy}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
