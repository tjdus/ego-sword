'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRunStore } from '@/store/runStore';
import { api, type ShopItem } from '@/lib/api';

const RARITY_COLOR: Record<string, string> = {
  common: 'text-gray-300',
  rare:   'text-blue-400',
  epic:   'text-purple-400',
};

const RARITY_BORDER: Record<string, string> = {
  common: 'border-white/10',
  rare:   'border-blue-500/30',
  epic:   'border-purple-500/30',
};

export default function ShopPage() {
  const router = useRouter();
  const { runId, currentRoom, swordState, setSwordState } = useRunStore();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [gold, setGold] = useState<number>(swordState?.gold ?? 0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [roomDone, setRoomDone] = useState(false);

  useEffect(() => {
    if (!runId) return;
    api.run.getShopItems(runId).then((res) => {
      setItems(res.items);
      setGold(res.gold);
    }).finally(() => setLoading(false));
  }, [runId]);

  async function handleAbsorb(item: ShopItem) {
    if (!runId || buying) return;
    if (gold < item.shopPrice) {
      toast.error('골드가 부족합니다', { description: `필요: ${item.shopPrice}G / 보유: ${gold}G` });
      return;
    }
    setBuying(item.id);
    try {
      const res = await api.run.absorbItem(runId, item.id);
      const newSword = res.swordState as typeof swordState;
      if (newSword) setSwordState(newSword);
      const newGold = gold - item.shopPrice;
      setGold(newGold);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success(`${item.aiName ?? item.id} 흡수 완료`, {
        description: `잔여 골드: ${newGold}G`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '흡수 실패';
      toast.error(msg);
    } finally {
      setBuying(null);
    }
  }

  async function handleLeave() {
    if (runId && currentRoom && !roomDone) {
      setRoomDone(true);
      await api.run.completeRoom(runId, currentRoom.id).catch(() => {});
    }
    router.push('/run/map');
  }

  return (
    <main className="min-h-screen bg-[#0B0E14] text-white p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🏪</span>
        <h1 className="text-xl font-bold">신비한 상점</h1>
        <Badge variant="outline" className="ml-auto text-yellow-400 border-yellow-500/40 text-sm font-bold">
          {gold}G
        </Badge>
      </div>

      <p className="text-xs text-gray-400">검이 아이템을 흡수하여 스탯을 강화한다. 한 번 흡수하면 되돌릴 수 없다.</p>

      <div className="flex flex-col gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))
        ) : items.length === 0 ? (
          <Card className="bg-white/5 border-white/10 p-4 text-center text-sm text-muted-foreground">
            구매 가능한 아이템이 없다.
          </Card>
        ) : (
          items.map(item => (
            <Card key={item.id} className={`bg-white/5 ${RARITY_BORDER[item.rarity] ?? 'border-white/10'}`}>
              <CardHeader className="pb-1 pt-3 px-4">
                <div className="flex items-center gap-2">
                  <CardTitle className={`text-sm font-bold ${RARITY_COLOR[item.rarity] ?? ''}`}>
                    {item.aiName ?? item.id}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={`ml-auto text-xs ${gold < item.shopPrice ? 'text-red-400 border-red-500/30' : 'text-yellow-400 border-yellow-500/40'}`}
                  >
                    {item.shopPrice}G
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 flex items-center justify-between gap-2">
                <p className="text-xs text-gray-400">{item.aiDesc ?? ''}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-white/20 hover:bg-white/10 text-xs"
                  disabled={!!buying || gold < item.shopPrice}
                  onClick={() => handleAbsorb(item)}
                >
                  {buying === item.id ? '흡수 중…' : '흡수'}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Button
        variant="ghost"
        className="w-full mt-auto text-gray-400"
        onClick={handleLeave}
      >
        그냥 떠난다
      </Button>
    </main>
  );
}
