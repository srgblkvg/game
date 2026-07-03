import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { changeAdminPassword } from '../../api/admin';
import AdminUsers from './AdminUsers';
import AdminItems from './AdminItems';
import AdminJobs from './AdminJobs';
import AdminChat from './AdminChat';
import AdminCraft from './AdminCraft';
import AdminBattles from './AdminBattles';
import AdminTournaments from './AdminTournaments';
import AdminGame from './AdminGame';
import AdminOnline from './AdminOnline';
import AdminFeedback from './AdminFeedback';
import AdminCollections from './AdminCollections';
import AdminBots from './AdminBots';
import Button from '../../components/ui/Button';
import { inputClass } from '../../utils/formStyles';

const tabs = [
    { key: 'users', label: 'Игроки' },
    { key: 'items', label: 'Предметы' },
    { key: 'jobs', label: 'Работы' },
    { key: 'battles', label: 'Бои' },
    { key: 'tournaments', label: 'Турниры' },
    { key: 'game', label: 'Игра' },
    { key: 'chat', label: 'Чат' },
    { key: 'craft', label: 'Ремесло' },
    { key: 'online', label: 'Онлайн' },
    { key: 'feedback', label: 'Обращения' },
    { key: 'collections', label: 'Коллекция' },
    { key: 'bots', label: 'Боты' },
] as const;
type Tab = typeof tabs[number]['key'];

export default function AdminPanel() {
    const [tab, setTab] = useState<Tab>('users');
    const { logout } = useAuth();
    const navigate = useNavigate();

    // Смена пароля
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passwordMsg, setPasswordMsg] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);

    const handleLogout = () => { logout(); navigate('/login'); };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault(); setPasswordMsg('');
        try {
            setPasswordLoading(true);
            await changeAdminPassword(oldPassword, newPassword);
            setOldPassword(''); setNewPassword('');
            setPasswordMsg('Пароль успешно изменён');
        } catch (err: any) {
            setPasswordMsg(err.message);
        } finally {
            setPasswordLoading(false);
        }
    };

    return (
        <div className="px-4 py-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-xl font-bold">Панель администратора</h1>
                <div className="flex gap-2">
                    <Button variant="secondary" size="md" onClick={() => setShowPasswordForm(!showPasswordForm)}>
                        {showPasswordForm ? 'Отмена' : '🔑 Сменить пароль'}
                    </Button>
                    <Button variant="danger" size="md" onClick={handleLogout}>Выйти</Button>
                </div>
            </div>

            {showPasswordForm && (
                <div className="mb-4 max-w-md">
                    <form onSubmit={handleChangePassword} className="bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded p-3 flex flex-col gap-2">
                        <h3 className="font-bold text-sm">Смена пароля</h3>
                        <input
                            type="password"
                            placeholder="Старый пароль"
                            value={oldPassword}
                            onChange={e => setOldPassword(e.target.value)}
                            className={inputClass}
                            required
                        />
                        <input
                            type="password"
                            placeholder="Новый пароль (мин. 8 символов)"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className={inputClass}
                            required
                            minLength={8}
                        />
                        <Button variant="primary" size="md" type="submit" disabled={passwordLoading}>
                            {passwordLoading ? '...' : 'Сохранить'}
                        </Button>
                        {passwordMsg && (
                            <p className={`text-sm ${passwordMsg.includes('успешно') ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-accent-danger)]'}`}>
                                {passwordMsg}
                            </p>
                        )}
                    </form>
                </div>
            )}

            <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar flex-wrap">
                {tabs.map(t => (
                    <Button
                        key={t.key}
                        variant={tab === t.key ? 'danger' : 'secondary'}
                        size="md"
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
            {tab === 'tournaments' && <AdminTournaments />}
            {tab === 'game' && <AdminGame />}
            {tab === 'chat' && <AdminChat />}
            {tab === 'craft' && <AdminCraft />}
            {tab === 'online' && <AdminOnline />}
            {tab === 'feedback' && <AdminFeedback />}
            {tab === 'collections' && <AdminCollections />}
            {tab === 'bots' && <AdminBots />}
        </div>
    );
}
