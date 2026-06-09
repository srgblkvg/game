1|import { useEffect, useState } from 'react';
2|import { useNavigate } from 'react-router-dom';
3|import { Icon } from '@iconify/react';
4|import { getHeaders } from '../api/helpers';
5|import { useAuth } from '../contexts/AuthContext';
6|import { formatMoney } from '../utils/money';
7|
8|interface TournamentInfo {
9|    id: number;
10|    division: string;
11|    type: string;
12|    status: string;
13|    registrationStart: number;
14|    registrationEnd: number;
15|    prizePool: number;
16|    participantCount: number;
17|    entryFee?: number;
18|    name?: string;
19|    minLevel?: number;
20|    maxLevel?: number;
21|    maxPlayers?: number;
22|    myRegistration: { userId: number; goldenTicket: number; snapshotStats?: { place: number; prize: number } } | null;
23|    participants?: { id: number; username: string; snapshotStats?: { place: number; prize: number } }[];
24|}
25|
26|const DIVISION_LABELS: Record<string, string> = {
27|    copper: 'Медный', steel: 'Стальной', mithril: 'Мифриловый', adamant: 'Адамантовый',
28|};
29|
30|const DIVISION_ICONS: Record<string, string> = {
31|    copper: '🥉', steel: '🥈', mithril: '🥇', adamant: '👑',
32|};
33|
34|const DIVISION_LEVELS: Record<string, [number, number]> = {
35|    copper: [1, 15], steel: [16, 35], mithril: [36, 60], adamant: [61, 999],
36|};
37|
38|function formatTimer(seconds: number): string {
39|    if (seconds <= 0) return '0 мин';
40|    const d = Math.floor(seconds / 86400);
41|    const h = Math.floor((seconds % 86400) / 3600);
42|    const m = Math.floor((seconds % 3600) / 60);
43|    const parts: string[] = [];
44|    if (d > 0) parts.push(d + ' дн');
45|    if (h > 0) parts.push(h + ' ч');
46|    if (m > 0) parts.push(m + ' мин');
47|    return parts.join(' ') || '0 мин';
48|}
49|
50|function canJoin(t: TournamentInfo, userLevel: number): boolean {
51|    if (t.type === 'official') {
52|        const [min, max] = DIVISION_LEVELS[t.division] || [0, 0];
53|        return userLevel >= min && userLevel <= max;
54|    }
55|    return userLevel >= (t.minLevel || 1) && userLevel <= (t.maxLevel || 999);
56|}
57|
58|function tournamentLabel(t: TournamentInfo): string {
59|    if (t.type === 'custom') return t.name || 'Турнир';
60|    return DIVISION_LABELS[t.division] || t.division;
61|}
62|
63|function tournamentIcon(t: TournamentInfo): string {
64|    if (t.type === 'custom') return '🎪';
65|    return DIVISION_ICONS[t.division] || '🏆';
66|}
67|
68|export default function TournamentBanner() {
69|    const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);
70|    const [userLevel, setUserLevel] = useState(1);
71|    const [warnings, setWarnings] = useState<any[]>([]);
72|    const [loading, setLoading] = useState(true);
73|    const navigate = useNavigate();
74|    const { user } = useAuth();
75|    const isGuest = user?.isGuest || false;
76|
77|    useEffect(() => {
78|        const token = localStorage.getItem('token');
79|        if (!token || isGuest) { setLoading(false); return; }
80|
81|        fetch('/api/tournament', { headers: getHeaders() })
82|            .then(r => r.json())
83|            .then((data: any) => {
84|                setTournaments(data.tournaments || []);
85|                setUserLevel(data.userLevel || 1);
86|                setWarnings(data.warnings || []);
87|            })
88|            .catch(() => {})
89|            .finally(() => setLoading(false));
90|    }, []);
91|
92|    if (loading) return null;
93|
94|    if (isGuest) {
95|        return (
96|            <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl pt-5 pb-3 px-3 min-w-[210px] relative opacity-60">
97|                <h3 className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 bg-[var(--color-bg-secondary)] text-[var(--color-text-accent)] text-base font-bold flex items-center gap-1 whitespace-nowrap">
98|                    <Icon icon="game-icons:trophy" width="18" height="18" /> Турниры
99|                </h3>
100|                <p className="text-xs text-[var(--color-text-muted)]">🔒 Недоступны на гостевом аккаунте</p>
101|            </div>
102|        );
103|    }
104|
105|    const now = Math.floor(Date.now() / 1000);
106|
107|    // Только турниры, где игрок может участвовать
108|    const active = tournaments
109|        .filter(t => (t.status === 'registration' || t.status === 'in_progress') && canJoin(t, userLevel))
110|        .sort((a, b) => a.registrationEnd - b.registrationEnd);
111|
112|    const myCompleted = tournaments.filter(t => t.status === 'completed' && t.myRegistration);
113|
114|    if (active.length === 0 && myCompleted.length === 0) {
115|        return (
116|            <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl pt-5 pb-3 px-3 min-w-[210px] relative">
117|                <h3 className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 bg-[var(--color-bg-secondary)] text-[var(--color-text-accent)] text-base font-bold flex items-center gap-1 whitespace-nowrap">
118|                    <Icon icon="game-icons:trophy" width="18" height="18" /> Турниры
119|                </h3>
120|                <p className="text-xs text-[var(--color-text-muted)]">Нет активных турниров</p>
121|            </div>
122|        );
123|    }
124|
125|    return (
126|        <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl pt-5 pb-3 px-3 min-w-[210px] relative">
127|            <h3 className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 bg-[var(--color-bg-secondary)] text-[var(--color-text-accent)] text-base font-bold cursor-pointer flex items-center gap-1 whitespace-nowrap" onClick={() => navigate('/tournament')}>
128|                <Icon icon="game-icons:trophy" width="18" height="18" /> Турниры
129|            </h3>
130|
131|            <div className="space-y-2">
132|                {warnings.map((w: any) => {
133|                    const label = w.type === 'custom' ? (w.name || 'Турнир') : DIVISION_LABELS[w.division] || w.division;
134|                    const secLeft = w.registrationEnd - now;
135|                    return (
136|                        <div key={w.id} className="text-[0.6rem] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded p-1.5">
137|                            ⏰ {label}: регистрация закроется через {formatTimer(Math.max(0, secLeft))}!
138|                        </div>
139|                    );
140|                })}
141|                {active.slice(0, 3).map(t => {
142|                    const joinable = canJoin(t, userLevel);
143|                    const untilEnd = t.registrationEnd - now;
144|
145|                    return (
146|                        <div key={t.id} className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/tournament')}>
147|                            <div className="flex items-center gap-1.5">
148|                                <span className="text-xs">{tournamentIcon(t)}</span>
149|                                <span className={`text-xs font-medium ${joinable ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-text-muted)]'}`}>
150|                                    {tournamentLabel(t)}
151|                                    {t.type === 'custom' && <span className="text-[0.6rem] ml-0.5 text-[var(--color-accent-purple)]">игр.</span>}
152|                                </span>
153|                                <span className="text-[0.6rem] text-[var(--color-text-muted)] ml-auto">
154|                                    {t.status === 'registration' ? `⌛ ${formatTimer(Math.max(0, untilEnd))}` : '⚔️ идёт'}
155|                                </span>
156|                            </div>
157|                            <div className="flex items-center gap-2 text-[0.6rem] text-[var(--color-text-muted)] mt-0.5">
158|                                <span>{t.participantCount}/{t.maxPlayers || 8} уч.</span>
159|                                <span>Призовой фонд: {formatMoney(t.prizePool)}</span>
160|                                {t.entryFee ? <span>вход {t.entryFee}</span> : null}
161|                                {t.myRegistration && <span className="text-[var(--color-accent-success)]">✓</span>}
162|                            </div>
163|                        </div>
164|                    );
165|                })}
166|
167|                {myCompleted.length > 0 && (
168|                    <div className="border-t border-[var(--color-border-light)] pt-2 mt-2">
169|                        {myCompleted.slice(0, 2).map(t => {
170|                            const myPlace = t.myRegistration?.snapshotStats?.place;
171|                            return (
172|                                <div key={t.id} className="cursor-pointer hover:opacity-80 transition-opacity text-[0.6rem]" onClick={() => navigate('/tournament')}>
173|                                    <span className="text-[var(--color-text-muted)]">{tournamentIcon(t)} {tournamentLabel(t)} — завершён</span>
174|                                    {myPlace && <span className="text-[var(--color-accent-success)] ml-1">{myPlace}-е место</span>}
175|                                </div>
176|                            );
177|                        })}
178|                    </div>
179|                )}
180|            </div>
181|        </div>
182|    );
183|}
184|