"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api, SkillInfo, DroppedItem, type TurnLog } from "@/lib/api";
import { useRunStore } from "@/store/runStore";
import { ELEMENT_COLOR, ELEMENT_LABEL } from "@/lib/element";

// ── 타입 ──────────────────────────────────────────────────────────

type CombatPhase = "idle" | "sword-attacking" | "enemy-attacking" | "resolving";

// ── 흡수 diff 타입 ────────────────────────────────────────────────

interface StatDiff {
  label: string;
  before: number;
  after: number;
  delta: number;
}

interface AbsorbDiff {
  itemName: string;
  stats: StatDiff[];
  newTags: string[];
  elementChanged: { from: string; to: string } | null;
  newSkills: string[];
  skillUpgrades: Array<{ from: string; to: string }>;
  modeGained: "magicSword" | "overdriven" | null;
  triggerFired: boolean;
  beforeImage: string | null;
  afterImage: string | null;
}

import type { SwordState, AbsorbResult } from "@/lib/api";

function computeAbsorbDiff(
  itemName: string,
  prev: SwordState,
  next: SwordState,
  result: AbsorbResult,
): AbsorbDiff {
  const statFields: { key: keyof SwordState; label: string }[] = [
    { key: "atk", label: "ATK" },
    { key: "def", label: "DEF" },
    { key: "spd", label: "SPD" },
    { key: "syncMax", label: "SYNC최대" },
    { key: "stb", label: "STB" },
    { key: "dom", label: "DOM" },
  ];

  const stats = statFields
    .map(({ key, label }) => ({
      label,
      before: (prev[key] as number) ?? 0,
      after: (next[key] as number) ?? 0,
      delta: ((next[key] as number) ?? 0) - ((prev[key] as number) ?? 0),
    }))
    .filter((s) => s.delta !== 0);

  const prevTags = prev.tags ?? [];
  const nextTags = next.tags ?? [];
  const newTags = nextTags.slice(prevTags.length);

  const elementChanged =
    prev.element !== next.element
      ? { from: prev.element, to: next.element }
      : null;

  const prevSkillSet = new Set(prev.activeSkillIds);
  const newSkills = (next.activeSkillIds ?? []).filter(
    (id) => !prevSkillSet.has(id),
  );

  const modeGained =
    !prev.isMagicSword && next.isMagicSword
      ? "magicSword"
      : !prev.isOverdriven && next.isOverdriven
        ? "overdriven"
        : null;

  return {
    itemName,
    stats,
    newTags,
    elementChanged,
    newSkills,
    skillUpgrades: result.skillUpgrades ?? [],
    modeGained,
    triggerFired: (result.triggerEvents?.length ?? 0) > 0,
    beforeImage: prev.swordImageBase64 ?? null,
    afterImage: next.swordImageBase64 ?? null,
  };
}

// TAG 한국어 라벨
const TAG_LABEL: Record<string, string> = {
  fire: "🔥 화염", ice: "❄️ 빙결", thunder: "⚡ 번개", dark: "🌑 어둠",
  light: "✨ 빛", wind: "💨 바람", poison: "☠️ 독", soul: "👻 영혼",
  combat: "⚔️ 전투", curse: "🩸 저주",
};

interface StatusEffect {
  type: string;
  stacks?: number;
  duration?: number;
}

// ── 상수 ──────────────────────────────────────────────────────────

const ACTOR_STYLE = {
  sword: { label: "에고소드", color: "text-cyan-400", bg: "bg-cyan-500/15" },
  owner: { label: "주인", color: "text-emerald-400", bg: "bg-emerald-500/15" },
  enemy: { label: "적", color: "text-red-400", bg: "bg-red-500/15" },
} as const;

const STATUS_VISUAL: Record<
  string,
  { label: string; color: string; bg: string; glow: string }
> = {
  burn: {
    label: "화상",
    color: "text-orange-400",
    bg: "bg-orange-500/20",
    glow: "rgba(249,115,22,0.22)",
  },
  frozen: {
    label: "빙결",
    color: "text-sky-400",
    bg: "bg-sky-500/20",
    glow: "rgba(14,165,233,0.22)",
  },
  slow: {
    label: "둔화",
    color: "text-cyan-400",
    bg: "bg-cyan-500/20",
    glow: "rgba(34,211,238,0.22)",
  },
  poison: {
    label: "독",
    color: "text-green-400",
    bg: "bg-green-500/20",
    glow: "rgba(34,197,94,0.22)",
  },
  stun: {
    label: "기절",
    color: "text-yellow-400",
    bg: "bg-yellow-500/20",
    glow: "rgba(234,179,8,0.22)",
  },
  blind: {
    label: "실명",
    color: "text-slate-400",
    bg: "bg-slate-500/20",
    glow: "rgba(100,116,139,0.22)",
  },
  curse: {
    label: "저주",
    color: "text-violet-400",
    bg: "bg-violet-500/20",
    glow: "rgba(139,92,246,0.22)",
  },
  bleed: {
    label: "출혈",
    color: "text-rose-400",
    bg: "bg-rose-500/20",
    glow: "rgba(244,63,94,0.22)",
  },
};

// ── 헬퍼 ──────────────────────────────────────────────────────────

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// ── 서브 컴포넌트 ─────────────────────────────────────────────────

/** 컴팩트 수치 칩 */
function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0">
      <span className="text-[8px] text-white/25 uppercase leading-none tracking-wide">
        {label}
      </span>
      <span className="text-[10px] font-bold leading-tight tabular-nums">
        {value}
      </span>
    </div>
  );
}

/** 부드럽게 애니메이션되는 HP 바 */
function AnimatedHpBar({
  value,
  max,
  accentClass = "bg-red-500",
  className = "",
}: {
  value: number;
  max: number;
  accentClass?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const colorClass =
    pct > 50 ? accentClass : pct > 25 ? "bg-yellow-500" : "bg-red-600";

  return (
    <div
      className={`relative rounded-full bg-white/10 overflow-hidden ${className}`}
    >
      <motion.div
        className={`absolute inset-y-0 left-0 rounded-full ${colorClass}`}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
    </div>
  );
}

/** 팝인 상태이상 배지 */
function StatusEffectBadge({ effect }: { effect: StatusEffect }) {
  const visual = STATUS_VISUAL[effect.type];
  if (!visual) return null;
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
    >
      <Badge
        className={`text-[8px] px-1.5 py-0 h-4 border-0 gap-0.5 ${visual.color} ${visual.bg}`}
      >
        {visual.label}
        {effect.duration !== undefined && (
          <span className="opacity-50 ml-0.5">{effect.duration}</span>
        )}
      </Badge>
    </motion.div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────

export default function BattlePage() {
  const router = useRouter();
  const {
    runId,
    currentRoom,
    swordState,
    ownerState,
    enemyState,
    setSwordState,
    setOwnerState,
    setEnemyState,
    addBattleLog,
    clearBattleLog,
    battleLog,
  } = useRunStore();

  const [pendingSkill, setPendingSkill] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showMagicSheet, setShowMagicSheet] = useState(false);
  const [magicAction, setMagicAction] = useState<"force" | "retry" | null>(
    null,
  );
  const [damageNumbers, setDamageNumbers] = useState<
    { id: number; value: number }[]
  >([]);
  const [activeSkills, setActiveSkills] = useState<SkillInfo[]>([]);
  const [combatPhase, setCombatPhase] = useState<CombatPhase>("idle");

  // 전투 보상 모달 상태
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardItems, setRewardItems] = useState<DroppedItem[]>([]);
  const [pendingSkillSwapId, setPendingSkillSwapId] = useState<string | null>(null);
  const [absorbingId, setAbsorbingId] = useState<string | null>(null);
  const [itemDiffs, setItemDiffs] = useState<Record<string, AbsorbDiff>>({});

  const turnCounterRef = useRef(1);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Framer Motion 애니메이션 컨트롤
  const enemyControls = useAnimation();
  const ownerControls = useAnimation();
  const swordControls = useAnimation();

  // ── 턴 그룹화 ──────────────────────────────────────────────────
  const turnGroups = useMemo(() => {
    const groups = new Map<number, TurnLog[]>();
    battleLog.forEach((log) => {
      const turn = log.turnNumber ?? 0;
      if (!groups.has(turn)) groups.set(turn, []);
      groups.get(turn)!.push(log);
    });
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [battleLog]);

  const recentTurnGroups = useMemo(() => turnGroups.slice(-3), [turnGroups]);

  // ── 자동 스크롤 ──────────────────────────────────────────────
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [battleLog]);

  // ── 마운트 ────────────────────────────────────────────────────
  useEffect(() => {
    if (!runId || !currentRoom) {
      router.replace("/run/map");
      return;
    }
    clearBattleLog();
    turnCounterRef.current = 1;
    api.run.getAllSkills(runId).then((skills) => setActiveSkills(skills));
  }, [runId, currentRoom, router]);

  // ── 턴 처리 뮤테이션 ─────────────────────────────────────────
  // 타이밍 시퀀스:
  //  0ms   검(또는 주인) 공격 → 적 카드 shake + flash
  //  480ms 적 HP 바 드롭
  //  560ms 데미지 팝업 유지 → 적 반격(있으면) 주인 카드 shake
  //  960ms 주인 HP 바 드롭
  // 1160ms 전체 상태 업데이트 완료
  const turnMutation = useMutation({
    mutationFn: (skillId: string) => {
      if (!currentRoom) throw new Error("No room");
      return api.run.processTurn(runId!, currentRoom.id, {
        skillId,
        magicSwordAction: magicAction ?? undefined,
      });
    },
    onSuccess: async (result) => {
      console.log("Turn result:", result); // 디버깅용 로그
      const logs = result.result.logs;

      const swordDmgLog = logs.find(
        (l) => l.actorType !== "enemy" && (l.damageDealt ?? 0) > 0,
      );
      const enemyDmgLog = logs.find(
        (l) => l.actorType === "enemy" && (l.damageDealt ?? 0) > 0,
      );

      // ── Phase 1: 검 / 주인 공격 ────────────────────────────
      if (swordDmgLog) {
        setCombatPhase("sword-attacking");

        // 데미지 팝업 등장
        if (swordDmgLog.damageDealt) {
          const id = Date.now();
          setDamageNumbers((prev) => [
            ...prev,
            { id, value: swordDmgLog.damageDealt! },
          ]);
          setTimeout(
            () => setDamageNumbers((prev) => prev.filter((d) => d.id !== id)),
            1400,
          );
        }

        // 적 카드 흔들기 + 밝기 플래시 (await → 완료까지 대기)
        await enemyControls.start({
          x: [0, -12, 12, -9, 9, -5, 5, 0],
          filter: [
            "brightness(1)",
            "brightness(3)",
            "brightness(1.5)",
            "brightness(1)",
          ],
          transition: { duration: 0.46, ease: "easeInOut" },
        });

        // 흔들림 직후 HP 바 감소
        await delay(60);
        setEnemyState(result.enemyState);
        await delay(380);
      }

      // ── Phase 2: 적 반격 ───────────────────────────────────
      if (enemyDmgLog) {
        setCombatPhase("enemy-attacking");

        // 주인 카드 흔들기
        await ownerControls.start({
          x: [0, -9, 9, -6, 6, -3, 3, 0],
          transition: { duration: 0.42, ease: "easeInOut" },
        });
        setOwnerState(result.ownerState);

        // STB 위험 → 검 카드 빨간 글로우
        if (result.swordState.stb <= 4) {
          void swordControls.start({
            boxShadow: [
              "0 0 0px rgba(239,68,68,0)",
              "0 0 22px rgba(239,68,68,0.6)",
              "0 0 0px rgba(239,68,68,0)",
            ],
            transition: { duration: 0.75 },
          });
        }

        await delay(380);
      }

      // ── Phase 3: 나머지 상태 업데이트 ─────────────────────
      setCombatPhase("resolving");

      // 공격이 없었던 액터 상태 즉시 업데이트
      if (!swordDmgLog) setEnemyState(result.enemyState);
      if (!enemyDmgLog) setOwnerState(result.ownerState);
      setSwordState(result.swordState);

      const tagged = logs.map((l) => ({
        ...l,
        turnNumber: turnCounterRef.current,
      }));
      addBattleLog(tagged);
      turnCounterRef.current++;
      setMagicAction(null);

      await delay(200);
      setCombatPhase("idle");

      // 전투 종료
      if (result.battleEnd) {
        if (result.battleEnd.won) {
          const drops = result.battleEnd.droppedItems ?? [];
          setTimeout(() => {
            if (drops.length > 0) {
              setRewardItems(drops);
              setShowRewardModal(true);
            } else {
              router.push("/run/map");
            }
          }, 900);
        } else {
          setTimeout(() => router.push("/run/end"), 900);
        }
      }
    },
  });

  // ── 스킬 클릭 ────────────────────────────────────────────────
  const handleSkillClick = (skillId: string) => {
    if (!swordState || combatPhase !== "idle") return;
    const skill = activeSkills.find((s) => s.id === skillId);
    if (!skill || swordState.sync < skill.cost) return;
    setPendingSkill(skillId);
    setShowConfirm(true);
  };

  const confirmSkill = () => {
    if (!pendingSkill) return;
    setShowConfirm(false);
    if (swordState?.isMagicSword && !magicAction) {
      setShowMagicSheet(true);
      return;
    }
    turnMutation.mutate(pendingSkill);
    setPendingSkill(null);
  };

  const executeWithMagic = (action: "force" | "retry" | null) => {
    setMagicAction(action);
    setShowMagicSheet(false);
    if (pendingSkill) {
      turnMutation.mutate(pendingSkill);
      setPendingSkill(null);
    }
  };

  // ── 로딩 가드 ─────────────────────────────────────────────────
  if (!swordState || !ownerState || !enemyState) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-slate-950">
        <Skeleton className="w-full h-96 m-4 rounded-2xl" />
      </div>
    );
  }

  // ── 파생 값 ─────────────────────────────────────────────────
  const enemyElemColor = ELEMENT_COLOR[enemyState.element] ?? "#94A3B8";
  const ownerHpPct = ownerState.hp / ownerState.hpMax;
  const syncPct = swordState.sync / swordState.syncMax;
  const isOverdriven = swordState.isOverdriven;
  const isMagicSword = swordState.isMagicSword;
  const isLowStb = swordState.stb <= 4;
  const isPlayerTurn = combatPhase === "idle";

  const pendingSkillInfo = pendingSkill
    ? activeSkills.find((s) => s.id === pendingSkill)
    : null;

  // 상태이상 처리 (적)
  const enemyStatusEffects = (enemyState.statusEffects ?? []) as StatusEffect[];
  const dominantStatus = enemyStatusEffects[0];
  const statusGlow = dominantStatus
    ? (STATUS_VISUAL[dominantStatus.type]?.glow ?? null)
    : null;

  // 모드별 accent
  const swordBorder = isOverdriven
    ? "border-red-500/50"
    : isMagicSword
      ? "border-purple-500/40"
      : "border-cyan-500/20";

  const skillBarBorder = isOverdriven
    ? "border-red-500/30"
    : isMagicSword
      ? "border-purple-500/20"
      : "border-white/8";

  // 전투 페이즈 레이블
  const phaseLabel: Record<CombatPhase, string | null> = {
    idle: null,
    "sword-attacking": "공격 중...",
    "enemy-attacking": "적이 반격 중...",
    resolving: "처리 중...",
  };

  // ── 렌더 ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-slate-950 text-white">
      {/* ═══════════════════════════════════════════════════════
          ENEMY ZONE
      ═══════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="shrink-0 px-4 pt-4 pb-2"
      >
        <motion.div
          animate={enemyControls}
          className="relative rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
          style={{
            borderTopColor: enemyElemColor,
            borderTopWidth: 2,
            // 상태이상 인셋 글로우
            boxShadow: statusGlow ? `inset 0 0 32px ${statusGlow}` : undefined,
          }}
        >
          {/* 원소 배경 글로우 */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.07]"
            style={{
              background: `radial-gradient(ellipse at 50% -20%, ${enemyElemColor}, transparent 65%)`,
            }}
          />

          <div className="relative p-4">
            {/* 이름 + HP 수치 */}
            <div className="flex items-start justify-between mb-2.5">
              <div className="flex-1 min-w-0 mr-3">
                <h2 className="text-base font-bold tracking-tight leading-tight truncate">
                  {enemyState.name}
                </h2>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Badge
                    className="text-[10px] shrink-0"
                    style={{
                      backgroundColor: enemyElemColor + "22",
                      color: enemyElemColor,
                      border: `1px solid ${enemyElemColor}44`,
                    }}
                  >
                    {ELEMENT_LABEL[enemyState.element]}
                  </Badge>
                  {/* 상태이상 배지 */}
                  <AnimatePresence>
                    {enemyStatusEffects.slice(0, 4).map((eff, i) => (
                      <StatusEffectBadge
                        key={`${eff.type}-${i}`}
                        effect={eff}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* HP 수치 — 변할 때 스케일 펄스 */}
              <div className="text-right shrink-0">
                <motion.span
                  key={enemyState.hp}
                  initial={{ scale: 1.25, color: "#FCA5A5" }}
                  animate={{ scale: 1, color: enemyElemColor }}
                  transition={{ duration: 0.32 }}
                  className="text-2xl font-black tabular-nums block"
                >
                  {enemyState.hp}
                </motion.span>
                <span className="text-[10px] text-white/25">
                  / {enemyState.hpMax}
                </span>
              </div>
            </div>

            {/* HP 바 + 데미지 팝업 */}
            <div className="relative mb-2.5">
              <AnimatedHpBar
                value={enemyState.hp}
                max={enemyState.hpMax}
                accentClass="bg-red-500"
                className="h-2.5"
              />
              <AnimatePresence>
                {damageNumbers.map((d) => (
                  <motion.span
                    key={d.id}
                    initial={{ opacity: 1, y: 0, scale: 0.85 }}
                    animate={{ opacity: 0, y: -60, scale: 1.55 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute right-0 -top-10 font-black text-2xl pointer-events-none select-none text-red-300 drop-shadow-lg"
                    style={{ textShadow: "0 0 18px rgba(239,68,68,0.95)" }}
                  >
                    -{d.value}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>

            {/* 적 마이크로 스탯 */}
            <div className="flex gap-4">
              <span className="text-[10px] text-white/22">
                ATK{" "}
                <span className="text-white/45 font-medium">
                  {enemyState.atk}
                </span>
              </span>
              <span className="text-[10px] text-white/22">
                DEF{" "}
                <span className="text-white/45 font-medium">
                  {enemyState.def}
                </span>
              </span>
              <span className="text-[10px] text-white/22">
                SPD{" "}
                <span className="text-white/45 font-medium">
                  {enemyState.spd}
                </span>
              </span>
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════
          IMPACT ZONE — 대치 구분선 + 전투 페이즈 표시
      ═══════════════════════════════════════════════════════ */}
      <div className="shrink-0 flex items-center px-6 py-1.5 gap-2">
        <div
          className="flex-1 h-px"
          style={{
            background: `linear-gradient(to right, transparent, ${enemyElemColor}50)`,
          }}
        />
        <AnimatePresence mode="wait">
          {phaseLabel[combatPhase] ? (
            <motion.span
              key={combatPhase}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-[9px] text-white/35 font-medium px-2 whitespace-nowrap"
            >
              {phaseLabel[combatPhase]}
            </motion.span>
          ) : (
            <motion.div
              key="dot"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-1.5 h-1.5 rounded-full bg-white/20"
            />
          )}
        </AnimatePresence>
        <div
          className="flex-1 h-px"
          style={{
            background: `linear-gradient(to left, transparent, ${
              isMagicSword ? "rgba(168,85,247,0.4)" : "rgba(34,211,238,0.28)"
            })`,
          }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════
          STATUS ZONE — 주인 + 에고소드
      ═══════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.07 }}
        className="shrink-0 px-4 pb-2"
      >
        <div className="grid grid-cols-2 gap-2">
          {/* ── 주인 카드 (emerald) ────────────────────────── */}
          <motion.div
            animate={ownerControls}
            className={`rounded-xl bg-white/5 border p-3 ${
              isOverdriven ? "border-red-500/30" : "border-emerald-500/20"
            }`}
          >
            {/* 헤더 */}
            <div className="flex items-start justify-between mb-1.5">
              <div className="min-w-0 flex-1 mr-1">
                <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide truncate">
                  {ownerState.name}
                </p>
                <p className="text-[9px] text-white/28 capitalize">
                  {ownerState.class}
                </p>
              </div>
              <div className="text-right shrink-0">
                <motion.span
                  key={ownerState.hp}
                  initial={{ color: "#FCA5A5" }}
                  animate={{ color: "#ffffff" }}
                  transition={{ duration: 0.35 }}
                  className="text-sm font-bold tabular-nums"
                >
                  {ownerState.hp}
                </motion.span>
                <span className="text-[9px] text-white/25">
                  /{ownerState.hpMax}
                </span>
              </div>
            </div>

            {/* HP 바 */}
            <AnimatedHpBar
              value={ownerState.hp}
              max={ownerState.hpMax}
              accentClass="bg-emerald-500"
              className="h-1.5 mb-2"
            />

            {/* 확장 스탯: POW / GRD / AGI / FOC */}
            <div className="flex justify-between px-0.5 mb-1.5">
              <StatChip label="POW" value={ownerState.pow} />
              <StatChip label="GRD" value={ownerState.guard} />
              <StatChip label="AGI" value={ownerState.agi} />
              <StatChip label="FOC" value={ownerState.focus} />
            </div>

            {/* 조화 점수 */}
            <div className="flex items-center gap-1">
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    ownerHpPct > 0.5
                      ? "#22C55E"
                      : ownerHpPct > 0.25
                        ? "#EAB308"
                        : "#EF4444",
                }}
              />
              <span className="text-[9px] text-white/25">
                조화 {ownerState.compatibilityScore}
              </span>
            </div>
          </motion.div>

          {/* ── 에고소드 카드 (cyan / purple / red) ──────────── */}
          <motion.div
            animate={swordControls}
            className={`rounded-xl bg-white/5 border p-3 transition-colors duration-300 ${swordBorder} ${
              isOverdriven ? "animate-pulse" : ""
            }`}
          >
            <p
              className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${
                isMagicSword
                  ? "text-purple-400"
                  : isOverdriven
                    ? "text-red-400"
                    : "text-cyan-400"
              }`}
            >
              에고소드
            </p>

            {/* 픽셀아트 검 이미지 */}
            {swordState.swordImageBase64 && (
              <div className="flex justify-center mb-2">
                <img
                  src={swordState.swordImageBase64}
                  alt="sword"
                  width={48}
                  height={48}
                  style={{ imageRendering: 'pixelated' }}
                  className="rounded opacity-90"
                />
              </div>
            )}

            {/* SYNC 바 */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[9px] text-white/25 shrink-0">SYNC</span>
              <div className="flex-1 relative h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className={`absolute inset-y-0 left-0 rounded-full ${
                    isMagicSword ? "bg-purple-500" : "bg-cyan-500"
                  }`}
                  animate={{ width: `${syncPct * 100}%` }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                />
              </div>
              <span
                className={`text-[10px] font-bold shrink-0 tabular-nums ${
                  isMagicSword ? "text-purple-400" : "text-cyan-400"
                }`}
              >
                {swordState.sync}/{swordState.syncMax}
              </span>
            </div>

            {/* 검 스탯: ATK / DEF / SPD */}
            <div className="flex justify-between px-0.5 mb-1.5">
              <StatChip label="ATK" value={swordState.atk} />
              <StatChip label="DEF" value={swordState.def} />
              <StatChip label="SPD" value={swordState.spd} />
            </div>

            {/* 상태 배지 */}
            <div className="flex flex-wrap gap-1">
              <Badge
                variant="outline"
                className={`text-[9px] px-1.5 py-0 h-4 border ${
                  isLowStb
                    ? "text-red-400 border-red-500/40"
                    : "text-slate-300 border-white/15"
                }`}
              >
                STB {swordState.stb}
              </Badge>
              {swordState.dom > 0 && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 h-4 border-purple-500/40 text-purple-400"
                >
                  DOM {swordState.dom}
                </Badge>
              )}
              {isOverdriven && (
                <Badge className="text-[9px] px-1.5 py-0 h-4 bg-red-500/20 text-red-300 border-red-500/30">
                  폭주
                </Badge>
              )}
              {isMagicSword && (
                <Badge className="text-[9px] px-1.5 py-0 h-4 bg-purple-500/20 text-purple-300 border-purple-500/30">
                  마검
                </Badge>
              )}
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════
          BATTLE LOG — 최근 3턴, 컴팩트
      ═══════════════════════════════════════════════════════ */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 pb-1 space-y-1.5"
        style={{ scrollbarWidth: "none" }}
      >
        {recentTurnGroups.length === 0 && (
          <p className="text-[10px] text-white/18 text-center pt-3">
            전투를 시작하라...
          </p>
        )}
        {recentTurnGroups.map(([turnNum, logs], groupIndex) => {
          const isLastGroup = groupIndex === recentTurnGroups.length - 1;
          return (
            <motion.div
              key={turnNum}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Turn 구분선 */}
              <div className="flex items-center gap-2 mb-0.5">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-[9px] text-white/20 font-medium">
                  Turn {turnNum}
                </span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              {/* 로그 카드 */}
              <div
                className={`rounded-xl px-2.5 py-1.5 space-y-0.5 ${
                  isLastGroup
                    ? "bg-white/6 border border-white/8"
                    : "bg-white/3"
                }`}
              >
                {logs.map((log, logIndex) => {
                  const isLatest = isLastGroup && logIndex === logs.length - 1;
                  const actorKey =
                    log.actorType in ACTOR_STYLE
                      ? (log.actorType as keyof typeof ACTOR_STYLE)
                      : "enemy";
                  const style = ACTOR_STYLE[actorKey];
                  const hasDamage = (log.damageDealt ?? 0) > 0;
                  const hasHeal = (log.healAmount ?? 0) > 0;

                  return (
                    <motion.div
                      key={logIndex}
                      initial={{ opacity: 0, x: -3 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: logIndex * 0.03 }}
                      className={`flex items-start gap-1.5 py-0.5 px-1 rounded ${
                        isLatest ? "bg-white/6" : ""
                      }`}
                    >
                      <span
                        className={`shrink-0 font-bold text-[8px] px-1 py-0.5 rounded mt-0.5 ${style.color} ${style.bg}`}
                      >
                        {style.label}
                      </span>
                      <div className="flex-1 text-[10px] text-white/55 leading-relaxed">
                        {log.text ? (
                          <span>{log.text}</span>
                        ) : hasDamage ? (
                          <span className="flex flex-col gap-0.5">
                            {log.mutatedName && (
                              <motion.span
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-[9px] text-violet-300/80 font-semibold tracking-wide"
                              >
                                ✦ {log.mutatedName}
                              </motion.span>
                            )}
                            <motion.span
                              initial={{ scale: 0.7 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 300 }}
                              className={`font-bold text-xs ${
                                actorKey === "enemy"
                                  ? "text-red-400"
                                  : "text-cyan-300"
                              }`}
                            >
                              {log.damageDealt} 피해
                            </motion.span>
                          </span>
                        ) : hasHeal ? (
                          <motion.span
                            initial={{ scale: 0.7 }}
                            animate={{ scale: 1 }}
                            className="font-bold text-xs text-emerald-400"
                          >
                            +{log.healAmount} 회복
                          </motion.span>
                        ) : (
                          <span className="text-white/25">
                            {log.actionType}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
        <div ref={logEndRef} />
      </div>

      {/* ═══════════════════════════════════════════════════════
          SKILL BAR — 하단 고정
      ═══════════════════════════════════════════════════════ */}
      <div
        className={`shrink-0 px-4 pt-2 pb-4 border-t ${skillBarBorder} ${
          isOverdriven
            ? "bg-red-950/20"
            : isMagicSword
              ? "bg-purple-950/20"
              : ""
        }`}
      >
        <div className="grid grid-cols-2 gap-2">
          {activeSkills.map((skill, i) => {
            const canUse = swordState.sync >= skill.cost && isPlayerTurn;
            const elemColor = ELEMENT_COLOR[skill.element] ?? "#94A3B8";

            return (
              <motion.button
                key={skill.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileTap={{ scale: canUse ? 0.94 : 1 }}
                className={`w-full p-3 flex flex-col items-start gap-0.5 rounded-xl border bg-white/5 text-left transition-colors duration-150 ${
                  !canUse
                    ? "opacity-30 cursor-not-allowed border-white/10"
                    : "border-white/10"
                }`}
                style={
                  canUse
                    ? {
                        borderColor: elemColor + "55",
                        boxShadow: `inset 0 0 0 1px ${elemColor}12`,
                      }
                    : undefined
                }
                disabled={!canUse}
                onClick={() => handleSkillClick(skill.id)}
              >
                <div className="flex items-center justify-between w-full gap-1">
                  <span className="text-xs font-semibold leading-tight line-clamp-1">
                    {skill.aiName ?? skill.id}
                  </span>
                  <span
                    className="text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded tabular-nums"
                    style={{
                      backgroundColor: elemColor + "22",
                      color: elemColor,
                    }}
                  >
                    {skill.cost}
                  </span>
                </div>
                <span className="text-[10px] text-white/30 leading-tight line-clamp-1">
                  {skill.aiDesc ?? ""}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          스킬 확인 다이얼로그
      ═══════════════════════════════════════════════════════ */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-xs rounded-2xl border-white/15 bg-[#0F1219]">
          <DialogHeader>
            <DialogTitle className="text-base">스킬 사용</DialogTitle>
          </DialogHeader>
          {pendingSkillInfo && (
            <div className="py-2">
              <p className="font-semibold">{pendingSkillInfo.aiName}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {pendingSkillInfo.aiDesc}
              </p>
              <div className="flex gap-2 mt-2">
                <Badge
                  className="text-[10px]"
                  style={{
                    backgroundColor:
                      (ELEMENT_COLOR[pendingSkillInfo.element] ?? "#94A3B8") +
                      "22",
                    color: ELEMENT_COLOR[pendingSkillInfo.element] ?? "#94A3B8",
                    border: `1px solid ${
                      ELEMENT_COLOR[pendingSkillInfo.element] ?? "#94A3B8"
                    }44`,
                  }}
                >
                  {ELEMENT_LABEL[pendingSkillInfo.element] ??
                    pendingSkillInfo.element}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] border-white/20 text-white/60"
                >
                  SYNC {pendingSkillInfo.cost}
                </Badge>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowConfirm(false)}>
              취소
            </Button>
            <Button
              onClick={confirmSkill}
              className="bg-white text-black hover:bg-white/90"
            >
              사용
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          전투 보상 모달
      ═══════════════════════════════════════════════════════ */}
      <Dialog open={showRewardModal} onOpenChange={() => {}}>
        <DialogContent className="max-w-xs rounded-2xl border-white/15 bg-[#0F1219]">
          <DialogHeader>
            <DialogTitle className="text-base text-amber-300">
              전투 승리 — 전리품
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            {rewardItems.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-4">
                드롭 아이템 없음
              </p>
            ) : (
              rewardItems.map((item) => {
                const diff = itemDiffs[item.id];
                const rarityColor =
                  item.rarity === "epic"
                    ? "text-purple-300 border-purple-500/40"
                    : item.rarity === "rare"
                      ? "text-blue-300 border-blue-500/40"
                      : "text-slate-300 border-white/20";

                // 흡수 완료 → diff 카드 표시
                if (diff) {
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="rounded-xl border border-emerald-500/30 bg-emerald-900/10 p-3"
                    >
                      {/* 헤더 */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-emerald-400 text-sm">✓</span>
                        <span className="text-xs font-semibold text-emerald-300">
                          {diff.itemName} 흡수됨
                        </span>
                      </div>

                      {/* 이미지 before → after */}
                      {(diff.beforeImage || diff.afterImage) && (
                        <div className="flex items-center gap-3 mb-2">
                          {diff.beforeImage ? (
                            <img
                              src={diff.beforeImage}
                              alt="before"
                              width={56}
                              height={56}
                              className="rounded opacity-40 grayscale"
                              style={{ imageRendering: "pixelated" }}
                            />
                          ) : (
                            <div className="w-14 h-14 rounded bg-white/5 border border-white/10" />
                          )}
                          <span className="text-white/30 text-lg">→</span>
                          {diff.afterImage ? (
                            <motion.img
                              src={diff.afterImage}
                              alt="after"
                              width={56}
                              height={56}
                              initial={{ scale: 0.7, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              className="rounded"
                              style={{ imageRendering: "pixelated" }}
                            />
                          ) : (
                            <div className="w-14 h-14 rounded bg-white/5 border border-white/10" />
                          )}
                        </div>
                      )}

                      {/* 스탯 변화 */}
                      {diff.stats.length > 0 && (
                        <div className="space-y-0.5 mb-1.5">
                          {diff.stats.map((s, i) => (
                            <motion.div
                              key={s.label}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.06 }}
                              className="flex items-center gap-1.5 text-[11px]"
                            >
                              <span className="text-white/40 w-12">{s.label}</span>
                              <span className="text-white/50">{s.before}</span>
                              <span className="text-white/30 text-[9px]">→</span>
                              <span className="text-white/80 font-medium">{s.after}</span>
                              <span className={`ml-auto font-bold ${s.delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {s.delta > 0 ? `+${s.delta}` : s.delta} {s.delta > 0 ? "▲" : "▼"}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {/* 태그 추가 */}
                      {diff.newTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {diff.newTags.map((t, i) => (
                            <motion.span
                              key={i}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.1 + i * 0.05 }}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60"
                            >
                              {TAG_LABEL[t] ?? t} 추가
                            </motion.span>
                          ))}
                        </div>
                      )}

                      {/* 원소 변화 */}
                      {diff.elementChanged && (
                        <div className="text-[10px] text-white/50 mb-1">
                          <span style={{ color: ELEMENT_COLOR[diff.elementChanged.from] ?? "#94A3B8" }}>
                            {diff.elementChanged.from}
                          </span>
                          {" → "}
                          <span style={{ color: ELEMENT_COLOR[diff.elementChanged.to] ?? "#94A3B8" }}>
                            {diff.elementChanged.to}
                          </span>
                          {" "}원소로 변화
                        </div>
                      )}

                      {/* 새 스킬 */}
                      {diff.newSkills.length > 0 && (
                        <div className="text-[10px] text-cyan-400/80 mb-1">
                          📖 새 스킬 획득
                        </div>
                      )}

                      {/* 스킬 업그레이드 */}
                      {diff.skillUpgrades.length > 0 && (
                        <div className="text-[10px] text-yellow-400/80 mb-1">
                          ⚡ 스킬 강화!
                        </div>
                      )}

                      {/* 트리거 발동 */}
                      {diff.triggerFired && (
                        <div className="text-[10px] text-amber-400/80 mb-1">
                          ✦ 특성 트리거 발동!
                        </div>
                      )}

                      {/* 모드 변화 배너 */}
                      {diff.modeGained === "magicSword" && (
                        <motion.div
                          initial={{ scale: 0.85, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 260, damping: 16 }}
                          className="mt-1.5 rounded-lg border border-purple-500/50 bg-purple-900/40 px-2.5 py-1.5 text-center"
                        >
                          <span className="text-xs font-bold text-purple-300">
                            ⚔ 마검 각성!
                          </span>
                        </motion.div>
                      )}
                      {diff.modeGained === "overdriven" && (
                        <motion.div
                          initial={{ scale: 0.85, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 260, damping: 16 }}
                          className="mt-1.5 rounded-lg border border-red-500/50 bg-red-900/40 px-2.5 py-1.5 text-center"
                        >
                          <span className="text-xs font-bold text-red-300">
                            💢 폭주 돌입!
                          </span>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                }

                // 기본 아이템 카드 (흡수 전)
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 bg-white/4 ${rarityColor}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight">
                          {item.aiName ?? item.id}
                        </p>
                        <p className="text-[10px] text-white/35 mt-0.5 leading-tight line-clamp-2">
                          {item.aiDesc ?? ""}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[9px] px-1.5 py-0 h-4 ${rarityColor}`}
                      >
                        {item.rarity}
                      </Badge>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <Button
                        size="sm"
                        disabled={absorbingId === item.id}
                        className="flex-1 h-7 text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30"
                        onClick={async () => {
                          if (!runId) return;
                          setAbsorbingId(item.id);
                          const prevState = swordState;
                          try {
                            const res = await api.run.absorbBattleDrop(runId, item.id);
                            setSwordState(res.swordState);
                            if (res.pendingSkillSwap) {
                              setPendingSkillSwapId(res.pendingSkillSwap);
                            }
                            if (prevState) {
                              const diff = computeAbsorbDiff(
                                item.aiName ?? item.id,
                                prevState,
                                res.swordState,
                                res,
                              );
                              setItemDiffs((prev) => ({ ...prev, [item.id]: diff }));
                            }
                            // 2.5초 후 자동 제거
                            setTimeout(() => {
                              setRewardItems((prev) => prev.filter((i) => i.id !== item.id));
                              setItemDiffs((prev) => {
                                const n = { ...prev };
                                delete n[item.id];
                                return n;
                              });
                            }, 2500);
                          } catch {
                            setRewardItems((prev) => prev.filter((i) => i.id !== item.id));
                          } finally {
                            setAbsorbingId(null);
                          }
                        }}
                      >
                        {absorbingId === item.id ? "..." : "흡수"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 h-7 text-xs text-white/40"
                        onClick={() =>
                          setRewardItems((prev) => prev.filter((i) => i.id !== item.id))
                        }
                      >
                        버리기
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button
              className="w-full bg-white text-black hover:bg-white/90"
              disabled={rewardItems.some((i) => !itemDiffs[i.id])}
              onClick={() => {
                setShowRewardModal(false);
                if (pendingSkillSwapId) {
                  router.push(`/run/skill-swap?skillId=${pendingSkillSwapId}`);
                } else {
                  router.push("/run/map");
                }
              }}
            >
              {rewardItems.some((i) => !itemDiffs[i.id])
                ? `남은 아이템 ${rewardItems.filter((i) => !itemDiffs[i.id]).length}개`
                : "계속"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          마검 행동 선택 시트
      ═══════════════════════════════════════════════════════ */}
      <Sheet open={showMagicSheet} onOpenChange={setShowMagicSheet}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-purple-500/30 bg-[#0F1219]"
        >
          <SheetHeader>
            <SheetTitle className="text-purple-300 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              마검의 힘 — 주인 의지를 조종
            </SheetTitle>
          </SheetHeader>
          <div className="py-4 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              스킬 사용 전에 주인의 행동을 조종할 수 있다. (SYNC -2)
            </p>
            <Button
              variant="outline"
              className="border-purple-400/30 text-purple-300 hover:bg-purple-500/10"
              onClick={() => executeWithMagic("force")}
            >
              강제 선택 — 주인 행동을 내가 고른다
            </Button>
            <Button
              variant="outline"
              className="border-purple-400/30 text-purple-300 hover:bg-purple-500/10"
              onClick={() => executeWithMagic("retry")}
            >
              재시도 — 주인 행동을 다시 굴린다
            </Button>
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => executeWithMagic(null)}
            >
              그냥 스킬만 사용
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
