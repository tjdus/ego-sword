'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { useRunStore } from '@/store/runStore';

export default function RestPage() {
  const router = useRouter();
  const { ownerState, setOwnerState, runId, currentRoom } = useRunStore();
  const [rested, setRested] = useState(false);
  const [loading, setLoading] = useState(false);

  const hp = ownerState?.hp ?? 80;
  const hpMax = ownerState?.hpMax ?? 100;
  const healAmount = Math.floor(hpMax * 0.3);
  const newHp = Math.min(hpMax, hp + healAmount);

  async function handleRest() {
    if (!runId || !currentRoom) return;
    setLoading(true);
    const result = await api.run.completeRoom(runId, currentRoom.id);
    if (result.ownerState) setOwnerState(result.ownerState as Parameters<typeof setOwnerState>[0]);
    setRested(true);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#0B0E14] text-white p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🏕️</span>
        <h1 className="text-xl font-bold">휴식처</h1>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="pt-4 flex flex-col gap-3">
          <p className="text-sm text-gray-300">
            잠시 숨을 고를 수 있는 공간이다. 주인의 상처를 회복한다.
          </p>

          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>주인 HP</span>
              <span>{hp} / {hpMax}</span>
            </div>
            <Progress value={(hp / hpMax) * 100} className="h-2" />
          </div>

          {!rested ? (
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-xs text-gray-400">휴식 시 HP +{healAmount} 회복</p>
              <Button onClick={handleRest} disabled={loading} className="w-full">
                휴식한다
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-sm text-green-400">HP {newHp}/{hpMax} — 상처가 아물었다.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {rested && (
        <Button
          className="w-full mt-auto"
          onClick={() => router.push('/run/map')}
        >
          던전으로 돌아가기
        </Button>
      )}
    </main>
  );
}
