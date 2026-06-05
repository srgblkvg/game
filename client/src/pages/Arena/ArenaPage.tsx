import { Icon } from "@iconify/react";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../contexts/GameContext';
import { useAuth } from '../../contexts/AuthContext';
import { useBattleLogic } from '../../hooks/useBattleLogic';
import { calculateStats } from '../../utils/stats';
import CharacterCard from '../../components/CharacterCard';
import BackButton from '../../components/ui/BackButton';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { formatMoney } from '../../utils/money';
import { renderBattleLog } from '../../utils/battleLog';

export default function ArenaPage() {
  const { user } = useAuth();
  const { character, setCharacter } = useGame();
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [isVerySmall, setIsVerySmall] = useState(window.innerWidth < 420);
  const [difficulty, setDifficulty] = useState<'easy' | 'equal' | 'hard'>('equal');
  const [flipped, setFlipped] = useState(false);

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
    hpLeft, maxHpLeft,
    hpRight, maxHpRight,
    modalMessage,
    speed,
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
    loadOpponent(false, difficulty);
  }, [user]);

  if (!user || !character) return null;

  const isBattleActive = battleSteps.length > 0;

  const visibleSteps = battleSteps.slice(
    Math.max(0, currentStep - 4),
    currentStep + 1
  );

  const diffLabels: Record<string, string> = {
    easy: 'Лёгкий',
    equal: 'Равный',
    hard: 'Сложный',
  };

  const diffIcons: Record<string, string> = {
    easy: 'game-icons:broken-shield',
    equal: 'game-icons:crossed-swords',
    hard: 'game-icons:death-skull',
  };

  const handleFlip = async (diff: 'easy' | 'equal' | 'hard') => {
    setDifficulty(diff);
    setFlipped(true);
    await loadOpponent(false, diff);
  };

  return (
    <div className="px-4 py-4 min-h-screen">
      <BackButton to="/" />
      <h1 className="text-center text-xl font-bold mb-4"><Icon icon='game-icons:crossed-swords' width="22" height="22" className="inline mr-2"/>Арена</h1>

      {/* Карточки бойцов */}
      <div className="flex justify-between sm:justify-center gap-2 sm:gap-8 my-4 px-1 sm:px-0">
        <CharacterCard
          char={{
            username: character.username,
            level: character.level,
            equipment: character.equipment,
            stats: calculateStats(character, (character as any).drinkBonuses),
            currentHp: hpLeft, maxHp: maxHpLeft,
            gender: character.gender || 'male',
          }}
          side="left"
          showHealth={isBattleActive}
          showExp={false}
          showRegenHint={false}
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
              currentHp: hpRight, maxHp: maxHpRight,
              gender: opponent.gender || 'male',
            }}
            side="right"
            showHealth={isBattleActive}
            showExp={false}
          showRegenHint={false}
            readOnly
            compact={isVerySmall ? 'verySmall' : isMobile ? 'mobile' : false}
          />
        )}
      </div>

      {/* Управление скоростью */}
      {battleSteps.length > 0 && currentStep < battleSteps.length - 1 && (
        <div className="flex justify-center gap-4 mb-4">
          <Button variant="primary" size="sm" onClick={toggleSpeed}>
            {speed === 2 ? 'x1' : 'x2'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleSkip}>
            Пропустить
          </Button>
        </div>
      )}

      {/* Выбор соперника до боя — flip card */}
      {!battleSteps.length && (
        <div className="text-center my-8 flex justify-center">
          <div className="perspective-800 w-full max-w-xs">
            <div
              className={`relative w-full transition-transform duration-500 ${flipped ? 'rotate-y-180' : ''}`}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Передняя сторона — кнопки */}
              <div className="w-full" style={{ backfaceVisibility: 'hidden' }}>
                <div className="grid grid-cols-3 gap-2">
                  {(['easy', 'equal', 'hard'] as const).map(diff => (
                    <Button
                      key={diff}
                      variant={diff === 'equal' ? 'primary' : diff === 'hard' ? 'danger' : 'success'}
                      size="md"
                      onClick={() => handleFlip(diff)}
                      disabled={loading}
                      className="flex flex-col items-center gap-1 py-3"
                    >
                      <Icon icon={diffIcons[diff]} width="24" height="24" />
                      <span className="text-xs">{diffLabels[diff]}</span>
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-2">
                  {difficulty === 'easy' ? 'Соперник ниже уровнем' : difficulty === 'hard' ? 'Соперник выше уровнем' : 'Соперник твоего уровня'}
                </p>
              </div>

              {/* Задняя сторона — кнопка боя */}
              <div
                className="absolute inset-0 w-full flex flex-col items-center justify-center"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                {loading ? (
                  <p className="text-sm text-[var(--color-text-muted)]">Поиск соперника...</p>
                ) : opponent ? (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {diffLabels[difficulty]} соперник: <span className="font-bold">{opponent.name}</span> (ур. {opponent.level})
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        size="md"
                        onClick={handleStartBattle}
                        className="text-lg px-6 py-2 rounded-xl"
                      >
                        <Icon icon="game-icons:crossed-swords" width="18" height="18" className="inline mr-1" />В бой!
                      </Button>
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => { setFlipped(false); loadOpponent(true, difficulty); }}
                        disabled={character.money < 10}
                      >
                        <Icon icon="game-icons:cycle" width="18" height="18" className="inline mr-1" />{formatMoney(10)}
                      </Button>
                    </div>
                    <Button variant="ghost" size="xs" onClick={() => setFlipped(false)}>← Назад</Button>
                  </div>
                ) : (
                  <p className="text-sm text-red-500">Нет соперников</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Лог боя */}
      {battleSteps.length > 0 && (
        <div>
          <div
            ref={logContainerRef}
            className="bg-black rounded-lg p-3 min-h-[8em] max-h-[24em] overflow-y-auto font-mono text-xs leading-relaxed"
          >
            {renderBattleLog(visibleSteps)}
          </div>

          {currentStep >= battleSteps.length - 1 && battleResult && (
            <div className="text-center mt-4">
              <p className="font-bold text-lg">
                {battleResult.winnerId === user.id ? (
                  <><Icon icon="game-icons:trophy" width="18" height="18" className="inline mr-1" />Победа!</>
                ) : (
                  <><Icon icon="game-icons:death-skull" width="18" height="18" className="inline mr-1" />Поражение</>
                )}
              </p>
              {battleResult.expGained > 0 && <p>Опыт: +{battleResult.expGained}</p>}
              {battleResult.moneyStolen > 0 && (
                <p>
                  {battleResult.winnerId === user.id
                    ? <><Icon icon="game-icons:coins" width="16" height="16" className="inline mr-1" />Захвачено {formatMoney(battleResult.moneyStolen)}</>
                    : <><Icon icon="game-icons:cash" width="16" height="16" className="inline mr-1" />Потеряно {formatMoney(battleResult.moneyStolen)}</>}
                </p>
              )}
              {battleResult.levelsGained > 0 && (
                <p className="text-[var(--color-accent-purple)]"><Icon icon="game-icons:level-end-flag" width="16" height="16" className="inline mr-1" />Уровень +{battleResult.levelsGained} (+{battleResult.levelsGained * 5} очк.)</p>
              )}
              <Button
                variant="danger"
                size="md"
                className="mt-4"
                onClick={() => { finishBattle(); navigate('/'); }}
              >
                Вернуться на главную
              </Button>
            </div>
          )}
        </div>
      )}

      {modalMessage && (
        <Modal open={!!modalMessage} onClose={() => setModalMessage(null)}>
          <p className="whitespace-pre-wrap mb-4">{modalMessage}</p>
          <Button variant="danger" size="sm" fullWidth onClick={() => setModalMessage(null)}>OK</Button>
        </Modal>
      )}
    </div>
  );
}
