'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRunStore } from '@/store/runStore';
import { api } from '@/lib/api';
import type { AiEventData } from '@/lib/api';

const FALLBACK_EVENT: AiEventData = {
  title: '낡은 제단',
  description: '어둠 속에 낡은 제단이 있다. 뭔가를 원하는 것 같다.',
  choices: [
    { label: '봉납한다', hint: '검을 바친다', outcomeText: '검날이 안정되었다.', mechanic: 'stb_up' },
    { label: '무시한다', hint: '그냥 지나친다', outcomeText: '조용히 지나쳤다.', mechanic: 'nothing' },
    { label: '조사한다', hint: '위험할 수도', outcomeText: '골드가 생겼다.', mechanic: 'gold_gain' },
  ],
};

const MECHANIC_TAG: Record<string, string> = {
  atk_up: '공격력↑', def_up: '방어력↑', spd_up: '속도↑',
  stb_up: '안정↑', stb_down: '안정↓', dom_up: '지배↑',
  hp_restore: 'HP회복', hp_lose: 'HP손실', gold_gain: '골드↑',
  sync_restore: '싱크↑', tag_fire: '🔥', tag_ice: '❄️',
  tag_dark: '🌑', tag_soul: '👻', tag_thunder: '⚡',
  nothing: '',
};

export default function EventPage() {
  const router = useRouter();
  const { runId, currentRoom, currentEventData } = useRunStore();
  const eventData = currentEventData ?? FALLBACK_EVENT;
  const [chosen, setChosen] = useState(false);
  const [outcomeText, setOutcomeText] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<number | null>(null);

  async function choose(choiceIndex: number) {
    if (!runId || chosen) return;
    setChoosing(choiceIndex);
    try {
      const choice = eventData.choices[choiceIndex];
      const res = await api.run.chooseEvent(runId, 'AI_EVENT', choiceIndex, currentRoom?.id ?? '');
      setOutcomeText(res.outcome.text ?? choice?.outcomeText ?? '무언가 일어났다.');
      setChosen(true);
    } catch {
      setOutcomeText('이벤트 처리 중 오류가 발생했습니다.');
      setChosen(true);
    } finally {
      setChoosing(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0E14] text-white p-4 flex flex-col gap-4">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 mb-2"
      >
        <span className="text-2xl">✦</span>
        <h1 className="text-xl font-bold">{eventData.title}</h1>
        <Badge variant="outline" className="ml-auto text-cyan-400 border-cyan-500/40">이벤트</Badge>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-4">
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {eventData.description}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <AnimatePresence mode="wait">
        {!chosen ? (
          <motion.div
            key="choices"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-2"
          >
            {eventData.choices.map((c, idx) => {
              const tag = MECHANIC_TAG[c.mechanic] ?? '';
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.07 }}
                >
                  <Button
                    variant="outline"
                    className="w-full text-left justify-start min-h-14 border-white/20 hover:bg-white/10 hover:border-cyan-500/40"
                    onClick={() => choose(idx)}
                    disabled={choosing !== null}
                  >
                    <div className="flex-1">
                      <div className="font-semibold flex items-center gap-2">
                        {c.label}
                        {tag && (
                          <span className="text-xs text-cyan-400 font-normal">{tag}</span>
                        )}
                      </div>
                      {c.hint && (
                        <div className="text-xs text-gray-400 mt-0.5">{c.hint}</div>
                      )}
                    </div>
                    {choosing === idx && (
                      <span className="text-xs text-gray-500 ml-2">...</span>
                    )}
                  </Button>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key="outcome"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="bg-white/5 border-cyan-500/20">
              <CardHeader>
                <CardTitle className="text-base text-cyan-400">결과</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-200 leading-relaxed">{outcomeText}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {chosen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-auto">
          <Button className="w-full" onClick={() => router.push('/run/map')}>
            던전으로 돌아가기
          </Button>
        </motion.div>
      )}
    </main>
  );
}
