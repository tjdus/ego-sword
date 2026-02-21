import { JSONValue } from "next/dist/server/config-shared";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ego_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(
      (err as { message?: string }).message ?? `HTTP ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    guestLogin: (deviceId?: string) =>
      request<{ userId: string; token: string }>("/api/auth/guest", {
        method: "POST",
        body: JSON.stringify({ deviceId }),
      }),
    getProgress: () =>
      request<{
        permanentTraits: {
          traitId: string;
          stacks: number;
          category: string;
        }[];
        totalRuns: number;
        bestDepth: number;
        recentRuns: unknown[];
      }>("/api/auth/progress"),
  },

  run: {
    start: () =>
      request<{ runId: string; ownerCandidates: OwnerCandidate[] }>(
        "/api/run/start",
        { method: "POST" },
      ),

    selectOwner: (runId: string, candidateData: OwnerCandidate) =>
      request<{
        runId: string;
        ownerState: unknown;
        swordState: unknown;
        firstFloorMap: RoomData[];
      }>(`/api/run/${runId}/owner/select`, {
        method: "POST",
        body: JSON.stringify(candidateData),
      }),

    getMap: (runId: string, floor: number) =>
      request<RoomData[]>(`/api/run/${runId}/map/${floor}`),

    enterRoom: (runId: string, roomId: string) =>
      request<RoomEnterResult>(`/api/run/${runId}/room/${roomId}/enter`, {
        method: "POST",
      }),

    processTurn: (runId: string, roomId: string, body: TurnInput) =>
      request<TurnResult>(`/api/run/${runId}/room/${roomId}/turn`, {
        method: "POST",
        body: JSON.stringify(body),
      }),

    absorbItem: (runId: string, itemId: string) =>
      request<{ swordState: SwordState }>(`/api/run/${runId}/absorb`, {
        method: "POST",
        body: JSON.stringify({ itemId }),
      }),

    endRun: (runId: string) =>
      request<RunEndResult>(`/api/run/${runId}/end`, { method: "POST" }),

    selectTrait: (runId: string, traitId: string) =>
      request<{ selectedTrait: unknown; permanentTraits: PermanentTrait[] }>(
        `/api/run/${runId}/trait/select`,
        { method: "POST", body: JSON.stringify({ traitId }) },
      ),

    chooseEvent: (runId: string, eventId: string, choiceIndex: number, roomId: string) =>
      request<{ outcome: { text: string; tag?: string; rewards?: unknown[] } }>(
        `/api/run/${runId}/event/${eventId}/choose`,
        { method: "POST", body: JSON.stringify({ choiceIndex, roomId }) },
      ),

    completeRoom: (runId: string, roomId: string) =>
      request<{ status: string; ownerState: OwnerState | null }>(
        `/api/run/${runId}/room/${roomId}/complete`,
        { method: 'POST' },
      ),

    getShopItems: (runId: string) =>
      request<{ items: ShopItem[]; gold: number }>(`/api/run/${runId}/shop/items`),

    getAllSkills: (runId: string) =>
      request<SkillInfo[]>(`/api/run/${runId}/skills`),
  },

  codex: {
    getTraits: () => request<PermanentTrait[]>("/api/codex/traits"),
    getRuns: () => request<RunRecord[]>("/api/codex/runs"),
    getRunDetail: (runId: string) =>
      request<unknown>(`/api/codex/runs/${runId}`),
  },
};

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

export interface OwnerCandidate {
  ownerId: string;
  class: string;
  rarity: string;
  element: string;
  combatStats: {
    hp: number;
    hpMax: number;
    pow: number;
    guard: number;
    agi: number;
    focus: number;
  };
  personalityStats: {
    det: number;
    greed: number;
    bold: number;
    caut: number;
    mercy: number;
  };
  compatibilityScore: number;
  compatBreakdown: Record<string, number>;
  aiText: {
    name: string;
    oneLiner: string;
    speechStyle?: { tone: string; quirk: string };
    combatBarks?: { start: string; lowHp: string; victory: string };
  };
  hint?: string;
}

export interface RoomData {
  id: string;
  floor: number;
  position: number;
  roomType: string;
  status: string;
  enemyId?: string;
}

export interface RoomEnterResult {
  roomType: string;
  enemyState?: EnemyState;
  swordState?: SwordState;
  ownerState?: OwnerState;
  eventData?: { id: string; choices: number };
}

export interface EnemyState {
  id: string;
  name: string;
  element: string;
  hp: number;
  hpMax: number;
  atk: number;
  def: number;
  spd: number;
  patterns: unknown[];
  statusEffects: unknown[];
}

export interface SwordState {
  id?: string;
  atk: number;
  def: number;
  spd: number;
  sync: number;
  syncMax: number;
  stb: number;
  dom: number;
  gold: number;
  element: string;
  isOverdriven: boolean;
  isMagicSword: boolean;
  activeSkillIds: string[];
  statusEffects?: unknown[];
}

export interface OwnerState {
  id?: string;
  class: string;
  name: string;
  hp: number;
  hpMax: number;
  compatibilityScore: number;
  statusEffects?: unknown[];
}

export interface TurnInput {
  skillId: string;
  magicSwordAction?: "force" | "retry";
  forceActionType?: "attack" | "defend" | "skill";
}

export interface TurnResult {
  result: { logs: TurnLog[] };
  swordState: SwordState;
  ownerState: OwnerState;
  enemyState: EnemyState;
  battleEnd?: { won: boolean; ownerDied?: boolean; rewards?: unknown[] };
}

export interface TurnLog {
  actorType: string;
  actionType: string;
  skillId?: string;
  damageDealt?: number;
  healAmount?: number;
  text?: string;
  turnNumber?: number;
}

export interface RunEndResult {
  narration: string;
  traitCandidates: TraitCandidate[];
  candidateCount: number;
}

export interface TraitCandidate {
  candidateId: string;
  traitId: string;
  aiLabel?: string;
  aiName?: string;
  effectJson?: Record<string, number>;
  category?: string;
}

export interface PermanentTrait {
  id?: string;
  traitId: string;
  stacks: number;
  category: string;
}

export interface RunRecord {
  id: string;
  status: string;
  floorDepth: number;
  killedBy?: string;
  ownerClass?: string;
  ownerName?: string;
  swordElement?: string;
  startedAt: string;
}

export interface SkillInfo {
  id: string;
  element: string;
  tags: string[];
  effectJson: JSONValue;
  aiName: string | null;
  aiDesc: string | null;
  type: string;
  category: string;
  cost: number;
  riskJson: JSONValue | null;
  aiVfxKeywords: string[];
  aiQuote: string | null;
}

export interface ShopItem {
  id: string;
  tags: string[];
  effectJson: JSONValue;
  rarity: string;
  shopPrice: number;
  aiName: string | null;
  aiDesc: string | null;
}
