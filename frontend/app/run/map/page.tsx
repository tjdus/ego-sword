"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Sword,
  Star,
  Package,
  Coffee,
  AlertTriangle,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api, type RoomData } from "@/lib/api";
import { useRunStore } from "@/store/runStore";

const ROOM_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  battle: {
    label: "전투",
    icon: <Sword className="w-4 h-4" />,
    color: "#EF4444",
  },
  elite: {
    label: "엘리트",
    icon: <Star className="w-4 h-4" />,
    color: "#EAB308",
  },
  event: {
    label: "이벤트",
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "#06B6D4",
  },
  shop: {
    label: "상점",
    icon: <Package className="w-4 h-4" />,
    color: "#22C55E",
  },
  rest: {
    label: "휴식",
    icon: <Coffee className="w-4 h-4" />,
    color: "#94A3B8",
  },
  boss: {
    label: "보스",
    icon: <Crown className="w-4 h-4" />,
    color: "#A855F7",
  },
};

export default function DungeonMapPage() {
  const router = useRouter();
  const {
    runId,
    floorMap,
    setCurrentRoom,
    setEnemyState,
    setSwordState,
    setOwnerState,
    setFloorMap,
    ownerState,
    swordState,
    currentFloor,
  } = useRunStore();

  useEffect(() => {
    if (!runId) { router.replace("/"); return; }
    api.run.getMap(runId, currentFloor).then(setFloorMap);
  }, [runId, currentFloor]);

  const enterMutation = useMutation({
    mutationFn: (roomId: string) => api.run.enterRoom(runId!, roomId),
    onSuccess: (result, roomId) => {
      const room = floorMap.find((r) => r.id === roomId);
      if (room) setCurrentRoom(room);

      console.log("Entered room result:", result); // 디버깅용 로그

      // enterRoom 결과로 받은 상태를 스토어에 저장
      if (result.enemyState) setEnemyState(result.enemyState);
      if (result.swordState) setSwordState(result.swordState);
      if (result.ownerState) setOwnerState(result.ownerState);

      if (
        result.roomType === "battle" ||
        result.roomType === "elite" ||
        result.roomType === "boss"
      ) {
        router.push("/run/battle");
      } else if (result.roomType === "rest") {
        router.push("/run/rest");
      } else if (result.roomType === "event") {
        router.push("/run/event");
      } else if (result.roomType === "shop") {
        router.push("/run/shop");
      }
    },
  });

  const availableRooms = floorMap.filter((r) => r.status === "available");
  const completedCount = floorMap.filter(
    (r) => r.status === "completed",
  ).length;
  const totalRooms = floorMap.length;

  return (
    <div className="flex flex-col min-h-screen p-4 gap-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-6 pb-2"
      >
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
          던전 지도
        </p>
        <h1 className="text-xl font-bold">{currentFloor}층 탐험 중</h1>
        <div className="mt-2 flex items-center gap-3">
          <Progress
            value={(completedCount / totalRooms) * 100}
            className="flex-1 h-1.5"
          />
          <span className="text-xs text-muted-foreground shrink-0">
            {completedCount}/{totalRooms}
          </span>
        </div>
      </motion.div>

      {/* 상태 요약 */}
      {ownerState && swordState && (
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-3 border-white/10 bg-white/5 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">
              {ownerState.name}
            </p>
            <Progress
              value={(ownerState.hp / ownerState.hpMax) * 100}
              className="h-1.5 mb-1"
            />
            <p className="text-xs">
              {ownerState.hp} / {ownerState.hpMax} HP
            </p>
          </Card>
          <Card className="p-3 border-white/10 bg-white/5 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">검 상태</p>
            <div className="flex gap-2 text-xs">
              <span>
                SYNC {swordState.sync}/{swordState.syncMax}
              </span>
              <span>STB {swordState.stb}</span>
              {swordState.dom > 0 && (
                <span className="text-purple-400">DOM {swordState.dom}</span>
              )}
            </div>
            {swordState.isMagicSword && (
              <Badge className="mt-1 text-xs bg-purple-500/20 text-purple-300 border-purple-500/30">
                마검
              </Badge>
            )}
          </Card>
        </div>
      )}

      {/* 방 목록 */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xs text-muted-foreground uppercase tracking-wider">
          선택 가능한 방
        </h2>
        {availableRooms.length === 0 ? (
          <Card className="p-4 border-white/10 bg-white/5 text-center text-sm text-muted-foreground">
            이 층의 모든 방을 완료했다.
          </Card>
        ) : (
          availableRooms.map((room, i) => {
            const config = ROOM_CONFIG[room.roomType] ?? ROOM_CONFIG["battle"];
            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Card
                  className="p-4 rounded-2xl border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20 cursor-pointer transition-all duration-200"
                  onClick={() =>
                    !enterMutation.isPending && enterMutation.mutate(room.id)
                  }
                  style={{ borderLeft: `3px solid ${config.color}` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div style={{ color: config.color }}>{config.icon}</div>
                      <div>
                        <p className="font-medium text-sm">{config.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {room.position}번 방
                          {room.roomType === "boss" ? " — 보스 도전" : ""}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{
                        borderColor: config.color + "44",
                        color: config.color,
                      }}
                    >
                      {config.label}
                    </Badge>
                  </div>
                </Card>
              </motion.div>
            );
          })
        )}

        {/* 완료된 방 */}
        {floorMap
          .filter((r) => r.status === "completed")
          .map((room) => {
            const config = ROOM_CONFIG[room.roomType] ?? ROOM_CONFIG["battle"];
            return (
              <div
                key={room.id}
                className="flex items-center gap-3 px-4 py-2 opacity-40 text-sm"
              >
                <div style={{ color: config.color }}>{config.icon}</div>
                <span className="text-muted-foreground line-through">
                  {config.label} 완료
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
