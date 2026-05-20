import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchJobs, startJob, fetchCharacter } from '../api';
import { formatMoney } from '../utils/money';

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

  // Загрузка списка работ
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchJobs()
      .then(data => setJobs(data.sort((a: any, b: any) => a.duration - b.duration)))
      .catch(e => setError(e.message));
  }, [user, navigate]);

  // Обновление оставшегося времени
  useEffect(() => {
    const activeJob = character?.activeJob;
    if (activeJob) {
      const now = Math.floor(Date.now() / 1000);
      const left = Math.max(0, activeJob.endTime - now);
      setRemaining(left);
    } else {
      setRemaining(null);
    }
  }, [character]);

  // Редирект при завершении работы (если была работа и исчезла)
  useEffect(() => {
    if (prevActiveJob.current && !character?.activeJob) {
      navigate('/');
    }
    prevActiveJob.current = character?.activeJob;
  }, [character?.activeJob, navigate]);

  // Периодический опрос сервера для актуализации персонажа
  useEffect(() => {
    if (!user) return;
    intervalRef.current = window.setInterval(() => {
      fetchCharacter().then(setCharacter).catch(console.error);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
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
          endTime: result.endTime,
          reward: result.reward,
          duration: result.endTime - Math.floor(Date.now() / 1000),
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

  // Обратный отсчёт (только для обновления таймера на экране)
  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const timer = setInterval(() => {
      setRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
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
      <div style={{ padding: '2rem', color: '#eee', textAlign: 'center' }}>
        <h2>⏳ Выполняется работа</h2>
        <p>{activeJob.name}</p>
        <p>Осталось: {formatTime(remaining)}</p>
        <p>Награда: {formatMoney(activeJob.reward)}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', color: '#eee' }}>
      <button
        onClick={() => navigate('/')}
        style={{
          background: '#555', border: 'none', color: '#fff', padding: '0.4rem 1rem',
          borderRadius: '6px', cursor: 'pointer', marginBottom: '1rem',
        }}
      >
        ← Назад
      </button>
      <h2>🛠️ Доступные работы</h2>
      {error && <div style={{ color: '#e74c3c', marginBottom: '1rem' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
        {jobs.map((job: any) => (
          <div
            key={job.id}
            style={{
              background: '#2a2a3e',
              padding: '1rem',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <h3>{job.name}</h3>
            <p style={{ fontSize: '0.9rem', color: '#aaa' }}>{job.description}</p>
            <div style={{ color: '#f1c40f', marginBottom: '0.5rem' }}>
              Награда: {job.rewardMin}–{job.rewardMax} бронзы
            </div>
            <div style={{ fontSize: '0.8rem', color: '#ccc' }}>{formatTime(job.duration)}</div>
            <button
              onClick={() => handleStart(job.id)}
              disabled={loading}
              style={{
                marginTop: '1rem',
                background: '#2ecc71',
                border: 'none',
                color: '#fff',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              {loading ? '...' : 'Начать'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}