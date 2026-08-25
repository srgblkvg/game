export interface AuctionSearchResult {
  text: string;
  stats: Record<string, number>;
  category: string;
}

const STAT_KEYWORDS: Record<string, string> = {
  'сила': 'minStr', 'силы': 'minStr',
  'ловкость': 'minAgi', 'ловкости': 'minAgi',
  'защита': 'minDef', 'защиты': 'minDef',
  'крит': 'minCrit', 'крита': 'minCrit',
  'уклон': 'minDodge', 'уклонения': 'minDodge',
  'контратака': 'minCounter', 'контратаки': 'minCounter',
  'блок': 'minBlock', 'блока': 'minBlock',
  'мастерство': 'minMag', 'мастерства': 'minMag',
};

const SLOT_KEYWORDS: Record<string, string> = {
  'оружие': 'weapon', 'меч': 'weapon', 'топор': 'weapon', 'копьё': 'weapon', 'копье': 'weapon', 'лук': 'weapon', 'посох': 'weapon',
  'щит': 'shield',
  'нагрудник': 'chest', 'броня': 'chest', 'кираса': 'chest', 'доспех': 'chest',
  'шлем': 'helmet', 'капюшон': 'helmet',
  'перчатки': 'gloves', 'рукавицы': 'gloves',
  'сапоги': 'boots', 'ботинки': 'boots',
  'кольцо': 'ring', 'кольца': 'ring',
  'амулет': 'amulet',
  'пояс': 'belt', 'ремень': 'belt',
  'материал': 'material', 'материалы': 'material', 'ресурс': 'material',
  'улучшение': 'upgrade', 'камень': 'upgrade', 'камни': 'upgrade',
};

function matchPrefix(token: string, dictionary: Record<string, string>): string | undefined {
  if (dictionary[token]) return dictionary[token];
  for (const [key, value] of Object.entries(dictionary)) {
    if (key.startsWith(token)) return value;
  }
  return undefined;
}

export function parseAuctionSearch(query: string): AuctionSearchResult {
  const stats: Record<string, number> = {};
  let category = 'all';
  const textParts: string[] = [];

  for (const token of query.toLowerCase().split(/\s+/).filter(Boolean)) {
    const statField = matchPrefix(token, STAT_KEYWORDS);
    const slotField = matchPrefix(token, SLOT_KEYWORDS);
    if (statField) stats[statField] = 1;
    else if (slotField) category = slotField;
    else textParts.push(token);
  }

  return { text: textParts.join(' '), stats, category };
}

export { SLOT_KEYWORDS, STAT_KEYWORDS };
