import { useState } from 'react';
import { getHeaders } from '../api/helpers';

const CTX_OPTIONS = [
    { value: 'arena', label: 'PvP / Арена' },
    { value: 'tournament', label: 'Турнир' },
    { value: 'pve', label: 'PvE (мобы)' },
    { value: 'war_attack', label: 'Война гильдий — атака' },
    { value: 'war_defense', label: 'Война гильдий — защита' },
];

const STAT_ORDER = ['s', 'a', 'd', 'm'];

export default function DebugStatsPage() {
    const [username, setUsername] = useState('');
    const [context, setContext] = useState('arena');
    const [drink, setDrink] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState('');

    const check = async () => {
        if (!username.trim()) return;
        setLoading(true);
        setError('');
        setData(null);
        try {
            const res = await fetch('/api/debug/stats', {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ username: username.trim(), context, drink: drink || undefined }),
            });
            const d = await res.json();
            if (!res.ok) { setError(d.error || 'Ошибка'); return; }
            setData(d);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const calcDelta = (full: number, raw: number) => {
        const d = full - raw;
        if (d === 0) return null;
        return d > 0 ? `+${d}` : `${d}`;
    };

    return (
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '1rem 0' }}>
            <h1 className="text-lg font-bold mb-2">Отладка статов и бонусов</h1>
            <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] rounded p-2 mb-4">
                Введите ник персонажа и выберите режим боя. Показываются чистые статы (база + экипировка, без бонусов)
                и полные статы с бонусами (напитки, коллекция, гильдия) для выбранного режима.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
                <input
                    className="flex-1 min-w-[120px] px-3 py-2 rounded bg-[var(--color-bg-input)] border border-[var(--color-border-default)] text-sm"
                    placeholder="Ник персонажа"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && check()}
                />
                <select
                    className="px-2 py-2 rounded bg-[var(--color-bg-input)] border border-[var(--color-border-default)] text-sm"
                    value={context}
                    onChange={e => setContext(e.target.value)}
                >
                    {CTX_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                {data?.availableDrinks && (
                    <select
                        className="px-2 py-2 rounded bg-[var(--color-bg-input)] border border-[var(--color-border-default)] text-sm max-w-[200px]"
                        value={drink}
                        onChange={e => { setDrink(e.target.value); }}
                    >
                        <option value="">Напиток: актуальный</option>
                        {data.availableDrinks.map((d: any) => (
                            <option key={d.key} value={d.key}>{d.name}</option>
                        ))}
                    </select>
                )}
                <button
                    className="px-4 py-2 rounded bg-[var(--color-accent-info)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                    onClick={check}
                    disabled={loading || !username.trim()}
                >
                    {loading ? '...' : 'Проверить'}
                </button>
            </div>

            {error && <p className="text-[var(--color-accent-danger)] text-sm mb-4">{error}</p>}

            {data && (
                <div className="space-y-4">
                    {/* Заголовок */}
                    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded p-3">
                        <div className="flex justify-between items-center">
                            <span className="font-bold">{data.username} <span className="text-[var(--color-text-muted)]">ур. {data.level}</span></span>
                            <span className="text-xs text-[var(--color-text-muted)]">{data.contextLabel}</span>
                        </div>
                        {data.guildName && (
                            <p className="text-xs text-[var(--color-accent-warning)] mt-1">Гильдия: {data.guildName}</p>
                        )}
                    </div>

                    {/* Чистые статы */}
                    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded p-3">
                        <h3 className="text-sm font-bold mb-2">Чистые статы (база + экипировка)</h3>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-[var(--color-text-muted)] text-xs">
                                    <th className="text-left py-1">Стат</th>
                                    <th className="text-right py-1">База</th>
                                    <th className="text-right py-1">Экип</th>
                                    <th className="text-right py-1">Сумма</th>
                                </tr>
                            </thead>
                            <tbody>
                                {STAT_ORDER.map(k => (
                                    <tr key={k} className="border-t border-[var(--color-border-default)]">
                                        <td className="py-1">{data.statNames[k]}</td>
                                        <td className="text-right py-1">{data.raw.base[k]}</td>
                                        <td className="text-right py-1 text-[var(--color-accent-success)]">{data.raw.equipment[k] > 0 ? `+${data.raw.equipment[k]}` : data.raw.equipment[k]}</td>
                                        <td className="text-right py-1 font-bold">{data.raw.base[k] + data.raw.equipment[k]}</td>
                                    </tr>
                                ))}
                                <tr className="border-t border-[var(--color-border-default)]">
                                    <td className="py-1 font-bold">HP</td>
                                    <td colSpan={2}></td>
                                    <td className="text-right py-1 font-bold">{data.raw.hp}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Бонусы */}
                    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded p-3">
                        <h3 className="text-sm font-bold mb-2">Бонусы для режима «{data.contextLabel}»</h3>
                        <div className="flex gap-3 text-sm">
                            <div className="flex-1 bg-[var(--color-bg-input)] rounded p-2 text-center">
                                <div className="text-[var(--color-text-muted)] text-xs">Напитки {data.selectedDrink && data.selectedDrink !== data.activeDrink ? '(выбрано)' : data.activeDrink ? '(акт.)' : ''}</div>
                                <div className="font-bold">{STAT_ORDER.map(k => {
                                    const v = data.bonuses.drinks[k];
                                    return v ? `${data.statNames[k]}: +${v}` : null;
                                }).filter(Boolean).join(', ') || '—'}</div>
                            </div>
                            <div className="flex-1 bg-[var(--color-bg-input)] rounded p-2 text-center">
                                <div className="text-[var(--color-text-muted)] text-xs">Коллекция</div>
                                <div className="font-bold">+{data.bonuses.collection}%</div>
                            </div>
                            <div className="flex-1 bg-[var(--color-bg-input)] rounded p-2 text-center">
                                <div className="text-[var(--color-text-muted)] text-xs">Гильдия</div>
                                <div className={`font-bold ${data.bonuses.guild > 0 ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-text-muted)]'}`}>
                                    {data.bonuses.guild > 0 ? `+${data.bonuses.guild}%` : '0%'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Постройки гильдии */}
                    {data.buildings && data.buildings.length > 0 && (
                        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded p-3">
                            <h3 className="text-sm font-bold mb-2">Постройки гильдии ({data.guildName})</h3>
                            <div className="space-y-1">
                                {data.buildings.map((b: any) => {
                                    const active = b.appliesTo.includes(context);
                                    return (
                                        <div key={b.type} className={`flex justify-between items-center text-xs px-2 py-1 rounded ${active ? 'bg-[var(--color-accent-success)]/10 border border-[var(--color-accent-success)]/30' : 'bg-[var(--color-bg-input)]'}`}>
                                            <span>{b.name}</span>
                                            <span>
                                                ур. {b.level} — <span className={active ? 'text-[var(--color-accent-success)] font-bold' : 'text-[var(--color-text-muted)]'}>+{b.bonus}%</span>
                                                {active && <span className="ml-1 text-[0.6rem] text-[var(--color-accent-success)]">✓</span>}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Полные статы */}
                    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded p-3">
                        <h3 className="text-sm font-bold mb-2">Полные статы (все бонусы)</h3>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-[var(--color-text-muted)] text-xs">
                                    <th className="text-left py-1">Стат</th>
                                    <th className="text-right py-1">Чистый</th>
                                    <th className="text-right py-1">Полный</th>
                                    <th className="text-right py-1">Δ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {STAT_ORDER.map(k => {
                                    const raw = data.raw.base[k] + data.raw.equipment[k];
                                    const full = data.full.stats[k];
                                    const delta = calcDelta(full, raw);
                                    return (
                                        <tr key={k} className="border-t border-[var(--color-border-default)]">
                                            <td className="py-1">{data.statNames[k]}</td>
                                            <td className="text-right py-1">{raw}</td>
                                            <td className="text-right py-1 font-bold">{full}</td>
                                            <td className={`text-right py-1 ${delta ? (full > raw ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-accent-danger)]') : 'text-[var(--color-text-muted)]'}`}>
                                                {delta || '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="border-t border-[var(--color-border-default)]">
                                    <td className="py-1 font-bold">HP</td>
                                    <td className="text-right py-1">{data.raw.hp}</td>
                                    <td className="text-right py-1 font-bold">{data.full.hp}</td>
                                    <td className={`text-right py-1 ${data.full.hp > data.raw.hp ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-text-muted)]'}`}>
                                        {data.full.hp !== data.raw.hp ? `+${data.full.hp - data.raw.hp}` : '—'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Extra stats */}
                    {data.raw.extra && (
                        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded p-3">
                            <h3 className="text-sm font-bold mb-2">Extra-статы</h3>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[var(--color-text-muted)] text-xs">
                                        <th className="text-left py-1">Параметр</th>
                                        <th className="text-right py-1">Чистый</th>
                                        <th className="text-right py-1">С бонусами</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(data.raw.extra).map(([k, v]) => (
                                        <tr key={k} className="border-t border-[var(--color-border-default)]">
                                            <td className="py-1 capitalize">{k}</td>
                                            <td className="text-right py-1">{v as number}</td>
                                            <td className="text-right py-1">{data.full.extra[k]}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
