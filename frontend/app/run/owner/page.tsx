'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type OwnerCandidate } from '@/lib/api';
import { useRunStore } from '@/store/runStore';
import { CLASS_LABEL, ELEMENT_LABEL, ELEMENT_COLOR, RARITY_LABEL, RARITY_COLOR } from '@/lib/element';

export default function OwnerSelectPage() {
  const router = useRouter();
  const { runId, setOwnerState, setSwordState, setFloorMap } = useRunStore();
  const [candidates, setCandidates] = useState<OwnerCandidate[]>([]);
  const [selected, setSelected] = useState<OwnerCandidate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runId) { router.replace('/'); return; }
    api.run.start().then(({ ownerCandidates }) => {
      setCandidates(ownerCandidates);
      setLoading(false);
    }).catch(() => router.replace('/'));
  }, [runId, router]);

  const selectMutation = useMutation({
    mutationFn: (candidate: OwnerCandidate) =>
      api.run.selectOwner(runId!, candidate),
    onSuccess: ({ ownerState, swordState, firstFloorMap }) => {
      setOwnerState(ownerState as Parameters<typeof setOwnerState>[0]);
      setSwordState(swordState as Parameters<typeof setSwordState>[0]);
      setFloorMap(firstFloorMap);
      router.push('/run/map');
    },
  });

  if (loading) {
    return (
      <div className="p-4 flex flex-col gap-4">
        <div className="pt-8 pb-2">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        {[0,1,2].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-4 gap-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="pt-8 pb-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">주인 선택</p>
        <h1 className="text-xl font-bold">누구와 함께할 것인가?</h1>
        <p className="text-sm text-muted-foreground mt-1">한 명을 선택하면 던전이 시작된다.</p>
      </motion.div>

      <div className="flex flex-col gap-3">
        {candidates.map((c, i) => {
          const isSelected = selected?.ownerId === c.ownerId;
          const elemColor = ELEMENT_COLOR[c.element] ?? '#94A3B8';

          return (
            <motion.div
              key={c.ownerId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Card
                className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'border-white/40 bg-white/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20'
                }`}
                onClick={() => setSelected(isSelected ? null : c)}
                style={isSelected ? { boxShadow: `0 0 16px ${elemColor}25` } : {}}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-base">{c.aiText.name}</span>
                      <Badge
                        variant="outline"
                        className="text-xs px-1.5 py-0"
                        style={{ borderColor: RARITY_COLOR[c.rarity], color: RARITY_COLOR[c.rarity] }}
                      >
                        {RARITY_LABEL[c.rarity]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.aiText.oneLiner}</p>
                  </div>
                  <Badge
                    className="text-xs shrink-0 ml-2"
                    style={{ backgroundColor: elemColor + '22', color: elemColor, border: `1px solid ${elemColor}44` }}
                  >
                    {ELEMENT_LABEL[c.element]}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className="text-xs">{CLASS_LABEL[c.class]}</Badge>
                  <span className="text-xs text-muted-foreground">{c.hint}</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">조화</span>
                    <span style={{ color: c.compatibilityScore >= 70 ? '#22C55E' : c.compatibilityScore >= 40 ? '#94A3B8' : '#EF4444' }}>
                      {c.compatibilityScore}
                    </span>
                  </div>
                  <Progress value={c.compatibilityScore} className="h-1.5" />
                </div>

                <div className="mt-3 grid grid-cols-5 gap-1 text-center text-xs">
                  {[
                    { label: 'HP', val: c.combatStats.hpMax },
                    { label: '공격', val: c.combatStats.pow },
                    { label: '방어', val: c.combatStats.guard },
                    { label: '민첩', val: c.combatStats.agi },
                    { label: '집중', val: c.combatStats.focus },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-white/5 rounded-lg py-1.5">
                      <p className="text-muted-foreground text-[10px]">{label}</p>
                      <p className="font-medium">{val}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-auto pb-4">
        <Button
          size="lg"
          className="w-full h-14 text-base font-semibold rounded-2xl gap-2 bg-white text-black hover:bg-white/90"
          disabled={!selected || selectMutation.isPending}
          onClick={() => selected && selectMutation.mutate(selected)}
        >
          {selectMutation.isPending ? '연결 중…' : (
            <>
              <Zap className="w-5 h-5" />
              {selected ? `${selected.aiText.name}와 연결` : '주인을 선택하라'}
              {selected && <ChevronRight className="w-4 h-4 ml-auto" />}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
