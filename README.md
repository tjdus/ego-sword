# 나는 전설의 검이다 (I Am the Ego-Sword)

> 당신은 검이다. 자아를 가진 전설의 검.

웹 기반 모바일 로그라이크 게임. 플레이어는 주인을 섬기는 검(에고소드)의 시점에서, 던전을 탐험하며 진화한다.

---

<!-- 스크린샷: 메인 화면 -->
<img width="630" alt="메인 화면" src="https://github.com/user-attachments/assets/806299c0-a9df-471f-b90e-93ce511d8c8e" />


---

## 목차

- [게임 소개](#게임-소개)
- [AI 활용 설계](#ai-활용-설계)
  - [주인 캐릭터 생성](#1-주인-캐릭터-생성)
  - [이벤트 룸 생성](#2-이벤트-룸-생성)
  - [유니크 아이템 생성](#3-유니크-아이템-생성)
  - [런 종료 내러티브](#4-런-종료-내러티브)
  - [AI 안전 설계](#ai-안전-설계)
- [기술 스택](#기술-스택)
- [아키텍처](#아키텍처)
- [게임 시스템](#게임-시스템)
- [실행 방법](#실행-방법)

---

## 게임 소개

- **장르**: 로그라이크 / 텍스트 RPG
- **플랫폼**: 웹 (PWA, 모바일 최적화)
- **시점**: 검(에고소드) — 주인과의 궁합, 지배력(DOM), 안정성(STB)을 키워나가는 것이 핵심

던전 층을 오르며 전투, 이벤트, 상점, 흡수를 거쳐 검을 진화시킨다. 매 런마다 AI가 새로운 주인 인격과 이벤트를 생성해 반복 플레이에도 신선한 경험을 제공한다.

---

<!-- 스크린샷: 지도 화면 -->
<img width="380" alt="지도 화면" src="https://github.com/user-attachments/assets/6b8de1fa-a3c9-4d33-b3f1-10b5302371c2" />

---

## AI 활용 설계

AI는 **텍스트 연출만 담당**한다. 수치·보상·전투 결과는 모두 서버 사이드 룰 기반으로 처리하며, AI 출력이 게임 밸런스에 직접 영향을 줄 수 없다.

- 모델: `claude-haiku-4-5-20251001` (Anthropic)
- 호출 위치: 백엔드 전용 (`AiService`) — 클라이언트에서 직접 AI를 호출하지 않음
- 캐시: SHA-256 키 기반 DB 캐시 (`AiTextCache` 테이블), TTL 만료 시 자동 재생성

### 1. 주인 캐릭터 생성

런 시작 시 클래스(전사/마법사/성기사/도적/사냥꾼/광전사)와 랜덤 스탯을 기반으로 AI가 고유한 주인 인격을 생성한다.

**AI 입력값**
```json
{
  "class": "rogue",
  "rarity": "rare",
  "combatStats": { "atk": 14, "def": 8 },
  "personalityStats": { "pride": 7, "loyalty": 3 },
  "ownerTraits": ["냉소적", "계산적"],
  "floorDepth": 1,
  "swordElement": "fire",
  "compatibilityScore": 42
}
```

**AI 출력값**
```json
{
  "name": "카이든",
  "oneLiner": "그림자 속에서 기회를 본다.",
  "speechStyle": { "tone": "냉소", "quirk": "반말" },
  "combatBarks": {
    "start": "운이 다했네.",
    "lowHp": "아직 끝난 게 아냐.",
    "victory": "쉬웠어."
  },
  "exploreBarks": { "trapFound": "예상했지.", "treasureFound": "잭팟이야." },
  "backstory": "고아원 출신의 전직 첩보원...",
  "swordOpinion": "이 검은... 나를 꿰뚫어 보는 것 같다.",
  "uniqueQuirk": "항상 뒤를 먼저 확인한다"
}
```

<!-- 스크린샷: 주인 정보 화면 -->
<img width="634" height="517" alt="image" src="https://github.com/user-attachments/assets/d161da2f-cf2c-450d-bf35-343f0806491f" />


---

### 2. 이벤트 룸 생성

이벤트 룸 진입 시 현재 검/주인 상태를 바탕으로 AI가 맥락에 맞는 이벤트를 생성한다. 같은 방을 재방문하면 동일한 이벤트가 재사용된다 (`RunRoom.aiEventJson` 저장).

**AI 입력값**
```json
{
  "floor": 7,
  "ownerName": "카이든",
  "ownerClass": "rogue",
  "ownerPersonality": { "pride": 7, "loyalty": 3 },
  "swordElement": "fire",
  "swordTags": ["sharp", "soul"],
  "compatScore": 55,
  "dom": 40,
  "stb": 60
}
```

**AI 출력값**
```json
{
  "title": "불꽃 제단",
  "description": "검에서 새어나온 불꽃이 제단을 감싸고 있다.",
  "choices": [
    { "label": "불꽃을 바친다", "hint": "검의 힘 증폭", "outcomeText": "검날이 붉게 달아올랐다.", "mechanic": "atk_up" },
    { "label": "꺼버린다",    "hint": "안전한 선택",   "outcomeText": "조용해졌다.",              "mechanic": "stb_up" },
    { "label": "흡수한다",    "hint": "위험할 수도",   "outcomeText": "뭔가가 스며들었다.",       "mechanic": "dom_up" }
  ]
}
```

`mechanic` 코드는 서버가 허용 목록(`atk_up`, `stb_up`, `dom_up`, `gold_gain`, `hp_restore`, `tag_fire` 등 15종)에서 검증 후 실제 수치 처리한다. AI가 임의의 효과 코드를 만들어도 무시된다.

<!-- 스크린샷: 이벤트 화면 -->
<table>
  <tr>
    <td align="center">
      <img width="360" alt="이벤트 화면 1" src="https://github.com/user-attachments/assets/e69217d2-c28e-4af3-921c-5161f747dd84" />

    </td>
    <td align="center"><img width="360" alt="이벤트 화면 2" src="https://github.com/user-attachments/assets/9c4a9c6c-6432-4e54-8cb9-160e6fe2f57d" /></td>
  </tr>
</table>


---

### 3. 유니크 아이템 생성

상점마다 AI가 검/주인 상황에 맞는 유니크 아이템 1개를 생성한다. 일반 아이템과 달리 `✦ 유니크` 배지와 AI 생성 lore가 표시된다.

**AI 입력값**
```json
{
  "floor": 5,
  "rarity": "epic",
  "swordElement": "fire",
  "swordTags": ["sharp", "rage"],
  "ownerClass": "berserker",
  "absorbedCount": 3
}
```

**AI 출력값**
```json
{
  "name": "분노의 결정",
  "description": "광전사의 분노가 응결된 파편.",
  "lore": "불꽃은 꺼지지 않는다.",
  "tags": ["rage", "fire"],
  "effectCode": "atk+6"
}
```

`effectCode`는 서버가 파싱해 실제 `ItemEffect`로 변환한다. 허용된 코드 형식(`atk+N`, `def+N`, `dom+N` 등)만 적용되며 그 외는 기본값 처리된다.

<!-- 스크린샷: 상점 화면 -->
<img width="320" alt="상점 화면" src="https://github.com/user-attachments/assets/d3ca4802-562a-4111-8c32-c7c7bc0f2a37" />


---

### 4. 런 종료 내러티브

런 종료 시 검의 여정 전체를 요약한 내러티브와 획득 특성 라벨을 AI가 생성한다.

**AI 입력값**
```json
{
  "floorDepth": 12,
  "killedBy": "체인브레이커",
  "bossReached": true,
  "ownerSummary": "냉소적인 도적 카이든, 7층까지 생존",
  "swordSummary": { "element": "fire", "dom": 70, "stb": 40, "tags": ["sharp", "rage"] },
  "traitCandidates": [{ "traitId": "rage_bloom", "category": "offensive" }]
}
```

**AI 출력값**
```json
{
  "narration": "불꽃은 꺼졌지만, 칼 끝의 분노는 사라지지 않았다.\n카이든은 쓰러졌다. 검은 기억한다.",
  "traitLabels": [{ "traitId": "rage_bloom", "label": "분노의 개화" }]
}
```

---

### AI 안전 설계

| 레이어 | 내용 |
|--------|------|
| **서버 전용 호출** | 클라이언트에서 AI API 직접 호출 없음 |
| **안전 메카닉 코드** | AI 출력의 `mechanic` / `effectCode`를 허용 목록으로 검증 후 처리 |
| **폴백 텍스트** | AI 호출 실패·타임아웃 시 클래스별 하드코딩 폴백으로 즉시 대체 |
| **금칙어 필터** | AI 출력 전체를 금칙어 목록으로 검사, 통과 실패 시 폴백 적용 |
| **DB 캐시** | 동일 입력 조합은 재호출 없이 캐시에서 반환 (비용·지연 감소) |
| **수치 분리** | 공격력·체력·골드 등 모든 수치는 룰 엔진이 단독 결정 |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · PixiJS v8 · Zustand |
| Backend | NestJS · Prisma · PostgreSQL |
| AI | Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) |
| 배포 형태 | PWA (모바일 설치 가능) |

---

## 아키텍처

```
[ 브라우저 / PWA ]
       │  HTTP
       ▼
[ NestJS 백엔드 :3001 ]
  ├─ run.service       ← 런 상태 관리
  ├─ battle.service    ← 전투 계산 (서버 authoritative)
  ├─ event.service     ← 이벤트 처리 + AI 이벤트 조회
  ├─ shop.service      ← 상점 + AI 유니크 아이템
  ├─ ai.service        ← Claude API 호출 · 캐시 · 폴백
  └─ engine/
       ├─ combat.engine.ts   ← 데미지·쉴드·스킬 계산
       ├─ reward.engine.ts   ← 드롭 생성
       ├─ mutation.ts        ← 태그 변이
       └─ trigger.engine.ts  ← 트리거 조건 평가
       │
       ▼
[ PostgreSQL ]
  AiTextCache  ← AI 응답 캐시 (SHA-256 키)
  RunRoom      ← 방별 aiEventJson 저장
  GeneratedItemTemplate ← AI 유니크 아이템
```

---

## 게임 시스템

### 검 스탯

| 스탯 | 설명 |
|------|------|
| ATK | 공격력 |
| DEF | 방어력 |
| DOM | 지배력 — 검이 주인을 얼마나 지배하는가 |
| STB | 안정성 — 검의 자아가 얼마나 안정되었는가 |
| HP / 내구도 | 전투에서 소모되는 자원 |

### 태그 & 변이

스킬에 붙은 태그(`sharp`, `rage`, `soul`, `fire` 등)가 특정 조합을 이루면 런타임에 스킬이 변이한다. 6종의 트리거 조건이 스킬·스탯 보너스를 추가로 부여한다.

### 층 구성

```
전투 → 전투 → 이벤트 → 상점 → 휴식 → (보스) → 다음 층
```

- 스킬 30개 / 아이템 27개 / 태그 변이 10종 / 트리거 6종

<!-- 스크린샷: 전투 화면 -->
<table>
  <tr>
    <td align="center"><img width="380" alt="전투 화면 1" src="https://github.com/user-attachments/assets/94676833-dc67-480d-8905-195030a462db" /></td>
    <td align="center"><img width="360" alt="전투 화면 2" src="https://github.com/user-attachments/assets/14f78eb3-890b-4857-96c1-9d848fcc8f63" /></td>
  </tr>
</table>

---

## 실행 방법

### 환경 변수

```bash
# backend/.env
DATABASE_URL="postgresql://user:pass@localhost:5432/ego_sword"
ANTHROPIC_API_KEY="sk-ant-..."

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 실행

```bash
# 1. DB 마이그레이션 & 시드 (최초 1회)
cd backend
npx prisma migrate dev --name init
npm run prisma:seed

# 2. 백엔드 실행
npm run start:dev

# 3. 프론트엔드 실행 (새 터미널)
cd frontend
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

---

<img width="360" alt="도감" src="https://github.com/user-attachments/assets/1b6430eb-5a7a-4eee-9b85-dba0451142e8" />

