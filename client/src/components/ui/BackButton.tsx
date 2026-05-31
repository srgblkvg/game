import { useNavigate } from 'react-router-dom';
import Button from './Button';

interface BackButtonProps {
  to?: string;
}

export default function BackButton({ to }: BackButtonProps) {
  const navigate = useNavigate();
  return (
    <div className="mb-4">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => (to ? navigate(to) : navigate(-1))}
      >
        ← Назад
      </Button>
    </div>
  );
}
