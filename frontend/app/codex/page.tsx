'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useRunStore } from '@/store/runStore';
import { CATEGORY_LABEL, CLASS_LABEL, ELEMENT_LABEL, ELEMENT_COLOR } from '@/lib/element';

export default function CodexPage() {
  const router = useRouter();
  const { token } = useRunStore();

  const { data: traits, isLoading: traitsLoading } = useQuery({
    queryKey: ['codex-traits'],
    queryFn: () => api.codex.getTraits(),
    enabled: !!token,
  });

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['codex-runs'],
    queryFn: () => api.codex.getRuns(),
    enabled: !!token,
  });

  const byCategory = {
    attribute:  (traits ?? []).filter(t => t.category === 'attribute'),
    combat:     (traits ?? []).filter(t => t.category === 'combat'),
    explore:    (traits ?? []).filter(t => t.category === 'explore'),
    domination: (traits ?? []).filter(t => t.category === 'domination'),
  };

  return (
    <div className="flex flex-col min-h-screen p-4 gap-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="pt-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">도감</p>
          <h1 className="text-xl font-bold">나의 에고소드</h1>
        </div>
      </motion.div>

      <Tabs defaultValue="traits">
        <TabsList className="w-full">
          <TabsTrigger value="traits" className="flex-1">영혼 파편</TabsTrigger>
          <TabsTrigger value="runs" className="flex-1">런 기록</TabsTrigger>
        </TabsList>

        {/* 누적 특성 탭 */}
        <TabsContent value="traits" className="mt-4">
          {traitsLoading ? (
            <div className="space-y-2">{[0,1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : (traits ?? []).length === 0 ? (
            <Card className="p-6 border-white/10 bg-white/5 text-center">
              <p className="text-muted-foreground text-sm">아직 아무것도 새겨지지 않았다.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {(Object.entries(byCategory) as [string, typeof traits][]).map(([cat, items]) => {
                if (!items || items.length === 0) return null;
                return (
                  <div key={cat}>
                    <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      {CATEGORY_LABEL[cat]}
                    </h3>
                    <div className="flex flex-col gap-2">
                      {items.map(t => (
                        <Card key={t.traitId} className="p-3 border-white/10 bg-white/5 rounded-xl flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{t.traitId.replace('_POINT', '').replace('_', ' ')}</p>
                            <p className="text-xs text-muted-foreground">{cat === 'attribute' ? '속성 피해 +' + (t.stacks * 2) + '%' : '스택: ' + t.stacks}</p>
                          </div>
                          <Badge className="text-sm font-bold bg-purple-500/20 text-purple-300 border-purple-500/30 px-2.5">
                            ×{t.stacks}
                          </Badge>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 런 기록 탭 */}
        <TabsContent value="runs" className="mt-4">
          {runsLoading ? (
            <div className="space-y-2">{[0,1,2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : (runs ?? []).length === 0 ? (
            <Card className="p-6 border-white/10 bg-white/5 text-center">
              <p className="text-muted-foreground text-sm">기록이 없다.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {(runs ?? []).map((run, i) => {
                const elemColor = ELEMENT_COLOR[run.swordElement ?? 'neutral'] ?? '#94A3B8';
                return (
                  <motion.div
                    key={run.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card className="p-3 border-white/10 bg-white/5 rounded-xl" style={{ borderLeft: `3px solid ${elemColor}` }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {CLASS_LABEL[run.ownerClass ?? ''] ?? '??'} — {run.ownerName ?? '???'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {ELEMENT_LABEL[run.swordElement ?? 'neutral']} 속성 · {run.floorDepth}층 도달
                            {run.killedBy ? ` · ${run.killedBy}에게 사망` : ''}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs border-white/20 ${run.status === 'completed' ? 'text-green-400 border-green-400/30' : 'text-red-400 border-red-400/30'}`}
                        >
                          {run.status === 'completed' ? '클리어' : '사망'}
                        </Badge>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
