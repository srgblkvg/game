import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter, enterArena, equipItem } from '../api';
import LeftSidebar from '../components/LeftSidebar';
import MainBar from '../components/MainBar';
import RightSidebar from '../components/RightSidebar';
import { calculateStats } from '../utils/stats';
import { getCompatibleSlots } from '../utils/itemUtils';

export default function HomePage() {
  const { user } = useAuth();
  const { character, setCharacter } = useGame();
  const navigate = useNavigate();
  const intervalRef = useRef<number | null>(null);
  const [noOpponentModal, setNoOpponentModal] = useState<string | null>(null);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    if (character?.activeJob) {
      navigate('/jobs');
    }
  }, [character, navigate]);

  useEffect(() => {
    if (!user) return;

    fetchCharacter()
      .then(setCharacter)
      .catch(console.error);

    intervalRef.current = window.setInterval(async () => {
      if (document.hidden) return;
      try {
        const fresh = await fetchCharacter();
        setCharacter(fresh);
      } catch (err) {
        console.error('Не удалось обновить персонажа', err);
      }
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, setCharacter]);

  const handleArenaClick = async () => {
    try {
      await enterArena();
      const fresh = await fetchCharacter();
      setCharacter(fresh);
      navigate('/arena');
    } catch (e: any) {
      setNoOpponentModal(e.message);
    }
  };

  // Подсвечиваемые слоты для выделенного предмета
  const highlightedSlots = useMemo(() => {
    if (!selectedInventoryItemId || !character) return [];
    const item = character.inventory.find((i: any) => i.id === selectedInventoryItemId);
    return item ? getCompatibleSlots(item) : [];
  }, [selectedInventoryItemId, character]);

  // Клик по предмету в инвентаре
  const handleInventoryItemClick = (item: any) => {
    setSelectedInventoryItemId(prev => prev === item.id ? null : item.id);
  };

  // Экипировка
  const handleEquip = async (slotId: string, itemId?: string) => {
    try {
      const effectiveItemId = itemId || (selectedInventoryItemId && highlightedSlots.includes(slotId) ? selectedInventoryItemId : undefined);
      const data = await equipItem(slotId, effectiveItemId);
      const stats = calculateStats({ ...character!, equipment: data.equipment });
      setCharacter({
        ...character!,
        inventory: data.inventory,
        equipment: data.equipment,
        currentHp: Math.min(character!.currentHp, stats.hp),
      });
      setSelectedInventoryItemId(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!character) {
    return <div style={{ color: '#eee', padding: '1rem' }}>Загрузка...</div>;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const attackCooldownSec = Math.max(0, 300 - (nowSec - (character.lastAttackTime || 0)));
  const canAttack = attackCooldownSec <= 0;


  return (
    <div style={{ padding: '1rem', color: '#eee', paddingBottom: '320px' }}>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center' }}>
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

      {noOpponentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 500
        }}>
          <div style={{
            background: '#2a2a3e', border: '2px solid #e63946', borderRadius: '12px',
            padding: '2rem', maxWidth: '400px', textAlign: 'center', color: '#eee'
          }}>
            <p>{noOpponentModal}</p>
            <button onClick={() => setNoOpponentModal(null)} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#e63946', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}