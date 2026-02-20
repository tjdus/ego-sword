'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type TraitCandidate, type RunEndResult } from '@/lib/api';
import { useRunStore } from '@/store/runStore';
import { CATEGORY_LABEL } from '@/lib/element';

export default function RunEndPage() {
  const router = useRouter();
  const { runId, resetRun } = useRunStore();
  const [selected, setSelected] = useState<TraitCandidate | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const { data: endData, isLoading } = useQuery({
    queryKey: ['run-end', runId],
    queryFn: () => api.run.endRun(runId!),
    enabled: !!runId,
    staleTime: Infinity,
  });

  const selectMutation = useMutation({
    mutationFn: (traitId: string) => api.run.selectTrait(runId!, traitId),
    onSuccess: () => {
      setConfirmed(true);
      setTimeout(() => {
        resetRun();
        router.replace('/');
      }, 2000);
    },
  });

  useEffect(() => {
    if (!runId) router.replace('/');
  }, [runId, router]);

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-4">
        <div className="pt-12">
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        {[0,1,2].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-4 gap-6">
      {/* 내레이션 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="pt-10"
      >
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">런 종료</p>
        <div className="space-y-2">
          {(endData?.narration ?? '낡은 검으로 돌아갔다.').split('\n').map((line, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.2 }}
              className="text-base leading-relaxed text-muted-foreground"
            >
              {line}
            </motion.p>
          ))}
        </div>
      </motion.div>

      {/* 특성 선택 */}
      {!confirmed ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex-1"
        >
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            영혼 파편 — 하나를 선택하라
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {(endData?.traitCandidates ?? []).map((trait, i) => {
              const isSelected = selected?.traitId === trait.traitId;
              return (
                <motion.div
                  key={trait.traitId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + i * 0.1 }}
                >
                  <Card
                    className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'rune-glow border-purple-500/60 bg-purple-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20'
                    }`}
                    onClick={() => setSelected(isSelected ? null : trait)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{trait.aiName ?? trait.traitId}</p>
                        <Badge variant="outline" className="text-xs px-1.5 py-0 border-white/20 mt-1">
                          {CATEGORY_LABEL[trait.category ?? 'combat'] ?? trait.category}
                        </Badge>
                      </div>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 rounded-full bg-purple-400 flex items-center justify-center"
                        >
                          <span className="text-[10px] text-white">✓</span>
                        </motion.div>
                      )}
                    </div>
                    {trait.aiLabel && (
                      <p className="text-xs text-muted-foreground italic">"{trait.aiLabel}"</p>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex flex-col items-center justify-center gap-4"
        >
          <div className="text-4xl">⚔️</div>
          <p className="text-center text-muted-foreground">
            영혼 파편이 칼끝에 새겨졌다.<br />
            <span className="text-sm">다음 런이 기다린다.</span>
          </p>
        </motion.div>
      )}

      {/* 확정 버튼 */}
      {!confirmed && (
        <div className="pb-4">
          <Button
            size="lg"
            className="w-full h-14 text-base font-semibold rounded-2xl bg-white text-black hover:bg-white/90"
            disabled={!selected || selectMutation.isPending}
            onClick={() => selected && selectMutation.mutate(selected.traitId)}
          >
            {selectMutation.isPending ? '새기는 중…' : selected ? `[${selected.aiName ?? selected.traitId}] 선택` : '특성을 선택하라'}
          </Button>
        </div>
      )}
    </div>
  );
}
