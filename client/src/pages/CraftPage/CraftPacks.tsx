import { useEffect, useRef, useState } from 'react';
import Button from '../../components/ui/Button';
import { formatMoney } from '../../utils/money';

const PACKS = [
  {
    item: 'craft_rare', title: 'Рунный набор', vkPrice: 14, rubPrice: 99,
    material: 'Сердцевина бездны ×5', materialImg: '/fragment/fragment_purple.webp',
    stones: 'Рунный булыжник ×6', stoneImg: '/stone/stoneUpgrade_gray.webp',
    silver: 10000,
    desc: 'Материалы для крафта случайного эпического предмета (шанс 70%). +10 000 в банк',
  },
  {
    item: 'craft_epic', title: 'Большой рунный набор', vkPrice: 28, rubPrice: 199,
    material: 'Искра погибели ×5', materialImg: '/fragment/fragment_yellow.webp',
    stones: 'Рунный булыжник ×10', stoneImg: '/stone/stoneUpgrade_gray.webp',
    silver: 30000,
    desc: 'Материалы для крафта случайного легендарного предмета (шанс 65%). +30 000 в банк',
  },
  {
    item: 'craft_rare_200', title: 'Рунный набор ×200', vkPrice: 2800, rubPrice: 19999,
    craft: true, silver: 2000000,
    material: 'Сердцевина бездны ×1000', materialImg: '/fragment/fragment_purple.webp',
    stones: 'Рунный булыжник ×1200', stoneImg: '/stone/stoneUpgrade_gray.webp',
    desc: '1000 сердцевин + 1200 булыжников + 2M в банк',
  },
  {
    item: 'ruby_rune_1', title: 'Набор рун', vkPrice: 57, rubPrice: 399,
    rune: true, count: 1, runeImgs: [
      { img: '/stone/stoneUpgrade_red.webp', label: 'Рубина +50%' },
      { img: '/stone/stoneUpgrade_yellow.webp', label: 'Топаза +30%' },
      { img: '/stone/stoneUpgrade_purple.webp', label: 'Аметиста +20%' },
    ],
    desc: 'Руны для улучшения предметов',
  },
  {
    item: 'ruby_rune_3', title: 'Набор рун ×3', vkPrice: 144, rubPrice: 999,
    rune: true, count: 3, runeImgs: [
      { img: '/stone/stoneUpgrade_red.webp', label: 'Рубина +50%' },
      { img: '/stone/stoneUpgrade_yellow.webp', label: 'Топаза +30%' },
      { img: '/stone/stoneUpgrade_purple.webp', label: 'Аметиста +20%' },
    ],
    desc: 'Руны для улучшения предметов',
  },
  {
    item: 'ruby_rune_5', title: 'Набор рун ×5', vkPrice: 214, rubPrice: 1499,
    rune: true, count: 5, runeImgs: [
      { img: '/stone/stoneUpgrade_red.webp', label: 'Рубина +50%' },
      { img: '/stone/stoneUpgrade_yellow.webp', label: 'Топаза +30%' },
      { img: '/stone/stoneUpgrade_purple.webp', label: 'Аметиста +20%' },
    ],
    desc: 'Руны для улучшения предметов',
  },
  {
    item: 'curse_small', title: 'Сундук «Проклятый»', vkPrice: 144, rubPrice: 999,
    curse: true, crystals: 5, crystalImg: '/uploads/admin/craft/1785150034070_yyqrol.webp',
    silver: 500000,
    desc: '5 Кристаллов душ для проклятия предметов. +500 000 в банк',
  },
  {
    item: 'curse_large', title: 'Сундук «Проклятый II»', vkPrice: 258, rubPrice: 1799,
    curse: true, crystals: 10, crystalImg: '/uploads/admin/craft/1785150034070_yyqrol.webp',
    silver: 1000000,
    desc: '10 Кристаллов душ для проклятия предметов. +1 000 000 в банк',
  },
  {
    item: 'curse_x50', title: 'Сундук «Проклятый III»', vkPrice: 1149, rubPrice: 7999,
    curse: true, crystals: 50, crystalImg: '/uploads/admin/craft/1785150034070_yyqrol.webp',
    silver: 5000000,
    desc: '50 Кристаллов душ для проклятия предметов. +5 000 000 в банк',
  },
  {
    item: 'curse_x100', title: 'Сундук «Проклятый IV»', vkPrice: 2149, rubPrice: 14999,
    curse: true, crystals: 100, crystalImg: '/uploads/admin/craft/1785150034070_yyqrol.webp',
    silver: 10000000,
    desc: '100 Кристаллов душ для проклятия предметов. +10 000 000 в банк',
  },
  {
    item: 'large_craft', title: 'Большой набор ремесленника', vkPrice: 7500, rubPrice: 52999,
    mega: true, silver: 10000000, count: 100,
    runeImgs: [
      { img: '/stone/stoneUpgrade_red.webp', label: 'Рубина' },
      { img: '/stone/stoneUpgrade_yellow.webp', label: 'Топаза' },
      { img: '/stone/stoneUpgrade_purple.webp', label: 'Аметиста' },
    ],
    extraItems: 'Сапфира, Изумруда, Рунный булыжник, Рунный белокамень',
    materials: [
      { img: '/fragment/fragment_purple.webp', label: 'Сердцевина' },
      { img: '/fragment/fragment_yellow.webp', label: 'Искра' },
      { img: '/fragment/fragment_red.webp', label: 'Слеза' },
    ],
    extraMaterials: 'Пыль забвения, Осколок скорби, Фрагмент ужаса, Эссенция мрака',
    desc: '7 рун ×100 + 7 материалов ×100 + 10M в банк',
  },
  {
    item: 'mega_craft', title: 'Мега набор ремесленника', vkPrice: 11000, rubPrice: 79999,
    mega: true, silver: 20000000, count: 200,
    runeImgs: [
      { img: '/stone/stoneUpgrade_red.webp', label: 'Рубина' },
      { img: '/stone/stoneUpgrade_yellow.webp', label: 'Топаза' },
      { img: '/stone/stoneUpgrade_purple.webp', label: 'Аметиста' },
    ],
    extraItems: 'Сапфира, Изумруда, Рунный булыжник, Рунный белокамень',
    materials: [
      { img: '/fragment/fragment_purple.webp', label: 'Сердцевина' },
      { img: '/fragment/fragment_yellow.webp', label: 'Искра' },
      { img: '/fragment/fragment_red.webp', label: 'Слеза' },
    ],
    extraMaterials: 'Пыль забвения, Осколок скорби, Фрагмент ужаса, Эссенция мрака',
    desc: '7 рун ×200 + 7 материалов ×200 + 20M в банк',
  },
];

export default function CraftPacks({ isVK }: { isVK: boolean }) {
  const [packMsg, setPackMsg] = useState('');
  const [packBuying, setPackBuying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' });
  };

  const buyPack = (pack: typeof PACKS[number]) => {
    if (isVK) {
      setPackBuying(true);
      (window as any).vkBridge?.send('VKWebAppShowOrderBox', { type: 'item', item: pack.item })
      .then((data: any) => {
        if (data?.status === 'cancelled') { setPackBuying(false); return; }
        setPackMsg('Оплата открыта. Материалы поступят в инвентарь, серебро — в банк.');
      })
      .catch(() => setPackBuying(false));
    } else {
      setPackBuying(true);
      fetch('/api/yukassa/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ item: pack.item }),
      })
      .then(r => r.json())
      .then(data => {
        if (data.confirmation_url) {
          window.open(data.confirmation_url, '_blank');
          setPackMsg('Оплата открыта. Материалы поступят в инвентарь, серебро — в банк.');
        } else {
          setPackMsg('❌ ' + (data.error || 'Ошибка'));
        }
      })
      .catch(() => setPackMsg('❌ Ошибка сети'))
      .finally(() => setPackBuying(false));
    }
  };

  useEffect(() => {
    const handler = () => {
      setPackMsg('✅ Материалы добавлены в инвентарь!');
      setPackBuying(false);
    };
    window.addEventListener('paymentStatus', handler);
    return () => window.removeEventListener('paymentStatus', handler);
  }, []);

  return (
    <div className="mb-4">
      <div className="relative">
        <button onClick={() => scroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-[var(--color-bg-secondary)]/90 text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] flex items-center justify-center text-xs cursor-pointer shadow-md">◀</button>
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2 px-4 snap-x snap-mandatory scrollbar-none">
      {PACKS.map(p => {
        const borderColor = p.curse ? '#e74c3c' : p.mega ? '#f39c12' : p.rune ? '#c0392b' : p.item === 'craft_rare' ? '#3498db' : '#9b59b6';
        return (
        <div key={p.item} className="rounded-xl p-3 border-2 bg-[var(--color-bg-card)] flex flex-col flex-shrink-0 w-[220px] snap-start"
          style={{ borderColor }}>
          <h3 className="font-bold text-sm mb-1 truncate">{p.title}</h3>
          <div className="text-xs text-[var(--color-text-muted)] space-y-1 mb-2 flex-1">
            {'curse' in p ? (
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 flex-shrink-0 bg-[var(--color-bg-input)] rounded flex items-center justify-center">
                  <img src={`https://mmoarena.ru${p.crystalImg}`} alt="" className="w-4 h-4 object-contain" />
                </div>
                Кристалл душ ×{p.crystals}
              </div>
            ) : 'mega' in p ? (
              <div className="space-y-1">
                <p className="font-semibold text-[0.65rem]">Руны ×{p.count}:</p>
                <div className="flex flex-wrap gap-1">
                  {p.runeImgs?.map((r: { img: string; label: string }, i: number) => (
                    <div key={i} className="w-5 h-5 bg-[var(--color-bg-input)] rounded flex items-center justify-center" title={r.label}>
                      <img src={`https://mmoarena.ru${r.img}`} alt="" className="w-3.5 h-3.5 object-contain" />
                    </div>
                  ))}
                  <span className="text-[0.6rem] text-[var(--color-text-muted)]">+4</span>
                </div>
                <p className="font-semibold text-[0.65rem]">Материалы ×{p.count}:</p>
                <div className="flex flex-wrap gap-1">
                  {p.materials?.map((m: { img: string; label: string }, i: number) => (
                    <div key={i} className="w-5 h-5 bg-[var(--color-bg-input)] rounded flex items-center justify-center" title={m.label}>
                      <img src={`https://mmoarena.ru${m.img}`} alt="" className="w-3.5 h-3.5 object-contain" />
                    </div>
                  ))}
                  <span className="text-[0.6rem] text-[var(--color-text-muted)]">+4</span>
                </div>
              </div>
            ) : 'rune' in p ? (
              <div className="space-y-1">
                {p.runeImgs?.map((r: { img: string; label: string }, i: number) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-5 h-5 flex-shrink-0 bg-[var(--color-bg-input)] rounded flex items-center justify-center">
                      <img src={`https://mmoarena.ru${r.img}`} alt="" className="w-4 h-4 object-contain" />
                    </div>
                    <span>{r.label} ×{p.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 flex-shrink-0 bg-[var(--color-bg-input)] rounded flex items-center justify-center">
                    <img src={`https://mmoarena.ru${p.materialImg}`} alt="" className="w-4 h-4 object-contain" />
                  </div>
                  {p.material}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 flex-shrink-0 bg-[var(--color-bg-input)] rounded flex items-center justify-center">
                    <img src={`https://mmoarena.ru${p.stoneImg}`} alt="" className="w-4 h-4 object-contain" />
                  </div>
                  {p.stones}
                </div>
              </>
            )}
            {'silver' in p && <p>💰 {formatMoney(p.silver)}</p>}
            <p className="text-[0.6rem] italic">{p.desc}</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[var(--color-accent-gold)]">
              {isVK ? `${p.vkPrice} голосов` : `${p.rubPrice} ₽`}
            </span>
            <Button variant="danger" size="md" disabled={packBuying}
              onClick={() => buyPack(p)}>
              {isVK ? '🛒' : '💳'} Купить
            </Button>
          </div>
        </div>
      );
      })}
      </div>
        <button onClick={() => scroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-[var(--color-bg-secondary)]/90 text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] flex items-center justify-center text-xs cursor-pointer shadow-md">▶</button>
      </div>
      {packMsg && (
        <div className="w-full text-center text-sm font-bold mt-2"
          style={{ color: packMsg.startsWith('✅') ? 'var(--color-accent-success)' : packMsg.startsWith('❌') ? 'var(--color-accent-danger)' : 'var(--color-accent-info)' }}>
          {packMsg}
        </div>
      )}
    </div>
  );
}
