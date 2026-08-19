import { useGame } from '../contexts/GameContext';
import { equipItem } from '../api';
import { slotNames, slotCategories } from '../utils/itemUtils';
import { useToast } from '../contexts/ToastContext';
import EquipmentChoiceRow from './ui/EquipmentChoiceRow';

interface SlotSelectionModalProps {
    slotId: string;
    onClose: () => void;
    onEquip?: () => void;
}

export default function SlotSelectionModal({ slotId, onClose, onEquip }: SlotSelectionModalProps) {
    const { character, setCharacter } = useGame();
    const { showToast } = useToast();
    if (!character) return null;

    const handleEquip = async (itemId: string) => {
        try {
            const data = await equipItem(slotId, itemId);
            setCharacter({
                ...character,
                inventory: data.inventory,
                equipment: data.equipment,
                currentHp: data.currentHp ?? Math.max(1, character.currentHp),
                stats: data.stats ?? character.stats,
            });
            onClose();
            onEquip?.();
        } catch (err: any) {
            showToast(err.message);
        }
    };

    const availableItems = character.inventory.filter((item: any) => {
        if (item.type === 'material') return false;
        const cat = slotCategories[slotId];
        if (cat === 'ring') return item.slot === 'ring1' || item.slot === 'ring2';
        if (cat === 'weapon') return item.slot === 'weapon1' || item.slot === 'shield';
        return item.slot === slotId;
    });

    return (
        <div className="mt-4 bg-[var(--color-bg-card)] p-3 rounded-lg border border-[var(--color-border-light)] w-full">
            <div className="text-sm font-bold mb-2">Выберите предмет для {slotNames[slotId]}:</div>
            {availableItems.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)]">Нет подходящих предметов</p>
            ) : (
                availableItems.map((item: any) => (
                    <EquipmentChoiceRow key={item.id} item={item} onSelect={handleEquip} />
                ))
            )}
            <button onClick={onClose} className="mt-2 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded px-3 py-1 text-xs cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                Закрыть
            </button>
        </div>
    );
}
