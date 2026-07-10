import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter, enterArena, equipItem } from '../api';
import LeftSidebar from '../components/LeftSidebar';
import MainBar from '../components/MainBar';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { getCompatibleSlots } from '../utils/itemUtils';
import { getRemaining } from '../hooks/useServerTime';
import TutorialOverlay from '../components/TutorialOverlay';
import tutorialSteps from '../data/tutorialSteps';
import { getHeaders } from '../api/helpers';

export default function HomePage() {
  const { user } = useAuth();
  const { character, setCharacter } = useGame();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [noOpponentModal, setNoOpponentModal] = useState<string | null>(null);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => { if (!user) navigate('/login'); }, [user, navigate]);
  useEffect(() => { if (character?.activeJob) navigate('/jobs'); }, [character, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchCharacter().then(setCharacter).catch(console.error);
    // Header already polls character — no need for duplicate interval here
  }, [user, setCharacter]);

  // Показываем туториал тем, кто ещё не прошёл (флаг в БД)
  useEffect(() => {
    if (!character) return;
    if (!character.tutorialCompleted) {
      const t = setTimeout(() => setShowTutorial(true), 500);
      return () => clearTimeout(t);
    }
  }, [character]);

  const handleArenaClick = async () => {
    try { await enterArena(); const fresh = await fetchCharacter(); setCharacter(fresh); navigate('/arena'); }
    catch (e: any) { setNoOpponentModal(e.message); }
  };

  const highlightedSlots = useMemo(() => {
    if (!selectedInventoryItemId || !character) return [];
    const item = character.inventory.find((i: any) => i.id === selectedInventoryItemId);
    return item ? getCompatibleSlots(item) : [];
  }, [selectedInventoryItemId, character]);

  const handleInventoryItemClick = (item: any) => {
    setSelectedInventoryItemId(prev => prev === item.id ? null : item.id);
  };

  const handleEquip = async (slotId: string, itemId?: string) => {
    try {
      const effectiveItemId = itemId || (selectedInventoryItemId && highlightedSlots.includes(slotId) ? selectedInventoryItemId : undefined);

      // Проверка на два одинаковых кольца
      if (effectiveItemId && (slotId === 'ring1' || slotId === 'ring2')) {
        const item = character!.inventory.find((i: any) => i.id === effectiveItemId);
        const otherSlot = slotId === 'ring1' ? 'ring2' : 'ring1';
        const otherItem = character!.equipment[otherSlot];
        if (item && otherItem && otherItem.name === item.name) {
          showToast('Нельзя надеть два одинаковых кольца!', 'warning');
          return;
        }
      }

      const data = await equipItem(slotId, effectiveItemId);
      setCharacter({ ...character!, inventory: data.inventory, equipment: data.equipment, currentHp: data.currentHp ?? Math.max(1, character!.currentHp), stats: data.stats ?? character!.stats });
      setSelectedInventoryItemId(null);
    } catch (err: any) { showToast(err.message); }
  };


  if (!character) return <div className="p-4 text-[var(--color-text-primary)]">Загрузка...</div>;
  const pvpCd = character.pvpCdSec ?? 600;
  const pveCd = character.pveCdSec ?? 300;
  const attackCooldownSec = getRemaining((character.lastAttackTime || 0) + pvpCd);
  const canAttack = attackCooldownSec <= 0;
  const pveCooldownSec = getRemaining((character.lastPveAttackTime || 0) + pveCd);
  const bankCooldownSec = getRemaining((character.lastBankVisit || 0) + 1800);

  return (
    <div className="px-4 py-4 sm:pt-8">
      {character.totalBattles === 0 && character.level <= 1 && character.money <= 100 && (!character.inventory || character.inventory.length === 0) && (
        <div className="mb-4 p-3 bg-[rgba(52,152,219,0.1)] border border-[rgba(52,152,219,0.3)] rounded-lg text-sm text-[var(--color-text-secondary)] text-center">
          👋 Добро пожаловать в MMO Arena!<br />
          Рекомендуем ознакомиться с <span className="text-[var(--color-accent-info)] underline font-bold cursor-pointer" onClick={() => navigate('/wiki')}>📖 Руководство для новичков</span> — там всё про охоту, арену, гильдии, ремесло и чат.<br /><span className="text-[0.7rem] text-[var(--color-text-muted)]">Используя игру, вы принимаете <a href="/rules" className="text-[var(--color-accent-info)] underline">правила</a> и <a href="/privacy" className="text-[var(--color-accent-info)] underline">политику конфиденциальности</a>.</span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-6 justify-center items-center sm:items-start">
        <LeftSidebar
          character={character}
          onEquip={handleEquip}
          selectedItemId={selectedInventoryItemId}
          highlightedSlots={highlightedSlots}
        />
        <MainBar
          canAttack={canAttack}
          attackCooldownSec={attackCooldownSec}
          pveCooldownSec={pveCooldownSec}
          bankCooldownSec={bankCooldownSec}
          onArenaClick={handleArenaClick}
          selectedInventoryItemId={selectedInventoryItemId}
          onInventoryItemClick={handleInventoryItemClick}
          hasActiveJob={!!character?.activeJob}
        />
      </div>

      <Modal open={!!noOpponentModal} onClose={() => setNoOpponentModal(null)}>
        <p className="mb-4">{noOpponentModal}</p>
        <Button variant="danger" fullWidth onClick={() => setNoOpponentModal(null)}>OK</Button>
      </Modal>

      {showTutorial && (
        <TutorialOverlay
          steps={tutorialSteps}
          onComplete={async () => {
            setShowTutorial(false);
            // Обновляем персонажа локально, чтобы не переоткрылся при следующем poll
            setCharacter(prev => prev ? { ...prev, tutorialCompleted: 1 } : prev);
            try {
              await fetch('/api/character/tutorial-done', { method: 'POST', headers: getHeaders() });
            } catch {}
          }}
        />
      )}
    </div>
  );
}
