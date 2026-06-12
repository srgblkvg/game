import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function AdminRegisterPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [allowRegister, setAllowRegister] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetch('http://localhost:3001/api/admin/check')
            .then(r => r.json())
            .then(data => setAllowRegister(!data.exists))
            .catch(() => setAllowRegister(false));
    }, []);

    const handleRegister = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/admin/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Ошибка');
            }
            navigate('/login');
        } catch (e: any) {
            setError(e.message);
        }
    };

    if (!allowRegister) {
        return (
            <div className="text-center mt-8 px-4">
                <h2 className="text-lg font-bold mb-2">Администратор уже существует</h2>
                <p className="text-[var(--color-text-secondary)]">Регистрация нового администратора невозможна.</p>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto mt-8 px-4">
            <Card padding="lg">
                <h2 className="text-lg font-bold mb-2">Создание администратора</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                    Первый администратор системы. После создания вы сможете войти как администратор.
                </p>
                <input
                    type="text" placeholder="Логин"
                    value={username} onChange={e => setUsername(e.target.value)}
                    className="w-full p-2 mb-2 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm outline-none"
                />
                <input
                    type="password" placeholder="Пароль"
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full p-2 mb-3 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm outline-none"
                />
                <Button variant="danger" fullWidth onClick={handleRegister}>
                    Создать администратора
                </Button>
                {error && <p className="text-[var(--color-accent-danger)] mt-2 text-sm">{error}</p>}
            </Card>
        </div>
    );
}
