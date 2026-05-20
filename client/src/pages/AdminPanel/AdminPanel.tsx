import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AdminUsers from './AdminUsers';
import AdminItems from './AdminItems';
import AdminJobs from './AdminJobs';
import AdminChat from './AdminChat';
import AdminCraft from './AdminCraft';

export default function AdminPanel() {
    const [tab, setTab] = useState<'users' | 'items' | 'jobs' | 'chat' | 'craft'>('users');
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div style={{ padding: '1rem', color: '#eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h1>Панель администратора</h1>
                <button
                    onClick={handleLogout}
                    style={{
                        background: '#c0392b',
                        border: 'none',
                        color: '#fff',
                        padding: '0.4rem 1rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 'bold',
                    }}
                >
                    Выйти
                </button>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                {(['users', 'items', 'jobs', 'chat', 'craft'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        style={{
                            padding: '0.5rem 1rem',
                            background: tab === t ? '#e63946' : '#555',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontWeight: tab === t ? 'bold' : 'normal',
                        }}
                    >
                        {t === 'users' ? 'База Игроков' : t === 'items' ? 'База Предметов' : t === 'jobs' ? 'База Работ' : t === 'chat' ? 'Чат' : 'База Крафта'}
                    </button>
                ))}
            </div>

            {tab === 'users' && <AdminUsers />}
            {tab === 'items' && <AdminItems />}
            {tab === 'jobs' && <AdminJobs />}
            {tab === 'chat' && <AdminChat />}
            {tab === 'craft' && <AdminCraft />}
        </div>
    );
}