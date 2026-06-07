import { Icon } from "@iconify/react";
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../../contexts/GameContext';
import { useAuth } from '../../contexts/AuthContext';
import { useBattleLogic } from '../../hooks/useBattleLogic';
import { calculateStats } from '../../utils/stats';
import CharacterCard from '../../components/CharacterCard';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { formatMoney } from '../../utils/money';
import { renderBattleLog } from '../../utils/battleLog';

export default function ArenaPage() {
  const { user } = useAuth();
  const { character, setCharacter } = useGame();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const difficulty = searchParams.get('difficulty') || 'equal';

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

  return (
    <div className="px-4 py-4 min-h-screen">
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
            guildName: (character as any).guildName,
            guildId: (character as any).guildId,
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
              guildName: opponent.guildName,
              guildId: opponent.guildId,
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

      {/* Кнопки до боя */}
      {!battleSteps.length && (
        <div className="text-center my-8">
          <div className="flex justify-center flex-wrap gap-4">
            <Button
              variant="danger"
              size="md"
              onClick={handleStartBattle}
              disabled={loading || !opponent}
              className="text-lg px-6 py-2 w-full sm:w-auto sm:min-w-[180px] rounded-xl"
            >
              {loading ? 'Поиск...' : <><Icon icon="game-icons:crossed-swords" width="18" height="18" className="inline mr-1" />В бой!</>}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => loadOpponent(true, difficulty)}
              disabled={loading || character.money < 10}
              className="text-lg px-6 py-2 w-full sm:w-auto sm:min-w-[180px] rounded-xl"
            >
              {<><Icon icon="game-icons:cycle" width="18" height="18" className="inline mr-1" />Сменить ({formatMoney(10)})</>}
            </Button>
          </div>
        </div>
      )}

      {/* Лог боя */}
      {battleSteps.length > 0 && (
        <div>
          <div ref={logContainerRef} className="bg-black rounded-lg p-3 min-h-[8em] max-h-[24em] overflow-y-auto font-mono text-xs leading-relaxed">
            {renderBattleLog(visibleSteps)}
          </div>
          {currentStep >= battleSteps.length - 1 && battleResult && (
            <div className="text-center mt-4">
              <p className="font-bold text-lg">
                {battleResult.winnerId === user.id
                  ? <><Icon icon="game-icons:trophy" width="18" height="18" className="inline mr-1" />Победа!</>
                  : <><Icon icon="game-icons:death-skull" width="18" height="18" className="inline mr-1" />Поражение</>}
              </p>
              {battleResult.expGained > 0 && <p>Опыт: +{battleResult.expGained}</p>}
              {battleResult.moneyStolen > 0 && (
                <p>
                  {battleResult.winnerId === user.id
                    ? <>Захвачено {formatMoney(battleResult.moneyStolen)}</>
                    : <>Потеряно {formatMoney(battleResult.moneyStolen)}</>}
                </p>
              )}
              {battleResult.levelsGained > 0 && (
                <p className="text-[var(--color-accent-purple)]"><Icon icon="game-icons:level-end-flag" width="16" height="16" className="inline mr-1" />Уровень +{battleResult.levelsGained} (+{battleResult.levelsGained * 5} очк.)</p>
              )}
              <Button variant="danger" size="md" className="mt-4" onClick={() => { finishBattle(); navigate('/'); }}>
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
