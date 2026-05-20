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
        <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Inventory
                selectedItemId={selectedInventoryItemId}
                onItemClick={onInventoryItemClick}
            />
            <Actions canAttack={canAttack} attackCooldownSec={attackCooldownSec} onArenaClick={onArenaClick} />
        </div>
    );
}