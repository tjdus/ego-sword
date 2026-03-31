import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  SwordState,
  OwnerState,
  EnemyState,
  RoomData,
  TurnLog,
  AiEventData,
} from "@/lib/api";

interface RunStore {
  // 런 식별
  runId: string | null;
  currentFloor: number;

  // 게임 상태
  swordState: SwordState | null;
  ownerState: OwnerState | null;
  enemyState: EnemyState | null;
  currentRoom: RoomData | null;
  floorMap: RoomData[];
  currentEventData: AiEventData | null;

  // 전투 로그 (최근 20턴)
  battleLog: TurnLog[];

  // 유저
  userId: string | null;
  token: string | null;

  // 액션
  setAuth: (userId: string, token: string) => void;
  setRunId: (runId: string) => void;
  setSwordState: (state: SwordState) => void;
  setOwnerState: (state: OwnerState) => void;
  setEnemyState: (state: EnemyState | null) => void;
  setCurrentRoom: (room: RoomData) => void;
  setCurrentFloor: (floor: number) => void;
  setFloorMap: (rooms: RoomData[]) => void;
  setCurrentEventData: (data: AiEventData | null) => void;
  addBattleLog: (logs: TurnLog[]) => void;
  clearBattleLog: () => void;
  resetRun: () => void;
}

export const useRunStore = create<RunStore>()(
  persist(
    (set) => ({
      runId: null,
      currentFloor: 1,
      swordState: null,
      ownerState: null,
      enemyState: null,
      currentRoom: null,
      floorMap: [],
      currentEventData: null,
      battleLog: [],
      userId: null,
      token: null,

      setAuth: (userId, token) => {
        set({ userId, token });
        if (typeof window !== "undefined") {
          localStorage.setItem("ego_token", token);
        }
      },
      setRunId: (runId) => set({ runId }),
      setCurrentFloor: (currentFloor) => set({ currentFloor }),
      setSwordState: (swordState) => set({ swordState }),
      setOwnerState: (ownerState) => set({ ownerState }),
      setEnemyState: (enemyState) => set({ enemyState }),
      setCurrentRoom: (currentRoom) => set({ currentRoom }),
      setFloorMap: (floorMap) => set({ floorMap }),
      setCurrentEventData: (currentEventData) => set({ currentEventData }),
      addBattleLog: (logs) =>
        set((s) => ({ battleLog: [...s.battleLog, ...logs].slice(-20) })),
      clearBattleLog: () => set({ battleLog: [] }),
      resetRun: () =>
        set({
          runId: null,
          currentFloor: 1,
          swordState: null,
          ownerState: null,
          enemyState: null,
          currentRoom: null,
          floorMap: [],
          currentEventData: null,
          battleLog: [],
        }),
    }),
    {
      name: "ego-sword-run",
      partialize: (s) => ({
        runId: s.runId,
        userId: s.userId,
        token: s.token,
        currentFloor: s.currentFloor,
      }),
    },
  ),
);
