import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../contexts/GameContext';
import { useAuth } from '../../contexts/AuthContext';
import { useBattleLogic } from '../../hooks/useBattleLogic';
import { calculateStats } from '../../utils/stats';
import CharacterCard from '../../components/CharacterCard';
import ArenaModal from './ArenaModal';
import '../../styles/arena.css';

export default function ArenaPage() {
  const { user } = useAuth();
  const { character, setCharacter } = useGame();
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [isVerySmall, setIsVerySmall] = useState(window.innerWidth < 420);

  useEffect(() => {
    const handler = () => {
      setIsMobile(window.innerWidth < 600);
      setIsVerySmall(window.innerWidth < 420);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const {
    opponent,
    battleSteps,
    currentStep,
    battleResult,
    loading,
    hpLeft,
    maxHpLeft,
    hpRight,
    maxHpRight,
    modalMessage,
    speed,
    stamLeft,
    maxStamLeft,
    stamRight,
    maxStamRight,
    logContainerRef,
    loadOpponent,
    handleStartBattle,
    handleSkip,
    toggleSpeed,
    setModalMessage,
    finishBattle,
  } = useBattleLogic(user?.id!, character, setCharacter);

  useEffect(() => {
    if (!user || !character) navigate('/login');
  }, [user, character, navigate]);

  useEffect(() => {
    if (!user || opponent) return;
    loadOpponent();
  }, [user]);

  if (!user || !character) return null;

  const isBattleActive = battleSteps.length > 0;

  const visibleSteps = battleSteps.slice(
    Math.max(0, currentStep - 4),
    currentStep + 1
  );

  return (
    <div style={{ padding: '1rem', color: '#eee', minHeight: '100vh' }}>
      <button onClick={() => navigate('/')} style={backBtnStyle}>← Назад</button>
      <h1 style={{ textAlign: 'center' }}>⚔️ Арена</h1>

      <div style={{
        display: 'flex',
        justifyContent: isMobile ? 'space-between' : 'center',
        gap: isMobile ? '0.5rem' : '2rem',
        margin: '1rem 0',
        flexWrap: 'nowrap',
        padding: isMobile ? '0 0.5rem' : 0,
      }}>
        <CharacterCard
          char={{
            username: character.username,
            level: character.level,
            equipment: character.equipment,
            stats: calculateStats(character),
            currentHp: hpLeft,
            maxHp: maxHpLeft,
            stamina: stamLeft,
            maxStamina: maxStamLeft,
            gender: character.gender || 'male',
          }}
          side="left"
          showHealth={isBattleActive}
          showStamina={isBattleActive}
          showExp={false}
          readOnly
          compact={isVerySmall ? 'verySmall' : isMobile ? 'mobile' : false}
        />
        {opponent && (
          <CharacterCard
            char={{
              username: opponent.name,
              level: opponent.level,
              equipment: opponent.equipment,
              stats: opponent.stats,
              currentHp: hpRight,
              maxHp: maxHpRight,
              stamina: stamRight,
              maxStamina: maxStamRight,
              gender: opponent.gender || 'male',
            }}
            side="right"
            showHealth={isBattleActive}
            showStamina={isBattleActive}
            showExp={false}
            readOnly
            compact={isVerySmall ? 'verySmall' : isMobile ? 'mobile' : false}
          />
        )}
      </div>

      {/* Остальная часть без изменений (управление боем, лог, кнопки) */}
      {battleSteps.length > 0 && currentStep < battleSteps.length - 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <button onClick={toggleSpeed}
            style={{ background: '#3498db', border: 'none', color: '#fff', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}>
            {speed === 2 ? 'x1' : 'x2'}
          </button>
          <button onClick={handleSkip}
            style={{ padding: '0.3rem 0.8rem', background: '#555', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Пропустить
          </button>
        </div>
      )}

      {!battleSteps.length && (
        <div style={{ textAlign: 'center', margin: '2rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginTop: isMobile ? '1.5rem' : '0',
          }}>
            <button
              onClick={handleStartBattle}
              disabled={loading || !opponent}
              style={{
                fontSize: '1.2rem',
                padding: '0.6rem 1.8rem',
                background: '#e63946',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 'bold',
                minWidth: '180px',
              }}
            >
              {loading ? 'Поиск...' : '⚡ В бой!'}
            </button>
            <button
              onClick={() => loadOpponent(true)}
              disabled={loading || character.money < 10}
              style={{
                fontSize: '1.2rem',
                padding: '0.6rem 1.8rem',
                background: '#555',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 'bold',
                minWidth: '180px',
              }}
            >
              🔄 Сменить (10 бронзы)
            </button>
          </div>
        </div>
      )}

      {battleSteps.length > 0 && (
        <div>
          <div ref={logContainerRef} style={{
            background: '#111',
            padding: '1rem',
            borderRadius: '8px',
            height: '7.5em',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            lineHeight: '1.5',
          }}>
            {visibleSteps.map((step, i) => (
              <div key={i} style={{ marginBottom: 2 }}>{step.message}</div>
            ))}
          </div>

          {currentStep >= battleSteps.length - 1 && battleResult && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <p style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
                {battleResult.winnerId === user.id ? '🏆 Победа!' : '💀 Поражение'}
              </p>
              <p>Опыт: +{battleResult.expGained}</p>
              {battleResult.moneyStolen > 0 && (
                <p>
                  {battleResult.winnerId === user.id
                    ? `🪙 Захвачено ${battleResult.moneyStolen}`
                    : `💸 Потеряно ${battleResult.moneyStolen}`}
                </p>
              )}
              <button
                onClick={() => {
                  finishBattle();
                  navigate('/');
                }}
                style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#e63946', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}
              >
                Вернуться на главную
              </button>
            </div>
          )}
        </div>
      )}

      {modalMessage && <ArenaModal message={modalMessage} onClose={() => setModalMessage(null)} />}
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: '#555', border: 'none', color: '#fff', padding: '0.4rem 1rem',
  borderRadius: '6px', cursor: 'pointer', marginBottom: '1rem',
};