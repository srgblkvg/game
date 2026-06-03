import Inventory from './Inventory';
import Actions from './Actions';

interface MainBarProps {
    canAttack: boolean;
    attackCooldownSec: number;
    pveCooldownSec: number;
    bankCooldownSec: number;
    onArenaClick: () => void;
    selectedInventoryItemId?: string | null;
    onInventoryItemClick?: (item: any) => void;
}

export default function MainBar({ canAttack, attackCooldownSec, pveCooldownSec, bankCooldownSec, onArenaClick, selectedInventoryItemId, onInventoryItemClick }: MainBarProps) {
    return (
        <div className="flex-1 min-w-[280px] flex flex-col gap-6 w-full sm:w-auto">
            <Inventory selectedItemId={selectedInventoryItemId} onItemClick={onInventoryItemClick} />
            <Actions canAttack={canAttack} attackCooldownSec={attackCooldownSec} pveCooldownSec={pveCooldownSec} bankCooldownSec={bankCooldownSec} onArenaClick={onArenaClick} />
        </div>
    );
}
