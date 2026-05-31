import { useGame } from '../contexts/GameContext';
import { equipItem } from '../api';
import { calculateStats } from '../utils/stats';
import { slotNames, slotCategories } from '../utils/itemUtils';

interface SlotSelectionModalProps {
    slotId: string;
    onClose: () => void;
    onEquip?: () => void;
}

export default function SlotSelectionModal({ slotId, onClose, onEquip }: SlotSelectionModalProps) {
    const { character, setCharacter } = useGame();
    if (!character) return null;

    const handleEquip = async (itemId: string) => {
        try {
            const data = await equipItem(slotId, itemId);
            setCharacter({
                ...character,
                inventory: data.inventory,
                equipment: data.equipment,
                currentHp: Math.min(character.currentHp, calculateStats({ ...character, equipment: data.equipment }).hp),
            });
            onClose();
            onEquip?.();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const availableItems = character.inventory.filter((item: any) => {
        if (item.type === 'material') return false;
        const cat = slotCategories[slotId];
        if (cat === 'ring') return item.slot === 'ring1' || item.slot === 'ring2';
        if (cat === 'weapon') return item.slot === 'weapon1' || item.slot === 'weapon2';
        return item.slot === slotId;
    });

    return (
        <div style={{ marginTop: '1rem', background: '#1e1e30', padding: '0.5rem', borderRadius: '8px', border: '1px solid #555', width: '100%' }}>
            <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>Выберите предмет для {slotNames[slotId]}:</div>
            {availableItems.map((item: any) => (
                <div
                    key={item.id}
                    onClick={() => handleEquip(item.id)}
                    style={{ padding: '0.3rem 0.5rem', background: '#333', marginBottom: '0.2rem', cursor: 'pointer', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }}
                >
                    {item.name}
                </div>
            ))}
            <button onClick={onClose} style={{ marginTop: '0.5rem', background: '#555', border: 'none', borderRadius: '4px', color: '#fff', padding: '0.3rem 0.6rem', cursor: 'pointer' }}>Закрыть</button>
        </div>
    );
}