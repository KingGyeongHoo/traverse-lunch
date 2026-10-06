import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import { parseSnapshot } from "./api";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const configured =
  !!url && !!key && !url.includes("YOUR_PROJECT") && !key.includes("YOUR_");

// Missing credentials leave the app in a usable setup state instead of crashing.
export const supabase = configured
  ? createClient(url!, key!, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    })
  : null;

export type Team = { id: string; name: string };
export type Action = "save" | "delete" | "exclude" | "pick";

function client() {
  if (!supabase)
    throw new Error("앱 연결 준비 중이에요. 관리자에게 문의해 주세요.");
  return supabase;
}
export async function ensureSession() {
  const db = client();
  const { data, error } = await db.auth.getSession();
  if (error)
    throw new Error("로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.");
  if (!data.session) {
    const { error } = await db.auth.signInAnonymously();
    if (error)
      throw new Error(
        "목록을 불러오지 못했어요. 네트워크 연결을 확인해 주세요.",
      );
  }
}
export async function rpc(name: string, args: Record<string, unknown>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const { data, error } = await client()
      .rpc(name, args)
      .abortSignal(controller.signal);
    if (error) {
      if (error.code === "P0001") throw new Error(error.message);
      if (
        error.code === "23514" ||
        error.code === "22P02" ||
        error.code === "23502"
      )
        throw new Error("입력한 식당 정보를 확인해 주세요.");
      throw new Error(
        "처리 결과를 확인하지 못했어요. 목록을 새로고침한 뒤 다시 시도해 주세요.",
      );
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}
export async function loadSnapshot(teamId: string) {
  return parseSnapshot(await rpc("lunch_snapshot", { p_team: teamId }));
}
export async function changeTeam(
  teamId: string,
  action: Action,
  payload: Record<string, unknown>,
) {
  const value = await rpc("lunch_mutate", {
    p_team: teamId,
    p_action: action,
    p_payload: payload,
  });
  const snapshot = parseSnapshot(value);
  const picked = snapshot.restaurants.find(
    (item) => item.id === value.picked?.id,
  );
  if (action === "pick" && !picked)
    throw new Error("추첨 결과를 확인하지 못했어요. 다시 시도해 주세요.");
  return { ...snapshot, picked };
}
export async function openCompany(): Promise<Team> {
  const company = await rpc("lunch_open_company", {});
  if (!company?.id || !company?.name)
    throw new Error("회사 목록을 불러오지 못했어요.");
  return { id: company.id, name: company.name };
}
