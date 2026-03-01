"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, SkillInfo } from "@/lib/api";
import { useRunStore } from "@/store/runStore";
import { ELEMENT_COLOR, ELEMENT_LABEL } from "@/lib/element";

export default function SkillSwapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { runId, swordState, setSwordState } = useRunStore();

  const newSkillId = searchParams.get("skillId") ?? "";

  const [allSkills, setAllSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [swapping, setSwapping] = useState<string | null>(null);

  useEffect(() => {
    if (!runId || !newSkillId) {
      router.replace("/run/map");
      return;
    }
    api.run.getAllSkills(runId).then((skills) => {
      setAllSkills(skills);
      setLoading(false);
    });
  }, [runId, newSkillId, router]);

  if (loading || !swordState) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-slate-950 text-white/40 text-sm">
        로딩 중...
      </div>
    );
  }

  const currentSkillIds = swordState.activeSkillIds;
  const newSkill = allSkills.find((s) => s.id === newSkillId);
  const currentSkills = currentSkillIds
    .map((id) => allSkills.find((s) => s.id === id))
    .filter(Boolean) as SkillInfo[];

  const handleSwap = async (removeSkillId: string) => {
    if (!runId) return;
    setSwapping(removeSkillId);
    try {
      const res = await api.run.swapSkill(runId, removeSkillId, newSkillId);
      setSwordState(res.swordState);
      router.push("/run/map");
    } catch {
      setSwapping(null);
    }
  };

  const handleSkip = () => router.push("/run/map");

  return (
    <div className="flex flex-col min-h-[100dvh] bg-slate-950 text-white px-4 py-6">
      {/* 헤더 */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <p className="text-[10px] text-amber-400/70 uppercase tracking-widest mb-1">
          스킬 슬롯 초과
        </p>
        <h1 className="text-lg font-bold leading-tight">
          교체할 스킬을 선택하라
        </h1>
        <p className="text-xs text-white/35 mt-1">
          새 스킬을 배우려면 기존 스킬 하나를 잊어야 한다.
        </p>
      </motion.div>

      {/* 새 스킬 카드 */}
      {newSkill && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6"
        >
          <p className="text-[9px] text-amber-300/60 uppercase tracking-widest mb-2">
            새 스킬
          </p>
          <SkillCard skill={newSkill} highlight />
        </motion.div>
      )}

      {/* 구분 화살표 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-white/8" />
        <ArrowRight className="w-3.5 h-3.5 text-white/20" />
        <div className="flex-1 h-px bg-white/8" />
      </div>

      {/* 현재 스킬 목록 */}
      <p className="text-[9px] text-white/35 uppercase tracking-widest mb-3">
        현재 스킬 (교체할 것을 선택)
      </p>
      <div className="space-y-2">
        {currentSkills.map((skill, i) => (
          <motion.div
            key={skill.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-stretch gap-2"
          >
            <div className="flex-1">
              <SkillCard skill={skill} />
            </div>
            <Button
              size="sm"
              disabled={!!swapping}
              className="shrink-0 h-auto px-3 text-xs bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30"
              onClick={() => handleSwap(skill.id)}
            >
              {swapping === skill.id ? "..." : "교체"}
            </Button>
          </motion.div>
        ))}
      </div>

      {/* 건너뛰기 */}
      <div className="mt-auto pt-8">
        <Button
          variant="ghost"
          className="w-full text-white/30 text-xs"
          onClick={handleSkip}
        >
          건너뛰기 (새 스킬 포기)
        </Button>
      </div>
    </div>
  );
}

// ─── 스킬 카드 서브컴포넌트 ──────────────────────────────────────────────────

function SkillCard({
  skill,
  highlight = false,
}: {
  skill: SkillInfo;
  highlight?: boolean;
}) {
  const elemColor = ELEMENT_COLOR[skill.element] ?? "#94A3B8";
  return (
    <div
      className={`rounded-xl p-3 border bg-white/4 ${
        highlight
          ? "border-amber-400/40"
          : "border-white/10"
      }`}
      style={
        highlight
          ? { boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.12)" }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-semibold leading-tight line-clamp-1">
          {skill.aiName ?? skill.id}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <Badge
            className="text-[9px] px-1.5 py-0 h-4"
            style={{
              backgroundColor: elemColor + "22",
              color: elemColor,
              border: `1px solid ${elemColor}44`,
            }}
          >
            {ELEMENT_LABEL[skill.element] ?? skill.element}
          </Badge>
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 h-4 border-white/20 text-white/50"
          >
            {skill.cost}
          </Badge>
        </div>
      </div>
      <p className="text-[10px] text-white/30 leading-tight line-clamp-2">
        {skill.aiDesc ?? ""}
      </p>
    </div>
  );
}
