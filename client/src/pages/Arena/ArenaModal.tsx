interface ArenaModalProps {
    message: string;
    onClose: () => void;
}

export default function ArenaModal({ message, onClose }: ArenaModalProps) {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 500
        }}>
            <div style={{
                background: '#2a2a3e', border: '2px solid #e63946', borderRadius: '12px',
                padding: '2rem', maxWidth: '400px', textAlign: 'center', color: '#eee'
            }}>
                <p style={{ whiteSpace: 'pre-wrap' }}>{message}</p>
                <button onClick={onClose} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#e63946', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}>OK</button>
            </div>
        </div>
    );
}