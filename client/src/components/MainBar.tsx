import Inventory from './Inventory';
import Actions from './Actions';

interface MainBarProps {
    canAttack: boolean;
    attackCooldownSec: number;
    onArenaClick: () => void;
    selectedInventoryItemId?: string | null;
    onInventoryItemClick?: (item: any) => void;
}

export default function MainBar({ canAttack, attackCooldownSec, onArenaClick, selectedInventoryItemId, onInventoryItemClick }: MainBarProps) {
    return (
        <div className="flex-1 min-w-[280px] flex flex-col gap-6">
            <Inventory selectedItemId={selectedInventoryItemId} onItemClick={onInventoryItemClick} />
            <Actions canAttack={canAttack} attackCooldownSec={attackCooldownSec} onArenaClick={onArenaClick} />
        </div>
    );
}
