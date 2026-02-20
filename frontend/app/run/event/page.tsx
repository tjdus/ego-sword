'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRunStore } from '@/store/runStore';
import { api } from '@/lib/api';

interface EventChoice {
  index: number;
  label: string;
  hint?: string;
}

interface EventData {
  eventId: string;
  title: string;
  description: string;
  choices: EventChoice[];
}

const DEFAULT_EVENT: EventData = {
  eventId: 'event_mystery',
  title: '낡은 제단',
  description: '어둠 속에 낡은 제단이 있다. 뭔가를 원하는 것 같다.',
  choices: [
    { index: 0, label: '봉납한다', hint: '검을 바친다' },
    { index: 1, label: '무시한다', hint: '그냥 지나친다' },
  ],
};

export default function EventPage() {
  const router = useRouter();
  const { runId, currentRoom } = useRunStore();
  const [eventData, setEventData] = useState<EventData>(DEFAULT_EVENT);
  const [chosen, setChosen] = useState(false);
  const [outcome, setOutcome] = useState<{ text: string; tag?: string } | null>(null);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    if (currentRoom?.roomType === 'event') {
      // 이벤트 데이터는 서버에서 enterRoom 결과로 받아야 하나 현재는 기본값 사용
      // 실제 구현 시: enterRoom 결과를 store에 저장하거나 여기서 API 재호출
    }
  }, [currentRoom]);

  async function choose(choiceIndex: number) {
    if (!runId || chosen) return;
    setChoosing(true);
    try {
      const res = await api.run.chooseEvent(runId, eventData.eventId, choiceIndex);
      setOutcome({ text: res.outcome.text, tag: res.outcome.tag });
      setChosen(true);
    } catch {
      setOutcome({ text: '이벤트 처리 중 오류가 발생했습니다.' });
      setChosen(true);
    } finally {
      setChoosing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0B0E14] text-white p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">❓</span>
        <h1 className="text-xl font-bold">{eventData.title}</h1>
        <Badge variant="outline" className="ml-auto">이벤트</Badge>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="pt-4">
          <p className="text-sm text-gray-300 leading-relaxed">{eventData.description}</p>
        </CardContent>
      </Card>

      {!chosen ? (
        <div className="flex flex-col gap-2">
          {eventData.choices.map((c) => (
            <Button
              key={c.index}
              variant="outline"
              className="w-full text-left justify-start min-h-14 border-white/20 hover:bg-white/10"
              onClick={() => choose(c.index)}
              disabled={choosing}
            >
              <div>
                <div className="font-semibold">{c.label}</div>
                {c.hint && <div className="text-xs text-gray-400 mt-0.5">{c.hint}</div>}
              </div>
            </Button>
          ))}
        </div>
      ) : (
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-base">결과</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-200 leading-relaxed">{outcome?.text}</p>
          </CardContent>
        </Card>
      )}

      {chosen && (
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
