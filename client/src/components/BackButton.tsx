import { useNavigate } from 'react-router-dom';

export default function BackButton() {
    const navigate = useNavigate();
    return (
        <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-3 cursor-pointer"
        >
            ← Назад
        </button>
    );
}
