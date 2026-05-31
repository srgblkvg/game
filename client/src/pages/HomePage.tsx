import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter, enterArena, equipItem } from '../api';
import LeftSidebar from '../components/LeftSidebar';
import MainBar from '../components/MainBar';
import RightSidebar from '../components/RightSidebar';
import { getCompatibleSlots } from '../utils/itemUtils';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

export default function HomePage() {
  const { user } = useAuth();
  const { character, setCharacter } = useGame();
  const navigate = useNavigate();
  const intervalRef = useRef<number | null>(null);
  const [noOpponentModal, setNoOpponentModal] = useState<string | null>(null);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);

  useEffect(() => { if (!user) navigate('/login'); }, [user, navigate]);
  useEffect(() => { if (character?.activeJob) navigate('/jobs'); }, [character, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchCharacter().then(setCharacter).catch(console.error);
    intervalRef.current = window.setInterval(async () => {
      if (document.hidden) return;
      try { const fresh = await fetchCharacter(); setCharacter(fresh); } catch (err) { console.error('Не удалось обновить персонажа', err); }
    }, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
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

  const nowSec = Math.floor(Date.now() / 1000);
  const attackCooldownSec = Math.max(0, 300 - (nowSec - (character.lastAttackTime || 0)));
  const canAttack = attackCooldownSec <= 0;

  return (
    <div className="px-4 py-4">
      <div className="flex flex-wrap gap-6 justify-center items-start">
        <LeftSidebar
          character={character}
          onEquip={handleEquip}
          selectedItemId={selectedInventoryItemId}
          highlightedSlots={highlightedSlots}
        />
        <MainBar
          canAttack={canAttack}
          attackCooldownSec={attackCooldownSec}
          onArenaClick={handleArenaClick}
          selectedInventoryItemId={selectedInventoryItemId}
          onInventoryItemClick={handleInventoryItemClick}
        />
        <RightSidebar />
      </div>

      <Modal open={!!noOpponentModal} onClose={() => setNoOpponentModal(null)}>
        <p className="mb-4">{noOpponentModal}</p>
        <Button variant="danger" fullWidth onClick={() => setNoOpponentModal(null)}>OK</Button>
      </Modal>
    </div>
  );
}
