export const ELEMENT_COLOR: Record<string, string> = {
  fire:    '#EF4444',
  water:   '#3B82F6',
  ice:     '#06B6D4',
  thunder: '#EAB308',
  wind:    '#22C55E',
  poison:  '#A855F7',
  light:   '#F59E0B',
  dark:    '#6B7280',
  neutral: '#94A3B8',
};

export const ELEMENT_LABEL: Record<string, string> = {
  fire:    '불',
  water:   '물',
  ice:     '얼음',
  thunder: '번개',
  wind:    '바람',
  poison:  '독',
  light:   '빛',
  dark:    '어둠',
  neutral: '무속성',
};

export const CLASS_LABEL: Record<string, string> = {
  warrior:   '검사',
  mage:      '마법사',
  paladin:   '성기사',
  rogue:     '도적',
  hunter:    '사냥꾼',
  berserker: '광전사',
};

export const RARITY_LABEL: Record<string, string> = {
  common: '일반',
  rare:   '희귀',
  epic:   '영웅',
};

export const RARITY_COLOR: Record<string, string> = {
  common: '#94A3B8',
  rare:   '#3B82F6',
  epic:   '#A855F7',
};

export const CATEGORY_LABEL: Record<string, string> = {
  attribute:   '속성',
  combat:      '전투',
  explore:     '탐험',
  domination:  '지배',
};

export function getElementClass(element: string): string {
  return `card-glow-${element}`;
}
