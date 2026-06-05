import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { fetchCharacter } from '../../api/character';
import { changeUsername, changePassword, changeGender, deleteAccount, registerGuest, resendCode } from '../../api';
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

    // Гостевая регистрация
    const [guestStep, setGuestStep] = useState<'form' | 'code'>('form');
    const [guestUsername, setGuestUsername] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestPassword, setGuestPassword] = useState('');
    const [guestShowPassword, setGuestShowPassword] = useState(false);
    const [guestCode, setGuestCode] = useState('');
    const [guestMsg, setGuestMsg] = useState('');
    const [guestLoading, setGuestLoading] = useState(false);
    const [guestResendMsg, setGuestResendMsg] = useState('');

    if (!user) return null;

    const handleRegisterGuest = async () => {
        setGuestMsg('');
        if (!guestUsername || !guestEmail || !guestPassword) {
            setGuestMsg('Заполните все поля');
            return;
        }
        if (guestPassword.length < 8) {
            setGuestMsg('Пароль: минимум 8 символов');
            return;
        }
        try {
            setGuestLoading(true);
            // Отправляем код на почту (обновляет emailCode у существующего гостя)
            await resendCode(guestEmail);
            setGuestStep('code');
        } catch (e: any) { setGuestMsg(e.message); }
        finally { setGuestLoading(false); }
    };

    const handleGuestResend = async () => {
        setGuestResendMsg('');
        try {
            setGuestLoading(true);
            await resendCode(guestEmail);
            setGuestResendMsg('Код отправлен повторно');
        } catch (e: any) { setGuestResendMsg(e.message); }
        finally { setGuestLoading(false); }
    };

    const handleGuestVerify = async () => {
        setGuestMsg('');
        try {
            setGuestLoading(true);
            const result = await registerGuest(guestUsername, guestPassword, guestEmail, guestCode);
            localStorage.setItem('token', result.token);
            loginUser({ id: user.id, username: result.username, level: user.level, role: 'player', isGuest: false }, result.token);
            setGuestMsg('Аккаунт успешно создан!');
            fetchCharacter().then(setCharacter);
        } catch (e: any) { setGuestMsg(e.message); }
        finally { setGuestLoading(false); }
    };

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
            <h2 className="text-xl font-bold mb-4">Аккаунт</h2>
            <p className="mb-4">Текущее имя: <strong>{character?.username || user.username}</strong></p>

            {/* Гостевая регистрация */}
            {user.isGuest && (
                <Card className="mb-4">
                    {guestStep === 'code' ? (
                        <>
                            <h3 className="font-bold mb-2">Подтверждение почты</h3>
                            <p className="text-sm text-[var(--color-text-muted)] mb-2">
                                Код отправлен на <span className="text-[var(--color-text-primary)]">{guestEmail}</span>
                            </p>
                            <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded p-2 mb-3">
                                ⚠ Письмо может попасть в спам. Если не пришло — проверьте папку «Спам».
                            </p>
                            <input
                                type="text"
                                placeholder="123456"
                                maxLength={6}
                                value={guestCode}
                                onChange={e => setGuestCode(e.target.value.replace(/\D/g, ''))}
                                className="w-full p-2 mb-3 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-center text-2xl tracking-[0.5em] outline-none focus:border-[var(--color-accent-info)]"
                                autoFocus
                            />
                            <Button variant="danger" fullWidth onClick={handleGuestVerify} disabled={guestCode.length !== 6 || guestLoading}>
                                {guestLoading ? '...' : 'Подтвердить'}
                            </Button>
                            {guestMsg && <p className="text-red-500 mt-2 text-sm">{guestMsg}</p>}
                            {guestResendMsg && <p className={`text-sm mt-2 ${guestResendMsg.includes('отправлен') ? 'text-green-400' : 'text-red-500'}`}>{guestResendMsg}</p>}
                            <div className="flex gap-2 mt-3">
                                <button onClick={handleGuestResend} disabled={guestLoading} className="flex-1 text-sm text-[var(--color-accent-info)] hover:underline">
                                    Отправить код повторно
                                </button>
                                <button onClick={() => setGuestStep('form')} className="flex-1 text-sm text-[var(--color-text-muted)] hover:underline">
                                    ← Назад
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <h3 className="font-bold mb-2">Регистрация аккаунта</h3>
                            <p className="text-sm text-[var(--color-text-muted)] mb-3">
                                Создайте постоянный аккаунт — все накопленные ресурсы сохранятся.
                            </p>
                            <input
                                type="text"
                                placeholder="Логин"
                                value={guestUsername}
                                onChange={e => setGuestUsername(e.target.value)}
                                className="w-full p-2 mb-2 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-info)]"
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                value={guestEmail}
                                onChange={e => setGuestEmail(e.target.value)}
                                className="w-full p-2 mb-2 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-info)]"
                            />
                            <div className="relative mb-1">
                                <input
                                    type={guestShowPassword ? 'text' : 'password'}
                                    placeholder="Пароль"
                                    value={guestPassword}
                                    onChange={e => setGuestPassword(e.target.value)}
                                    className="w-full p-2 pr-10 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-accent-info)]"
                                />
                                <button
                                    type="button"
                                    onClick={() => setGuestShowPassword(!guestShowPassword)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                                >
                                    {guestShowPassword ? '🙈' : '👁'}
                                </button>
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)] mb-3">Минимум 8 символов, цифра и спецсимвол</p>
                            <Button variant="danger" fullWidth onClick={handleRegisterGuest} disabled={!guestUsername || !guestEmail || !guestPassword || guestLoading}>
                                {guestLoading ? '...' : 'Зарегистрироваться'}
                            </Button>
                            {guestMsg && <p className="text-red-500 mt-2 text-sm">{guestMsg}</p>}
                        </>
                    )}
                </Card>
            )}

            {/* Смена имени */}
            {!user.isGuest && (
            <Card className="mb-4">
                <h3 className="font-bold mb-2">Сменить имя</h3>
                <form onSubmit={handleChangeUsername}>
                    <input type="text" placeholder="Новое имя" value={newUsername} onChange={e => setNewUsername(e.target.value)} className={inputClass} required />
                    <Button variant="primary" size="sm" type="submit">Сохранить</Button>
                </form>
                {usernameMsg && <p className={`mt-2 text-sm ${usernameMsg.includes('успешно') ? 'text-[var(--color-accent-success)]' : 'text-red-500'}`}>{usernameMsg}</p>}
            </Card>
            )}

            {/* Смена пароля */}
            {!user.isGuest && (
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
            )}

            {/* Выбор пола */}
            {!user.isGuest && (
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
            )}

            <Button variant="danger" size="md" fullWidth onClick={handleLogout}>Выйти</Button>

            {/* Удаление аккаунта */}
            {!user.isGuest && (
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
            )}
        </div>
    );
}
