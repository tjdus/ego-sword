import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  SwordState,
  OwnerState,
  EnemyState,
  RoomData,
  TurnLog,
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
  setFloorMap: (rooms: RoomData[]) => void;
  addBattleLog: (logs: TurnLog[]) => void;
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
      setSwordState: (swordState) => set({ swordState }),
      setOwnerState: (ownerState) => set({ ownerState }),
      setEnemyState: (enemyState) => set({ enemyState }),
      setCurrentRoom: (currentRoom) => set({ currentRoom }),
      setFloorMap: (floorMap) => set({ floorMap }),
      addBattleLog: (logs) =>
        set((s) => ({ battleLog: [...s.battleLog, ...logs].slice(-20) })),
      resetRun: () =>
        set({
          runId: null,
          currentFloor: 1,
          swordState: null,
          ownerState: null,
          enemyState: null,
          currentRoom: null,
          floorMap: [],
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
