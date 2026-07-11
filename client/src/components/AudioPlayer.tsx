import { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';

const STREAM_URL = 'http://mediaserv73.live-streams.nl:18058/stream';

export default function AudioPlayer() {
    const [playing, setPlaying] = useState(false);
    const [volume, setVolume] = useState(() => {
        const saved = localStorage.getItem('radioVolume');
        return saved ? parseFloat(saved) : 0.5;
    });
    const [error, setError] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = new Audio();
        audio.preload = 'none';
        audio.volume = volume;
        audioRef.current = audio;

        const onError = () => { setError(true); setPlaying(false); };
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
            setError(false);
            if (!audio.src || audio.src === window.location.href) {
                audio.src = STREAM_URL;
                audio.load();
            }
            audio.play().catch(() => { setError(true); setPlaying(false); });
            setPlaying(true);
        }
    };

    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = parseFloat(e.target.value);
        setVolume(v);
        localStorage.setItem('radioVolume', String(v));
        if (audioRef.current) audioRef.current.volume = v;
    };

    return (
        <div className="flex items-center gap-1.5">
            <button
                onClick={togglePlay}
                className={`w-6 h-6 flex items-center justify-center rounded-full cursor-pointer transition-colors
                    ${playing
                        ? 'bg-[var(--color-accent-success)] text-white'
                        : error
                        ? 'bg-[var(--color-accent-danger)]/20 text-[var(--color-accent-danger)]'
                        : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                title={playing ? 'Стоп' : 'Играть'}
            >
                <Icon icon={playing ? 'game-icons:stop-sign' : 'game-icons:play-button'} width="12" height="12" />
            </button>
            <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolume}
                className="w-14 h-1 accent-[var(--color-accent-info)] cursor-pointer"
                title={`Громкость: ${Math.round(volume * 100)}%`}
            />
        </div>
    );
}
