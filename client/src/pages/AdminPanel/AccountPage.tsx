import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { fetchCharacter } from '../../api/character';
import { changeUsername, changePassword, changeGender, deleteAccount } from '../../api';
import BackButton from '../../components/ui/BackButton';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { inputClass } from '../../utils/formStyles';

export default function AccountPage() {
    const { user, loginUser, logout } = useAuth();
    const { character, setCharacter } = useGame();
    const navigate = useNavigate();

    const [newUsername, setNewUsername] = useState('');
    const [usernameMsg, setUsernameMsg] = useState('');

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passwordMsg, setPasswordMsg] = useState('');

    const [genderMsg, setGenderMsg] = useState('');
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteMsg, setDeleteMsg] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    if (!user) return null;

    const handleChangeUsername = async (e: React.FormEvent) => {
        e.preventDefault(); setUsernameMsg('');
        try {
            const result = await changeUsername(newUsername);
            loginUser({ ...user, username: result.newUsername }, localStorage.getItem('token')!);
            setNewUsername(''); setUsernameMsg('Имя успешно изменено');
        } catch (err: any) { setUsernameMsg(err.message); }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault(); setPasswordMsg('');
        try {
            await changePassword(oldPassword, newPassword);
            setOldPassword(''); setNewPassword(''); setPasswordMsg('Пароль успешно изменён');
        } catch (err: any) { setPasswordMsg(err.message); }
    };

    const handleGenderChange = async (newGender: 'male' | 'female') => {
        try {
            await changeGender(newGender);
            loginUser({ ...user, gender: newGender }, localStorage.getItem('token')!);
            const fresh = await fetchCharacter();
            setCharacter(fresh);
            setGenderMsg('Пол изменён');
        } catch (err: any) { setGenderMsg(err.message); }
    };

    const handleLogout = () => { logout(); navigate('/login'); };

    const handleDeleteAccount = async (e: React.FormEvent) => {
        e.preventDefault(); setDeleteMsg('');
        try {
            await deleteAccount(deletePassword);
            logout(); navigate('/login');
        } catch (err: any) { setDeleteMsg(err.message); }
    };

    const currentGender = character?.gender || user.gender || 'male';

    return (
        <div className="max-w-lg mx-auto px-4 py-4">
            <BackButton />
            <h2 className="text-xl font-bold mb-4">👤 Аккаунт</h2>
            <p className="mb-4">Текущее имя: <strong>{character?.username || user.username}</strong></p>

            {/* Смена имени */}
            <Card className="mb-4">
                <h3 className="font-bold mb-2">Сменить имя</h3>
                <form onSubmit={handleChangeUsername}>
                    <input type="text" placeholder="Новое имя" value={newUsername} onChange={e => setNewUsername(e.target.value)} className={inputClass} required />
                    <Button variant="primary" size="sm" type="submit">Сохранить</Button>
                </form>
                {usernameMsg && <p className={`mt-2 text-sm ${usernameMsg.includes('успешно') ? 'text-[var(--color-accent-success)]' : 'text-red-500'}`}>{usernameMsg}</p>}
            </Card>

            {/* Смена пароля */}
            <Card className="mb-4">
                <h3 className="font-bold mb-2">Сменить пароль</h3>
                <form onSubmit={handleChangePassword}>
                    <input type="password" placeholder="Старый пароль" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className={inputClass} required />
                    <input type="password" placeholder="Новый пароль" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} required />
                    <p className="text-xs text-[var(--color-text-muted)] mb-2">Минимум 8 символов, цифра и спецсимвол</p>
                    <Button variant="primary" size="sm" type="submit">Сохранить</Button>
                </form>
                {passwordMsg && <p className={`mt-2 text-sm ${passwordMsg.includes('успешно') ? 'text-[var(--color-accent-success)]' : 'text-red-500'}`}>{passwordMsg}</p>}
            </Card>

            {/* Выбор пола */}
            <Card className="mb-4">
                <h3 className="font-bold mb-2">Пол</h3>
                <div className="flex gap-4">
                    <Button
                        variant={currentGender === 'male' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => handleGenderChange('male')}
                    >
                        Мужской
                    </Button>
                    <Button
                        variant={currentGender === 'female' ? 'primary' : 'secondary'}
                        size="sm"
                        style={{ background: currentGender === 'female' ? '#e91e63' : undefined }}
                        onClick={() => handleGenderChange('female')}
                    >
                        Женский
                    </Button>
                </div>
                {genderMsg && <p className={`mt-2 text-sm ${genderMsg.includes('успешно') ? 'text-[var(--color-accent-success)]' : 'text-red-500'}`}>{genderMsg}</p>}
            </Card>

            <Button variant="danger" size="md" fullWidth onClick={handleLogout}>Выйти</Button>

            {/* Удаление аккаунта */}
            <div className="mt-6 pt-4 border-t border-[var(--color-border-light)]">
                {!showDeleteConfirm ? (
                    <Button
                        variant="secondary"
                        size="md"
                        fullWidth
                        onClick={() => setShowDeleteConfirm(true)}
                        style={{ color: '#e03030', borderColor: '#e03030' }}
                    >
                        ⚠️ Удалить аккаунт
                    </Button>
                ) : (
                    <Card>
                        <h3 className="font-bold mb-2 text-red-500">Удаление аккаунта</h3>
                        <p className="text-sm text-[var(--color-text-muted)] mb-3">
                            Это действие необратимо. Все данные будут удалены: персонаж, история боёв, инвентарь.
                        </p>
                        <form onSubmit={handleDeleteAccount}>
                            <input
                                type="password"
                                placeholder="Введите пароль для подтверждения"
                                value={deletePassword}
                                onChange={e => setDeletePassword(e.target.value)}
                                className={inputClass}
                                required
                            />
                            <div className="flex gap-2 mt-2">
                                <Button variant="danger" size="sm" type="submit">Удалить навсегда</Button>
                                <Button variant="secondary" size="sm" onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}>
                                    Отмена
                                </Button>
                            </div>
                        </form>
                        {deleteMsg && <p className="mt-2 text-sm text-red-500">{deleteMsg}</p>}
                    </Card>
                )}
            </div>
        </div>
    );
}
