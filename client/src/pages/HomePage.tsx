import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter, enterArena, equipItem } from '../api';
import LeftSidebar from '../components/LeftSidebar';
import MainBar from '../components/MainBar';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { getCompatibleSlots } from '../utils/itemUtils';
import { getRemaining } from '../hooks/useServerTime';

export default function HomePage() {
  const { user } = useAuth();
  const { character, setCharacter, serverTime } = useGame();
  const navigate = useNavigate();
  const [noOpponentModal, setNoOpponentModal] = useState<string | null>(null);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);

  useEffect(() => { if (!user) navigate('/login'); }, [user, navigate]);
  useEffect(() => { if (character?.activeJob) navigate('/jobs'); }, [character, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchCharacter().then(setCharacter).catch(console.error);
    // Header already polls character — no need for duplicate interval here
  }, [user, setCharacter]);

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
      const data = await equipItem(slotId, effectiveItemId);
      setCharacter({ ...character!, inventory: data.inventory, equipment: data.equipment, currentHp: data.currentHp ?? Math.max(1, character!.currentHp) });
      setSelectedInventoryItemId(null);
    } catch (err: any) { alert(err.message); }
  };


  if (!character) return <div className="p-4 text-[var(--color-text-primary)]">Загрузка...</div>;
  const attackCooldownSec = getRemaining((character.lastAttackTime || 0) + 300);
  const canAttack = attackCooldownSec <= 0;
  const pveCooldownSec = getRemaining((character.lastPveAttackTime || 0) + 300);
  const bankCooldownSec = getRemaining((character.lastBankVisit || 0) + 1800);

  return (
    <div className="px-4 py-4">
      {character.totalBattles === 0 && character.level <= 1 && character.money <= 100 && (!character.inventory || character.inventory.length === 0) && (
        <div className="mb-4 p-3 bg-[rgba(52,152,219,0.1)] border border-[rgba(52,152,219,0.3)] rounded-lg text-sm text-[var(--color-text-secondary)] text-center">
          👋 Добро пожаловать в MMO Arena!<br />
          Рекомендуем ознакомиться с <a href="/wiki/" target="_blank" className="text-[var(--color-accent-info)] underline font-bold">📖 гайдом для новичков</a> — там всё про охоту, арену, гильдии, ремесло и чат.
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
    </div>
  );
}
