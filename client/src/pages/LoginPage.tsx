import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { login, register } from '../api';

export default function LoginPage() {
    const { loginUser } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async () => {
        try {
            setError('');
            const result = await login(username, password);
            loginUser(result.user, result.token);
            if (result.user.role === 'admin') {
                navigate('/adminpanel');
            } else {
                navigate('/');
            }
        } catch (e: any) {
            setError(e.message);
        }
    };

    const handleRegister = async () => {
        try {
            setError('');
            const result = await register(username, password);
            loginUser(result.user, result.token);
            navigate('/');
        } catch (e: any) {
            setError(e.message);
        }
    };

    return (
        <div style={{ padding: '2rem', color: '#eee', maxWidth: '400px', margin: '0 auto' }}>
            <h1>Вход в игру</h1>
            <input
                type="text"
                placeholder="Логин"
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: '#333', border: '1px solid #555', borderRadius: '4px', color: '#fff' }}
            />
            <input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: '#333', border: '1px solid #555', borderRadius: '4px', color: '#fff' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleLogin}
                    style={{ flex: 1, padding: '0.5rem', background: '#e63946', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>
                    Войти
                </button>
                <button onClick={handleRegister}
                    style={{ flex: 1, padding: '0.5rem', background: '#555', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>
                    Регистрация
                </button>
            </div>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
    );
}