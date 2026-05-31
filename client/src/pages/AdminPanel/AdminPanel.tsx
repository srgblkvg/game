import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AdminUsers from './AdminUsers';
import AdminItems from './AdminItems';
import AdminJobs from './AdminJobs';
import AdminChat from './AdminChat';
import AdminCraft from './AdminCraft';
import AdminBattles from './AdminBattles';
import Button from '../../components/ui/Button';

const tabs = [
    { key: 'users', label: 'Игроки' },
    { key: 'items', label: 'Предметы' },
    { key: 'jobs', label: 'Работы' },
    { key: 'battles', label: 'Бои' },
    { key: 'chat', label: 'Чат' },
    { key: 'craft', label: 'Крафт' },
] as const;
type Tab = typeof tabs[number]['key'];

export default function AdminPanel() {
    const [tab, setTab] = useState<Tab>('users');
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => { logout(); navigate('/login'); };

    return (
        <div className="px-4 py-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-xl font-bold">Панель администратора</h1>
                <Button variant="danger" size="sm" onClick={handleLogout}>Выйти</Button>
            </div>

            <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar flex-wrap">
                {tabs.map(t => (
                    <Button
                        key={t.key}
                        variant={tab === t.key ? 'danger' : 'secondary'}
                        size="sm"
                        onClick={() => setTab(t.key)}
                        className="whitespace-nowrap"
                    >
                        {t.label}
                    </Button>
                ))}
            </div>

            {tab === 'users' && <AdminUsers />}
            {tab === 'items' && <AdminItems />}
            {tab === 'jobs' && <AdminJobs />}
            {tab === 'battles' && <AdminBattles />}
            {tab === 'chat' && <AdminChat />}
            {tab === 'craft' && <AdminCraft />}
        </div>
    );
}
