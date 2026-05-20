import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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
            <div style={{ padding: '2rem', color: '#eee', textAlign: 'center' }}>
                <h2>Администратор уже существует</h2>
                <p>Регистрация нового администратора невозможна.</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', color: '#eee', maxWidth: '400px', margin: '0 auto' }}>
            <h2>Создание администратора</h2>
            <p>Первый администратор системы. После создания вы сможете войти как администратор.</p>
            <input type="text" placeholder="Логин" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: '#333', border: '1px solid #555', borderRadius: '4px', color: '#fff' }} />
            <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: '#333', border: '1px solid #555', borderRadius: '4px', color: '#fff' }} />
            <button onClick={handleRegister} style={{ width: '100%', padding: '0.5rem', background: '#e63946', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>Создать администратора</button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    );
}