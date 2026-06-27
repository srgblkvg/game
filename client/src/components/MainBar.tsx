import Inventory from './Inventory';
import OverflowStorage from './OverflowStorage';
import Actions from './Actions';
import { getHeaders } from '../api/helpers';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter } from '../api';

interface MainBarProps {
    canAttack: boolean;
    attackCooldownSec: number;
    pveCooldownSec: number;
    bankCooldownSec: number;
    onArenaClick: () => void;
    selectedInventoryItemId?: string | null;
    onInventoryItemClick?: (item: any) => void;
    hasActiveJob?: boolean;
}

export default function MainBar({ canAttack, attackCooldownSec, pveCooldownSec, bankCooldownSec, onArenaClick, selectedInventoryItemId, onInventoryItemClick, hasActiveJob }: MainBarProps) {
    const { setCharacter } = useGame();

    const handleInventoryDrop = async (e: React.DragEvent) => {
      const data = e.dataTransfer.getData('text/plain');
      if (!data.startsWith('overflow:')) return;
      e.preventDefault();
      const id = parseInt(data.split(':')[1]);
      try {
        const r = await fetch(`/api/overflow/take/${id}`, { method: 'POST', headers: getHeaders() });
        if (r.ok) {
          const ch = await fetchCharacter(); setCharacter(ch);
          window.dispatchEvent(new CustomEvent('overflow-taken', { detail: id }));
        }
      } catch {}
    };

    return (
        <div className="flex-1 min-w-[280px] flex flex-col gap-1 w-full sm:w-auto"
          onDragOver={(e) => { if (e.dataTransfer.types.includes('text/plain')) e.preventDefault(); }}
          onDrop={handleInventoryDrop}
        >
            <Inventory selectedItemId={selectedInventoryItemId} onItemClick={onInventoryItemClick} />
            <OverflowStorage />
            <Actions canAttack={canAttack} attackCooldownSec={attackCooldownSec} pveCooldownSec={pveCooldownSec} bankCooldownSec={bankCooldownSec} onArenaClick={onArenaClick} hasActiveJob={hasActiveJob} />
        </div>
    );
}
