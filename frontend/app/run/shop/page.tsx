'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRunStore } from '@/store/runStore';
import { api } from '@/lib/api';

const RARITY_COLOR: Record<string, string> = {
  common:  'text-gray-300',
  rare:    'text-blue-400',
  epic:    'text-purple-400',
};

const ELEMENT_COLOR: Record<string, string> = {
  fire: '#EF4444', water: '#3B82F6', ice: '#06B6D4',
  thunder: '#EAB308', wind: '#22C55E', poison: '#A855F7',
  light: '#F59E0B', dark: '#6B7280', neutral: '#94A3B8',
};

const SHOP_ITEMS = [
  { id: 'ITEM_FROST_SHARD',  name: '서리 파편',    rarity: 'common', element: 'ice',     price: 8,  desc: 'ATK +3, 빙결 태그 추가' },
  { id: 'ITEM_FLAME_CORE',   name: '화염 결정',    rarity: 'rare',   element: 'fire',    price: 15, desc: 'ATK +5, DOM +1' },
  { id: 'ITEM_SHADOW_SHARD', name: '그림자 파편',  rarity: 'common', element: 'dark',    price: 10, desc: 'SPD +3, 저주 태그' },
  { id: 'ITEM_SYNC_CRYSTAL', name: '동기화 결정',  rarity: 'rare',   element: 'neutral', price: 18, desc: 'SYNC MAX +2' },
];

export default function ShopPage() {
  const router = useRouter();
  const { runId } = useRunStore();

  async function handleAbsorb(itemId: string) {
    if (!runId) return;
    try {
      await api.run.absorbItem(runId, itemId);
      alert('흡수 완료!');
    } catch {
      alert('흡수 실패');
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0E14] text-white p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🏪</span>
        <h1 className="text-xl font-bold">신비한 상점</h1>
      </div>

      <p className="text-xs text-gray-400">검이 아이템을 흡수하여 스탯을 강화한다. 한 번 흡수하면 되돌릴 수 없다.</p>

      <div className="flex flex-col gap-3">
        {SHOP_ITEMS.map(item => (
          <Card key={item.id} className="bg-white/5 border-white/10">
            <CardHeader className="pb-1 pt-3 px-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: ELEMENT_COLOR[item.element] ?? '#94A3B8' }}
                />
                <CardTitle className={`text-sm font-bold ${RARITY_COLOR[item.rarity] ?? ''}`}>
                  {item.name}
                </CardTitle>
                <Badge variant="outline" className="ml-auto text-xs">{item.price}G</Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 flex items-center justify-between">
              <p className="text-xs text-gray-400">{item.desc}</p>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 ml-2 border-white/20 hover:bg-white/10 text-xs"
                onClick={() => handleAbsorb(item.id)}
              >
                흡수
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        variant="ghost"
        className="w-full mt-auto text-gray-400"
        onClick={() => router.push('/run/map')}
      >
        그냥 떠난다
      </Button>
    </main>
  );
}
