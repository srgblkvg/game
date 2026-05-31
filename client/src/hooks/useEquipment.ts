import { equipItem } from '../api';
import { useGame } from '../contexts/GameContext';

export function useEquipment(onEquip?: () => void) {
    const { character, setCharacter } = useGame();

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (slotId: string, e: React.DragEvent) => {
        e.preventDefault();
        const itemId = e.dataTransfer.getData('text/plain');
        if (!itemId || !character) return;
        try {
            const data = await equipItem(slotId, itemId);
            setCharacter({
                ...character,
                inventory: data.inventory,
                equipment: data.equipment,
                currentHp: data.currentHp ?? Math.max(1, character.currentHp),
            });
            onEquip?.();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleSlotClick = async (slotId: string) => {
        if (!character) return;
        if (character.equipment[slotId]) {
            // снять предмет
            try {
                const data = await equipItem(slotId);
                setCharacter({
                    ...character,
                    inventory: data.inventory,
                    equipment: data.equipment,
                    currentHp: data.currentHp ?? Math.max(1, character.currentHp),
                });
                onEquip?.();
            } catch (err: any) {
                alert(err.message);
            }
        }
        // если слот пуст – просто возвращаем false, чтобы родитель открыл модальное окно
        return character.equipment[slotId] ? true : false;
    };

    return { handleDragOver, handleDrop, handleSlotClick };
}