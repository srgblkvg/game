1|import { useEffect, useState } from 'react';
2|import { useNavigate } from 'react-router-dom';
3|import { Icon } from '@iconify/react';
4|import { fetchRating } from '../api/character';
5|import { getHeaders, BASE_URL } from '../api/helpers';
6|import GuildTag from './GuildTag';
7|
8|export default function RatingBlock() {
9|    const [players, setPlayers] = useState<any[]>([]);
10|    const [guilds, setGuilds] = useState<any[]>([]);
11|    const navigate = useNavigate();
12|
13|    useEffect(() => {
14|        fetchRating(1, 5).then(data => setPlayers(data.users)).catch(console.error);
15|    }, []);
16|
17|    useEffect(() => {
18|        fetch(`${BASE_URL}/guild/list`, { headers: getHeaders() })
19|            .then(res => res.json())
20|            .then(data => setGuilds((data || []).slice(0, 5)))
21|            .catch(console.error);
22|    }, []);
23|
24|    const trophy = <Icon icon="game-icons:trophy" width="18" height="18" />;
25|    const castle = <Icon icon="game-icons:castle" width="18" height="18" />;
26|
27|    return (
28|        <div className="flex flex-col gap-4">
29|            {/* Рейтинг гильдий */}
30|            <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl pt-5 pb-4 px-4 min-w-[210px] relative">
31|                <h3
32|                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 bg-[var(--color-bg-secondary)] text-[var(--color-accent-success)] text-base font-bold cursor-pointer flex items-center gap-1 whitespace-nowrap"
33|                    onClick={() => navigate('/guild/rating')}
34|                >
35|                    {castle} Рейтинг гильдий
36|                </h3>
37|                {guilds.length === 0 ? (
38|                    <p className="text-[var(--color-text-muted)] text-sm">Пока пусто</p>
39|                ) : (
40|                    <ul className="list-none p-0 m-0">
41|                        {guilds.map((g, i) => (
42|                            <li key={g.id} className="flex py-1 border-b border-[var(--color-border-light)] text-sm">
43|                                <span
44|                                    onClick={() => navigate(`/guild/${g.id}`)}
45|                                    className="cursor-pointer text-[var(--color-text-primary)] hover:text-[var(--color-accent-info)] transition-colors flex-1 truncate"
46|                                >
47|                                    {i + 1}. {g.name}
48|                                </span>
49|                                <span className="text-xs text-[var(--color-text-muted)]">
50|                                    Ур.{g.level} · {g.memberCount} уч.
51|                                </span>
52|                            </li>
53|                        ))}
54|                    </ul>
55|                )}
56|            </div>
57|
58|            {/* Рейтинг игроков */}
59|            {players.length === 0 ? (
60|                <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl pt-5 pb-4 px-4 min-w-[210px] relative">
61|                    <h3 className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 bg-[var(--color-bg-secondary)] text-[var(--color-text-accent)] text-base font-bold cursor-pointer flex items-center gap-1 whitespace-nowrap" onClick={() => navigate('/rating')}>
62|                        {trophy} Рейтинг игроков
63|                    </h3>
64|                    <p className="text-[var(--color-text-muted)] text-sm">Пока пусто</p>
65|                </div>
66|            ) : (
67|                <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl pt-5 pb-4 px-4 min-w-[210px] relative">
68|                    <h3
69|                        className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 bg-[var(--color-bg-secondary)] text-[var(--color-text-accent)] text-base font-bold cursor-pointer flex items-center gap-1 whitespace-nowrap"
70|                        onClick={() => navigate('/rating')}
71|                    >
72|                        {trophy} Рейтинг игроков
73|                    </h3>
74|                    <ul className="list-none p-0 m-0">
75|                        {players.map((p, i) => (
76|                            <li key={p.id} className="flex py-1 border-b border-[var(--color-border-light)] text-sm items-center">
77|                                <span
78|                                    onClick={(e) => { e.stopPropagation(); navigate(`/profile/${p.id}`); }}
79|                                    className="cursor-pointer text-[var(--color-text-primary)] hover:text-[var(--color-accent-info)] transition-colors truncate w-[36.364%]"
80|                                >
81|                                    {i + 1}. {p.username}
82|                                </span>
83|                                <span className="w-[36.364%]">
84|                                    <GuildTag guildName={p.guildName} guildId={p.guildId} />
85|                                </span>
86|                                <span className="text-xs text-center truncate w-[18.182%]" style={{ color: p.rank?.color }}>
87|                                    {p.rank ? `${p.rank.icon} ${p.rank.name}` : '—'}
88|                                </span>
89|                                <span className="font-bold text-xs text-right w-[9.091%]" style={{ color: p.rank?.color }}>{p.elo}</span>
90|                            </li>
91|                        ))}
92|                    </ul>
93|                </div>
94|            )}
95|        </div>
96|    );
97|}
98|