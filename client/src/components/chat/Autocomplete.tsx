interface AutocompleteProps {
    items: { id: number; name: string }[];
    selectedIndex: number;
    onSelect: (name: string) => void;
    onClose: () => void;
}

export default function Autocomplete({ items, selectedIndex, onSelect, onClose }: AutocompleteProps) {
    if (items.length === 0) return null;

    return (
        <div style={{
            position: 'absolute',
            bottom: '100%',          // над инпутом
            left: 0,
            marginBottom: '4px',
            background: '#2a2a3e',
            border: '1px solid #555',
            borderRadius: '6px',
            boxShadow: '0 -2px 10px rgba(0,0,0,0.5)',
            zIndex: 3000,
            color: '#eee',
            fontSize: '0.85rem',
            maxHeight: '150px',
            overflowY: 'auto',
            minWidth: '100%',
        }}>
            {items.map((item, idx) => (
                <div
                    key={item.id}
                    onClick={() => { onSelect(item.name); onClose(); }}
                    style={{
                        padding: '0.25rem 0.6rem',
                        cursor: 'pointer',
                        background: idx === selectedIndex ? '#3a3a5e' : 'transparent',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {item.name}
                </div>
            ))}
        </div>
    );
}