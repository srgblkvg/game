import { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';

interface Station {
    name: string;
    url: string;
}

const STATIONS: Station[] = [
    { name: 'Radio 1', url: 'http://mediaserv73.live-streams.nl:8058/stream' },
    { name: 'Radio 2', url: 'http://mediaserv73.live-streams.nl:18058/stream' },
];

export default function AudioPlayer() {
    const [playing, setPlaying] = useState(false);
    const [stationIdx, setStationIdx] = useState(0);
    const [showPanel, setShowPanel] = useState(false);
    const [error, setError] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = new Audio();
        audio.preload = 'none';
        audioRef.current = audio;

        const onError = () => setError(true);
        const onPlay = () => setError(false);
        audio.addEventListener('error', onError);
        audio.addEventListener('playing', onPlay);

        return () => {
            audio.pause();
            audio.removeEventListener('error', onError);
            audio.removeEventListener('playing', onPlay);
        };
    }, []);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (playing) {
            audio.pause();
            setPlaying(false);
        } else {
            audio.src = STATIONS[stationIdx].url;
            audio.load();
            audio.play().catch(() => setError(true));
            setPlaying(true);
        }
    };

    const switchStation = (idx: number) => {
        setStationIdx(idx);
        setError(false);
        const audio = audioRef.current;
        if (!audio) return;
        if (playing) {
            audio.src = STATIONS[idx].url;
            audio.load();
            audio.play().catch(() => setError(true));
        }
    };

    const station = STATIONS[stationIdx];

    return (
        <>
            {/* Кнопка в шапке */}
            <button
                onClick={() => setShowPanel(!showPanel)}
                className={`w-7 h-7 flex items-center justify-center rounded-full cursor-pointer transition-colors text-xs
                    ${playing ? 'bg-[var(--color-accent-success)]/20 text-[var(--color-accent-success)]' : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                title="Радио"
            >
                <Icon icon={playing ? 'game-icons:musical-notes' : 'game-icons:musical-score'} width="14" height="14" />
            </button>

            {/* Панелька плеера */}
            {showPanel && (
                <div className="absolute right-0 mt-2 w-56 bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded-xl shadow-xl z-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold truncate flex-1">{station.name}</span>
                        <button onClick={() => setShowPanel(false)} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] ml-1">✕</button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={togglePlay}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-accent-info)] text-white cursor-pointer hover:opacity-80"
                        >
                            <Icon icon={playing ? 'game-icons:pause-button' : 'game-icons:play-button'} width="16" height="16" />
                        </button>

                        <div className="flex gap-1 flex-1">
                            {STATIONS.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => switchStation(i)}
                                    className={`text-[0.6rem] px-2 py-1 rounded cursor-pointer flex-1 text-center ${
                                        i === stationIdx
                                            ? 'bg-[var(--color-accent-info)] text-white'
                                            : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                                    }`}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <p className="text-[0.6rem] text-[var(--color-accent-danger)] mt-2">
                            Не удалось загрузить поток. Возможно, радио недоступно.
                        </p>
                    )}

                    <p className="text-[0.6rem] text-[var(--color-text-muted)] mt-2">
                        ▶ Игровой музыкальный плеер
                    </p>
                </div>
            )}
        </>
    );
}
