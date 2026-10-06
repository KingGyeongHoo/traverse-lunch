import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { messageOf } from "./api";
import {
  supabase,
  ensureSession,
  openCompany,
  loadSnapshot,
  changeTeam,
  type Team,
  type Action,
} from "./supabase";
import type { LunchSnapshot } from "./domain";

function useLunchStore() {
  const [team, setTeam] = useState<Team | null>(null);
  const workspace = useRef<Team | null>(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<LunchSnapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const sequence = useRef(0);
  const locked = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    const auth = supabase.auth;
    if (AppState.currentState === "active") auth.startAutoRefresh();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") auth.startAutoRefresh();
      else auth.stopAutoRefresh();
    });
    return () => {
      listener.remove();
      auth.stopAutoRefresh();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (locked.current) return;
    const seq = ++sequence.current;
    setRefreshing(true);
    try {
      await ensureSession();
      const current = workspace.current ?? (await openCompany());
      const next = await loadSnapshot(current.id);
      if (seq === sequence.current) {
        workspace.current = current;
        setTeam(current);
        setData(next);
        setError("");
      }
    } catch (error) {
      if (seq === sequence.current) setError(messageOf(error));
    } finally {
      if (seq === sequence.current) {
        setReady(true);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const requests = sequence;
    // Load the company workspace from the remote database on app startup.
    void refresh();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
      requests.current++;
    };
  }, [refresh]);

  async function mutate(action: Action, payload: Record<string, unknown>) {
    if (!team) throw new Error("식당 목록을 먼저 불러와 주세요.");
    if (locked.current) throw new Error("진행 중인 작업을 기다려 주세요.");
    locked.current = true;
    sequence.current++;
    setBusy(true);
    setRefreshing(false);
    try {
      await ensureSession();
      const next = await changeTeam(team.id, action, payload);
      setData(next);
      setError("");
      return next;
    } catch (error) {
      setError(messageOf(error));
      throw error;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return { team, ready, data, error, busy, refreshing, refresh, mutate };
}

const LunchContext = createContext<ReturnType<typeof useLunchStore> | null>(
  null,
);
export function LunchProvider({ children }: { children: ReactNode }) {
  const store = useLunchStore();
  return (
    <LunchContext.Provider value={store}>{children}</LunchContext.Provider>
  );
}
export function useLunch() {
  const store = useContext(LunchContext);
  if (!store) throw new Error("LunchProvider is required");
  return store;
}
