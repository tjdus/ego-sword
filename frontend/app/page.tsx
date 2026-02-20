'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Sword, BookOpen, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useRunStore } from '@/store/runStore';
import { CATEGORY_LABEL, ELEMENT_COLOR, ELEMENT_LABEL } from '@/lib/element';

export default function HomePage() {
  const router = useRouter();
  const { setAuth, setRunId, resetRun, userId, token } = useRunStore();

  // 게스트 로그인 (최초 1회)
  useEffect(() => {
    if (!token) {
      const deviceId = localStorage.getItem('ego_device') ?? Math.random().toString(36).slice(2);
      localStorage.setItem('ego_device', deviceId);
      api.auth.guestLogin(deviceId).then(({ userId, token }) => {
        setAuth(userId, token);
      });
    }
  }, [token, setAuth]);

  // 진행 현황 조회
  const { data: progress, isLoading } = useQuery({
    queryKey: ['progress', userId],
    queryFn: () => api.auth.getProgress(),
    enabled: !!token,
    staleTime: 30_000,
  });

  // 런 시작
  const startMutation = useMutation({
    mutationFn: () => {
      resetRun();
      return api.run.start();
    },
    onSuccess: ({ runId }) => {
      setRunId(runId);
      router.push('/run/owner');
    },
  });

  const traits = progress?.permanentTraits ?? [];
  const byCategory = {
    attribute:  traits.filter(t => t.category === 'attribute'),
    combat:     traits.filter(t => t.category === 'combat'),
    explore:    traits.filter(t => t.category === 'explore'),
    domination: traits.filter(t => t.category === 'domination'),
  };

  return (
    <div className="flex flex-col min-h-screen p-4 gap-6">
      {/* 헤더 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-8 pb-2"
      >
        <div className="flex items-center gap-2 mb-1">
          <Sword className="w-5 h-5 text-[#94A3B8]" />
          <span className="text-xs text-muted-foreground tracking-widest uppercase">Ego Sword</span>
        </div>
        <h1 className="text-2xl font-bold leading-tight">나는 전설의 검이다</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {progress?.totalRuns
            ? `${progress.totalRuns}번의 런 · 최고 ${progress.bestDepth}층`
            : '낡은 검이 잠들어 있다.'}
        </p>
      </motion.div>

      {/* 누적 특성 요약 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
          영혼 파편 — 누적 특성
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[0,1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : traits.length === 0 ? (
          <Card className="p-4 border-white/10 bg-white/5">
            <p className="text-sm text-muted-foreground text-center">
              아직 아무것도 남기지 않았다.<br />
              <span className="text-xs">첫 런을 시작해보라.</span>
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(byCategory) as [string, typeof traits][]).map(([cat, items]) => {
              if (items.length === 0) return null;
              const totalStacks = items.reduce((sum, t) => sum + t.stacks, 0);
              return (
                <Card key={cat} className="p-3 border-white/10 bg-white/5 rounded-2xl">
                  <p className="text-xs text-muted-foreground mb-2">{CATEGORY_LABEL[cat]}</p>
                  <p className="text-lg font-bold">{totalStacks}</p>
                  <p className="text-xs text-muted-foreground">{items.length}종</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {items.slice(0, 3).map(t => (
                      <Badge key={t.traitId} variant="outline" className="text-xs px-1.5 py-0 border-white/20">
                        {t.traitId.replace('_POINT', '')} ×{t.stacks}
                      </Badge>
                    ))}
                    {items.length > 3 && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 border-white/20">
                        +{items.length - 3}
                      </Badge>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* 런 시작 버튼 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-auto pb-4"
      >
        <Button
          size="lg"
          className="w-full h-14 text-base font-semibold rounded-2xl gap-2 bg-white text-black hover:bg-white/90"
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending || !token}
        >
          {startMutation.isPending ? (
            '주인을 찾는 중…'
          ) : (
            <>
              <Sword className="w-5 h-5" />
              새로운 런 시작
              <ChevronRight className="w-4 h-4 ml-auto" />
            </>
          )}
        </Button>

        <Button
          variant="ghost"
          className="w-full mt-2 text-muted-foreground"
          onClick={() => router.push('/codex')}
        >
          <BookOpen className="w-4 h-4 mr-2" />
          도감 / 기록
        </Button>
      </motion.div>

      {/* 최근 런 */}
      {progress?.recentRuns && (progress.recentRuns as RecentRun[]).length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="pb-4"
        >
          <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">최근 기록</h2>
          <div className="flex flex-col gap-1">
            {(progress.recentRuns as RecentRun[]).slice(0, 3).map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 text-sm"
              >
                <span className="text-muted-foreground">{run.ownerClass ?? '??'}</span>
                <span>{run.floorDepth}층</span>
                <Badge
                  variant="outline"
                  className={`text-xs border-white/20 ${run.status === 'completed' ? 'text-green-400' : 'text-red-400'}`}
                >
                  {run.status === 'completed' ? '클리어' : '사망'}
                </Badge>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

interface RecentRun {
  id: string;
  status: string;
  floorDepth: number;
  ownerClass?: string;
}
