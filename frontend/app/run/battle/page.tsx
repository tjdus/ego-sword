"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { api, SkillInfo, type EnemyState, type TurnLog } from "@/lib/api";
import { useRunStore } from "@/store/runStore";
import { ELEMENT_COLOR, ELEMENT_LABEL } from "@/lib/element";

// 스킬 정보 (임시 클라이언트 캐시 - 실제로는 서버에서 조회)
const SKILL_INFO: Record<
  string,
  { name: string; desc: string; cost: number; element: string }
> = {
  SK_ICE_PIERCE: {
    name: "서늘한 예기의 찌르기",
    desc: "단일 공격 1.4배 + 둔화 2턴",
    cost: 3,
    element: "ice",
  },
  SK_FIRE_SLASH: {
    name: "불꽃 베기",
    desc: "단일 공격 1.2배 + 화상 2턴",
    cost: 2,
    element: "fire",
  },
  SK_DARK_CUT: {
    name: "어둠의 참격",
    desc: "단일 공격 1.3배, DOM +1",
    cost: 2,
    element: "dark",
  },
  SK_THUNDER_STRIKE: {
    name: "번개 강타",
    desc: "단일 공격 1.5배 + 기절 1턴",
    cost: 3,
    element: "thunder",
  },
  SK_POISON_JAB: {
    name: "독 찌르기",
    desc: "단일 공격 0.9배 + 독 3턴",
    cost: 2,
    element: "poison",
  },
  SK_LIGHT_SMITE: {
    name: "신성한 심판",
    desc: "단일 공격 1.6배",
    cost: 3,
    element: "light",
  },
  SK_FIRE_SWEEP: {
    name: "화염 휩쓸기",
    desc: "광역 0.8배 + 화상",
    cost: 4,
    element: "fire",
  },
  SK_THUNDER_STORM: {
    name: "뇌운 폭풍",
    desc: "광역 1.0배",
    cost: 5,
    element: "thunder",
  },
  SK_WIND_SPIRAL: {
    name: "바람 소용돌이",
    desc: "광역 0.7배 + 둔화",
    cost: 3,
    element: "wind",
  },
  SK_CHAIN_BLADE: {
    name: "연쇄 칼날",
    desc: "공격 0.7배 + 추가 행동",
    cost: 3,
    element: "neutral",
  },
  SK_ICE_SHIELD: {
    name: "얼음 방벽",
    desc: "보호막 15",
    cost: 2,
    element: "ice",
  },
  SK_LIGHT_BARRIER: {
    name: "신성 방벽",
    desc: "보호막 20 + 회복 5",
    cost: 3,
    element: "light",
  },
  SK_STEEL_GUARD: {
    name: "철갑 방어",
    desc: "보호막 8",
    cost: 1,
    element: "neutral",
  },
  SK_FREEZE: {
    name: "빙결",
    desc: "0.5배 + 빙결 1턴",
    cost: 3,
    element: "ice",
  },
  SK_POISON_SLOW: {
    name: "독 안개",
    desc: "독 + 둔화 3턴",
    cost: 2,
    element: "poison",
  },
  SK_BLIND: {
    name: "암흑",
    desc: "실명 2턴, DOM +1",
    cost: 2,
    element: "dark",
  },
  SK_SYNC_PULSE: {
    name: "동조 파동",
    desc: "SYNC +4",
    cost: 0,
    element: "neutral",
  },
  SK_MEDITATION: { name: "침묵", desc: "SYNC +6", cost: 1, element: "neutral" },
  SK_OVERDRIVE_SURGE: {
    name: "폭주 개방",
    desc: "1.5배, STB -2, DOM +1",
    cost: 1,
    element: "neutral",
  },
  SK_BASIC_SLASH: {
    name: "기본 베기",
    desc: "단일 공격 1.0배",
    cost: 1,
    element: "neutral",
  },
  SK_COMBO_THRUST: {
    name: "연속 찌르기",
    desc: "1.0배 + 추가 행동",
    cost: 4,
    element: "neutral",
  },
};

const FALLBACK_ENEMY: EnemyState = {
  id: "ENEMY_GOBLIN",
  name: "고블린 전사",
  element: "neutral",
  hp: 60,
  hpMax: 60,
  atk: 12,
  def: 5,
  spd: 8,
  patterns: [],
  statusEffects: [],
};

const ACTOR_STYLE = {
  sword: { label: "에고소드", color: "text-cyan-400", bg: "bg-cyan-500/15" },
  owner: { label: "주인", color: "text-emerald-400", bg: "bg-emerald-500/15" },
  enemy: { label: "적", color: "text-red-400", bg: "bg-red-500/15" },
} as const;

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
    { id: number; value: number; type: "dmg" | "heal" }[]
  >([]);
  const [activeSkills, setActiveSkills] = useState<SkillInfo[]>([]);
  const turnCounterRef = useRef(1);
  const logEndRef = useRef<HTMLDivElement>(null);

  const turnGroups = useMemo(() => {
    const groups = new Map<number, typeof battleLog>();
    battleLog.forEach((log) => {
      const turn = log.turnNumber ?? 0;
      if (!groups.has(turn)) groups.set(turn, []);
      groups.get(turn)!.push(log);
    });
    return [...groups.entries()].sort(([a], [b]) => a - b);
  }, [battleLog]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [battleLog]);

  useEffect(() => {
    if (!runId || !currentRoom) {
      router.replace("/run/map");
      return;
    }

    clearBattleLog();
    turnCounterRef.current = 1;
    api.run.getAllSkills(runId).then((skills) => {
      setActiveSkills(skills);
    });
  }, [runId, currentRoom, router]);

  const turnMutation = useMutation({
    mutationFn: (skillId: string) => {
      if (!currentRoom) throw new Error("No room");
      return api.run.processTurn(runId!, currentRoom.id, {
        skillId,
        magicSwordAction: magicAction ?? undefined,
      });
    },
    onSuccess: (result) => {
      setSwordState(result.swordState);
      setOwnerState(result.ownerState);
      setEnemyState(result.enemyState);
      const tagged = result.result.logs.map((l) => ({
        ...l,
        turnNumber: turnCounterRef.current,
      }));
      addBattleLog(tagged);
      turnCounterRef.current++;
      setMagicAction(null);

      console.log("Turn result:", result); // 디버깅용 로그

      // 데미지 숫자 연출
      const dmgLog = result.result.logs.find(
        (l) => l.damageDealt && l.damageDealt > 0,
      );
      if (dmgLog?.damageDealt) {
        const id = Date.now();
        setDamageNumbers((prev) => [
          ...prev,
          { id, value: dmgLog.damageDealt!, type: "dmg" },
        ]);
        setTimeout(
          () => setDamageNumbers((prev) => prev.filter((d) => d.id !== id)),
          1000,
        );
      }

      // 전투 종료 처리
      if (result.battleEnd) {
        setTimeout(() => {
          if (result.battleEnd!.won) {
            router.push("/run/map");
          } else {
            router.push("/run/end");
          }
        }, 1500);
      }
    },
  });

  const handleSkillClick = (skillId: string) => {
    if (!swordState) return;
    const skill = SKILL_INFO[skillId];
    if (!skill) return;
    if (swordState.sync < skill.cost) return; // 비용 부족
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

  if (!swordState || !ownerState || !enemyState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Skeleton className="w-full h-96 m-4 rounded-2xl" />
      </div>
    );
  }

  const enemyElemColor = ELEMENT_COLOR[enemyState.element] ?? "#94A3B8";

  return (
    <div className="flex flex-col min-h-screen p-4 gap-3">
      {/* 적 상태 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-4"
      >
        <Card
          className="p-4 rounded-2xl border-white/10 bg-white/5"
          style={{ borderTop: `2px solid ${enemyElemColor}` }}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-semibold text-base">{enemyState.name}</p>
              <Badge
                className="text-xs mt-0.5"
                style={{
                  backgroundColor: enemyElemColor + "22",
                  color: enemyElemColor,
                  border: `1px solid ${enemyElemColor}44`,
                }}
              >
                {ELEMENT_LABEL[enemyState.element]}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">
                {enemyState.hp} / {enemyState.hpMax}
              </p>
              <p className="text-xs text-muted-foreground">HP</p>
            </div>
          </div>
          <div className="relative">
            <Progress
              value={(enemyState.hp / enemyState.hpMax) * 100}
              className="h-2"
            />
            <AnimatePresence>
              {damageNumbers.map((d) => (
                <motion.span
                  key={d.id}
                  initial={{ opacity: 1, y: 0, scale: 1 }}
                  animate={{ opacity: 0, y: -52, scale: 1.4 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  className="absolute right-3 -top-8 text-red-300 font-black text-2xl pointer-events-none drop-shadow-lg"
                  style={{ textShadow: "0 0 12px rgba(239,68,68,0.8)" }}
                >
                  -{d.value}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </Card>
      </motion.div>

      {/* 주인 + 검 상태 */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 border-white/10 bg-white/5 rounded-xl">
          <p className="text-xs text-muted-foreground mb-1">
            {ownerState.name}
          </p>
          <Progress
            value={(ownerState.hp / ownerState.hpMax) * 100}
            className="h-1.5 mb-1"
          />
          <p className="text-xs">
            {ownerState.hp} / {ownerState.hpMax}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor:
                  ownerState.hp / ownerState.hpMax > 0.5
                    ? "#22C55E"
                    : ownerState.hp / ownerState.hpMax > 0.25
                      ? "#EAB308"
                      : "#EF4444",
              }}
            />
            <span className="text-xs text-muted-foreground">
              조화 {ownerState.compatibilityScore}
            </span>
          </div>
        </Card>

        <Card className="p-3 border-white/10 bg-white/5 rounded-xl">
          <p className="text-xs text-muted-foreground mb-1">에고소드</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-400">SYNC</span>
              <span>
                {swordState.sync}/{swordState.syncMax}
              </span>
            </div>
            <Progress
              value={(swordState.sync / swordState.syncMax) * 100}
              className="h-1"
            />
            <div className="flex gap-2 mt-1">
              <Badge
                variant="outline"
                className={`text-xs px-1 border-white/20 ${swordState.stb <= 4 ? "text-red-400 border-red-400/30" : "text-green-400"}`}
              >
                STB {swordState.stb}
              </Badge>
              {swordState.dom > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs px-1 border-purple-400/30 text-purple-400"
                >
                  DOM {swordState.dom}
                </Badge>
              )}
            </div>
            {swordState.isOverdriven && (
              <Badge className="text-xs bg-red-500/20 text-red-300 border-red-500/30">
                폭주!
              </Badge>
            )}
            {swordState.isMagicSword && (
              <Badge className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/30">
                마검
              </Badge>
            )}
          </div>
        </Card>
      </div>

      {/* 전투 로그 */}
      <div
        className="flex-1 overflow-y-auto max-h-44 space-y-2"
        style={{ scrollbarWidth: "none" }}
      >
        {turnGroups.length === 0 && (
          <p className="text-[10px] text-white/20 text-center py-3">
            전투를 시작하라...
          </p>
        )}
        {turnGroups.map(([turnNum, logs], groupIndex) => {
          const isLastGroup = groupIndex === turnGroups.length - 1;
          return (
            <motion.div
              key={turnNum}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Turn 헤더 */}
              <div className="flex items-center gap-2 mb-1 px-1">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] text-white/25 font-medium">
                  Turn {turnNum}
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              {/* Turn 로그 카드 */}
              <Card
                className={`rounded-xl border-white/8 overflow-hidden ${isLastGroup ? "bg-white/6" : "bg-white/3"}`}
              >
                <div className="px-3 py-2 space-y-1">
                  {logs.map((log, logIndex) => {
                    const isLatest =
                      isLastGroup && logIndex === logs.length - 1;
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
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: logIndex * 0.04 }}
                        className={`flex items-start gap-2 text-xs py-1 px-1.5 rounded-md ${isLatest ? "bg-white/8" : ""}`}
                      >
                        <span
                          className={`shrink-0 font-bold text-[9px] px-1.5 py-0.5 rounded mt-0.5 ${style.color} ${style.bg}`}
                        >
                          {style.label}
                        </span>
                        <div className="flex-1 leading-relaxed text-white/70">
                          {log.text ? (
                            <span>{log.text}</span>
                          ) : hasDamage ? (
                            <motion.span
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{
                                type: "spring",
                                stiffness: 320,
                                damping: 18,
                              }}
                              className={`font-bold text-sm ${actorKey === "enemy" ? "text-red-400" : "text-cyan-300"}`}
                            >
                              {log.damageDealt} 피해
                            </motion.span>
                          ) : hasHeal ? (
                            <motion.span
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{
                                type: "spring",
                                stiffness: 320,
                                damping: 18,
                              }}
                              className="font-bold text-sm text-emerald-400"
                            >
                              +{log.healAmount} 회복
                            </motion.span>
                          ) : (
                            <span className="text-white/40">
                              {log.actionType}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          );
        })}
        <div ref={logEndRef} />
      </div>

      {/* 스킬 그리드 */}
      <div className="grid grid-cols-2 gap-2 pb-4">
        {activeSkills.map((skill, i) => {
          const canUse = (swordState.sync ?? 0) >= skill.cost;
          const elemColor = ELEMENT_COLOR[skill.element] ?? "#94A3B8";

          return (
            <motion.div
              key={skill.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Button
                variant="outline"
                className={`w-full h-auto p-3 flex flex-col items-start gap-1 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 transition-all duration-200 ${!canUse ? "opacity-40 cursor-not-allowed" : ""}`}
                disabled={!canUse || turnMutation.isPending}
                onClick={() => handleSkillClick(skill.id)}
                style={canUse ? { borderColor: elemColor + "44" } : {}}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-semibold leading-tight text-left">
                    {skill.aiName}
                  </span>
                  <Badge
                    className="text-[10px] px-1.5 shrink-0"
                    style={{
                      backgroundColor: elemColor + "22",
                      color: elemColor,
                      border: `1px solid ${elemColor}44`,
                    }}
                  >
                    {skill.cost}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground text-left leading-tight">
                  {skill.aiDesc}
                </span>
              </Button>
            </motion.div>
          );
        })}
      </div>

      {/* 확인 다이얼로그 */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-xs rounded-2xl border-white/15 bg-[#0F1219]">
          <DialogHeader>
            <DialogTitle className="text-base">스킬 사용</DialogTitle>
          </DialogHeader>
          {pendingSkill && (
            <div className="py-2">
              <p className="font-medium">{SKILL_INFO[pendingSkill]?.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {SKILL_INFO[pendingSkill]?.desc}
              </p>
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

      {/* 마검 행동 선택 */}
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
