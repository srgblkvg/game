import { Icon } from "@iconify/react";
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchJobs, startJob, fetchCharacter } from '../api';
import { formatMoney } from '../utils/money';
import BackButton from '../components/ui/BackButton';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function JobsPage() {
  const { user } = useAuth();
  const { character, setCharacter } = useGame();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const prevActiveJob = useRef(character?.activeJob);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchJobs()
      .then(data => setJobs(data.sort((a: any, b: any) => a.duration - b.duration)))
      .catch(e => setError(e.message));
  }, [user, navigate]);

  useEffect(() => {
    const activeJob = character?.activeJob;
    if (activeJob) {
      setRemaining(Math.max(0, activeJob.endTime - Math.floor(Date.now() / 1000)));
    } else {
      setRemaining(null);
    }
  }, [character]);

  useEffect(() => {
    if (prevActiveJob.current && !character?.activeJob) navigate('/');
    prevActiveJob.current = character?.activeJob;
  }, [character?.activeJob, navigate]);

  useEffect(() => {
    if (!user) return;
    intervalRef.current = window.setInterval(() => {
      fetchCharacter().then(setCharacter).catch(console.error);
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [user, setCharacter]);

  const handleStart = async (jobId: number) => {
    setLoading(true);
    setError('');
    try {
      const result = await startJob(jobId);
      setCharacter({
        ...character!,
        activeJob: {
          jobId,
          name: result.jobName,
          startTime: Math.floor(Date.now() / 1000),
          endTime: result.endTime, reward: result.reward,
          duration: result.endTime - Math.floor(Date.now() / 1000),
          expReward: result.expReward || 0,
        },
      });
      setRemaining(result.endTime - Math.floor(Date.now() / 1000));
      window.scrollTo(0, 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const timer = setInterval(() => {
      setRemaining(prev => (prev === null || prev <= 1) ? 0 : prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}ч ${m}м ${s}с`;
  };

  if (!user || !character) return null;

  const activeJob = character.activeJob;

  if (activeJob && remaining !== null && remaining > 0) {
    return (
      <div className="text-center py-8 px-4">
        <h2 className="text-xl font-bold mb-3"><Icon icon="game-icons:hourglass" width="18" height="18" className="inline mr-1"/>Выполняется работа</h2>
        <p className="text-lg">{activeJob.name}</p>
        <p className="text-[var(--color-text-secondary)]">Осталось: {formatTime(remaining)}</p>
        <p className="text-[var(--color-text-accent)]">Награда: {formatMoney(activeJob.reward)}</p>
        <p className="text-[var(--color-accent-purple)]">Опыт: +{activeJob.expReward || 0}</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <BackButton />
      <h2 className="text-xl font-bold mb-4"><Icon icon="game-icons:swap-bag" width="22" height="22" className="inline mr-2"/>Доступные работы</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
        {jobs.map((job: any) => (
          <Card key={job.id} className="flex flex-col items-center text-center">
            <h3 className="font-bold mb-1">{job.name}</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-2">{job.description}</p>
            <div className="text-[var(--color-text-accent)] mb-1 text-sm">
              Награда: {job.rewardMin}–{job.rewardMax} серебра
            </div>
            <div className="text-[var(--color-accent-purple)] text-xs mb-1">
              Опыт: +{Math.max(1, Math.floor(job.duration / 3600))}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mb-3">{formatTime(job.duration)}</div>
            <Button variant="success" size="sm" onClick={() => handleStart(job.id)} disabled={loading}>
              {loading ? '...' : 'Начать'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
