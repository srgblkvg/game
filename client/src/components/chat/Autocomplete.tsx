interface AutocompleteProps {
    items: { id: number; name: string }[];
    selectedIndex: number;
    onSelect: (name: string) => void;
    onClose: () => void;
}

export default function Autocomplete({ items, selectedIndex, onSelect, onClose }: AutocompleteProps) {
    if (items.length === 0) return null;

    return (
        <div
            onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
            }}
            style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                marginBottom: '4px',
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border-light)',
                borderRadius: '6px',
                boxShadow: '0 -2px 10px rgba(0,0,0,0.5)',
                zIndex: 3000,
                color: 'var(--color-text-primary)',
                fontSize: '0.85rem',
                maxHeight: '150px',
                overflowY: 'auto',
                minWidth: '100%',
            }}
        >
            {items.map((item, idx) => (
                <div
                    key={item.id}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onSelect(item.name);
                        onClose();
                    }}
                    style={{
                        padding: '0.25rem 0.6rem',
                        cursor: 'pointer',
                        background: idx === selectedIndex ? 'var(--color-bg-card-hover)' : 'transparent',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {item.name}
                </div>
            ))}
        </div>
    );
}
