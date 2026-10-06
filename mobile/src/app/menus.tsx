import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Chip, colors, s } from "../components/ui";

const MENUS = [
  { name: "김치찌개", category: "한식" },
  { name: "된장찌개", category: "한식" },
  { name: "순두부찌개", category: "한식" },
  { name: "제육볶음", category: "한식" },
  { name: "비빔밥", category: "한식" },
  { name: "국밥", category: "한식" },
  { name: "냉면", category: "한식" },
  { name: "칼국수", category: "한식" },
  { name: "짜장면", category: "중식" },
  { name: "짬뽕", category: "중식" },
  { name: "볶음밥", category: "중식" },
  { name: "마라탕", category: "중식" },
  { name: "돈까스", category: "일식" },
  { name: "초밥", category: "일식" },
  { name: "우동", category: "일식" },
  { name: "라멘", category: "일식" },
  { name: "파스타", category: "양식" },
  { name: "피자", category: "양식" },
  { name: "햄버거", category: "양식" },
  { name: "샌드위치", category: "양식" },
  { name: "김밥", category: "분식" },
  { name: "떡볶이", category: "분식" },
  { name: "쌀국수", category: "기타" },
  { name: "샐러드", category: "기타" },
];
const CATEGORIES = ["전체", "한식", "중식", "일식", "양식", "분식", "기타"];

export default function Menus() {
  const [category, setCategory] = useState("전체");
  const [picked, setPicked] = useState<string | null>(null);
  const candidates = MENUS.filter(
    (menu) => category === "전체" || menu.category === category,
  );
  return (
    <SafeAreaView style={s.screen} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.wrap}>
          {CATEGORIES.map((value) => (
            <Chip
              key={value}
              label={value}
              selected={category === value}
              onPress={() => {
                setCategory(value);
                setPicked(null);
              }}
            />
          ))}
        </View>
        {picked && (
          <View
            style={[
              s.card,
              {
                backgroundColor: colors.soft,
                borderColor: colors.primary,
                paddingVertical: 32,
              },
            ]}
            accessibilityLiveRegion="polite"
          >
            <Text style={s.title}>{picked}</Text>
          </View>
        )}
        <Button
          label={picked ? "다시 뽑기" : "메뉴 뽑기"}
          onPress={() =>
            setPicked(
              candidates[Math.floor(Math.random() * candidates.length)].name,
            )
          }
        />
        <Text style={s.label}>후보 {candidates.length}개</Text>
        <View style={s.wrap}>
          {candidates.map((menu) => (
            <Text
              key={menu.name}
              style={[
                s.text,
                {
                  flexBasis: "30%",
                  flexGrow: 1,
                  textAlign: "center",
                  paddingVertical: 16,
                  paddingHorizontal: 8,
                  backgroundColor: colors.surface,
                  borderRadius: 10,
                  color: colors.ink,
                },
              ]}
            >
              {menu.name}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
