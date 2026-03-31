'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRunStore } from '@/store/runStore';
import { api, type ShopItem, type SwordState, type AbsorbResult } from '@/lib/api';
import { ELEMENT_COLOR } from '@/lib/element';

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

const TAG_LABEL: Record<string, string> = {
  fire: '🔥 화염', ice: '❄️ 빙결', thunder: '⚡ 번개', dark: '🌑 어둠',
  light: '✨ 빛', wind: '💨 바람', poison: '☠️ 독', soul: '👻 영혼',
  combat: '⚔️ 전투', curse: '🩸 저주',
};

// ── 흡수 diff 타입 ───────────────────────────────────────────────────────────

interface StatDiff { label: string; before: number; after: number; delta: number; }
interface AbsorbDiff {
  itemName: string;
  stats: StatDiff[];
  newTags: string[];
  elementChanged: { from: string; to: string } | null;
  newSkills: string[];
  skillUpgrades: Array<{ from: string; to: string }>;
  modeGained: 'magicSword' | 'overdriven' | null;
  triggerFired: boolean;
  beforeImage: string | null;
  afterImage: string | null;
}

function computeAbsorbDiff(
  itemName: string,
  prev: SwordState,
  next: SwordState,
  result: AbsorbResult,
): AbsorbDiff {
  const statFields: { key: keyof SwordState; label: string }[] = [
    { key: 'atk', label: 'ATK' }, { key: 'def', label: 'DEF' },
    { key: 'spd', label: 'SPD' }, { key: 'syncMax', label: 'SYNC최대' },
    { key: 'stb', label: 'STB' }, { key: 'dom', label: 'DOM' },
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
  const elementChanged = prev.element !== next.element
    ? { from: prev.element, to: next.element } : null;
  const prevSkillSet = new Set(prev.activeSkillIds);
  const newSkills = (next.activeSkillIds ?? []).filter((id) => !prevSkillSet.has(id));
  const modeGained =
    !prev.isMagicSword && next.isMagicSword ? 'magicSword' :
    !prev.isOverdriven && next.isOverdriven ? 'overdriven' : null;

  return {
    itemName, stats, newTags, elementChanged, newSkills,
    skillUpgrades: result.skillUpgrades ?? [],
    modeGained,
    triggerFired: (result.triggerEvents?.length ?? 0) > 0,
    beforeImage: prev.swordImageBase64 ?? null,
    afterImage: next.swordImageBase64 ?? null,
  };
}

export default function ShopPage() {
  const router = useRouter();
  const { runId, currentRoom, swordState, setSwordState } = useRunStore();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [gold, setGold] = useState<number>(swordState?.gold ?? 0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [roomDone, setRoomDone] = useState(false);
  const [itemDiffs, setItemDiffs] = useState<Record<string, AbsorbDiff>>({});

  useEffect(() => {
    if (!runId) return;
    api.run.getShopItems(runId).then((res) => {
      setItems(res.items);
      setGold(res.gold);
    }).finally(() => setLoading(false));
  }, [runId]);

  async function handleAbsorb(item: ShopItem) {
    if (!runId || buying) return;
    if (gold < item.shopPrice) return;
    setBuying(item.id);
    const prevState = swordState;
    try {
      const res = await api.run.absorbItem(runId, item.id);
      const newSword = res.swordState;
      if (newSword) setSwordState(newSword);
      setGold(gold - item.shopPrice);

      if (prevState && newSword) {
        const diff = computeAbsorbDiff(item.aiName ?? item.id, prevState, newSword, res);
        setItemDiffs((prev) => ({ ...prev, [item.id]: diff }));
      }

      // 2.5초 후 목록에서 제거
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setItemDiffs((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
      }, 2500);
    } catch {
      // 실패 시 무시
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
          items.map(item => {
            const diff = itemDiffs[item.id];

            // 흡수 완료 → diff 카드
            if (diff) {
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-xl border border-emerald-500/30 bg-emerald-900/10 p-3"
                >
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
                        <img src={diff.beforeImage} alt="before" width={56} height={56}
                          className="rounded opacity-40 grayscale"
                          style={{ imageRendering: 'pixelated' }} />
                      ) : (
                        <div className="w-14 h-14 rounded bg-white/5 border border-white/10" />
                      )}
                      <span className="text-white/30 text-lg">→</span>
                      {diff.afterImage ? (
                        <motion.img src={diff.afterImage} alt="after" width={56} height={56}
                          initial={{ scale: 0.7, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          className="rounded"
                          style={{ imageRendering: 'pixelated' }} />
                      ) : (
                        <div className="w-14 h-14 rounded bg-white/5 border border-white/10" />
                      )}
                    </div>
                  )}

                  {/* 스탯 변화 */}
                  {diff.stats.length > 0 && (
                    <div className="space-y-0.5 mb-1.5">
                      {diff.stats.map((s, i) => (
                        <motion.div key={s.label}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="flex items-center gap-1.5 text-[11px]"
                        >
                          <span className="text-white/40 w-12">{s.label}</span>
                          <span className="text-white/50">{s.before}</span>
                          <span className="text-white/30 text-[9px]">→</span>
                          <span className="text-white/80 font-medium">{s.after}</span>
                          <span className={`ml-auto font-bold ${s.delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {s.delta > 0 ? `+${s.delta}` : s.delta} {s.delta > 0 ? '▲' : '▼'}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {diff.newTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {diff.newTags.map((t, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                          {TAG_LABEL[t] ?? t} 추가
                        </span>
                      ))}
                    </div>
                  )}

                  {diff.elementChanged && (
                    <div className="text-[10px] text-white/50 mb-1">
                      <span style={{ color: ELEMENT_COLOR[diff.elementChanged.from] ?? '#94A3B8' }}>
                        {diff.elementChanged.from}
                      </span>
                      {' → '}
                      <span style={{ color: ELEMENT_COLOR[diff.elementChanged.to] ?? '#94A3B8' }}>
                        {diff.elementChanged.to}
                      </span>
                      {' '}원소로 변화
                    </div>
                  )}
                  {diff.newSkills.length > 0 && <div className="text-[10px] text-cyan-400/80 mb-1">📖 새 스킬 획득</div>}
                  {diff.triggerFired && <div className="text-[10px] text-amber-400/80 mb-1">✦ 특성 트리거 발동!</div>}

                  {diff.modeGained === 'magicSword' && (
                    <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                      className="mt-1.5 rounded-lg border border-purple-500/50 bg-purple-900/40 px-2.5 py-1.5 text-center">
                      <span className="text-xs font-bold text-purple-300">⚔ 마검 각성!</span>
                    </motion.div>
                  )}
                  {diff.modeGained === 'overdriven' && (
                    <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 16 }}
                      className="mt-1.5 rounded-lg border border-red-500/50 bg-red-900/40 px-2.5 py-1.5 text-center">
                      <span className="text-xs font-bold text-red-300">💢 폭주 돌입!</span>
                    </motion.div>
                  )}
                </motion.div>
              );
            }

            // 기본 아이템 카드
            return (
              <Card
                key={item.id}
                className={`bg-white/5 ${item.isUnique ? 'border-amber-500/40' : (RARITY_BORDER[item.rarity] ?? 'border-white/10')}`}
              >
                <CardHeader className="pb-1 pt-3 px-4">
                  <div className="flex items-center gap-2">
                    {item.isUnique && <span className="text-amber-400 text-xs font-bold">✦</span>}
                    <CardTitle className={`text-sm font-bold ${item.isUnique ? 'text-amber-300' : (RARITY_COLOR[item.rarity] ?? '')}`}>
                      {item.aiName ?? item.id}
                    </CardTitle>
                    {item.isUnique && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-400 border-amber-500/40">유니크</Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`ml-auto text-xs ${gold < item.shopPrice ? 'text-red-400 border-red-500/30' : 'text-yellow-400 border-yellow-500/40'}`}
                    >
                      {item.shopPrice}G
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3 flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5 flex-1">
                    <p className="text-xs text-gray-400">{item.aiDesc ?? ''}</p>
                    {item.isUnique && item.aiLore && (
                      <p className="text-[10px] text-amber-500/70 italic">{item.aiLore}</p>
                    )}
                  </div>
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
            );
          })
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
