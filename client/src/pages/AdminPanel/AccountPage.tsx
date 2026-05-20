import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { fetchCharacter } from '../../api/character';
import { changeUsername, changePassword, changeGender } from '../../api';

export default function AccountPage() {
    const { user, loginUser, logout } = useAuth();
    const { setCharacter } = useGame();
    const navigate = useNavigate();

    const [newUsername, setNewUsername] = useState('');
    const [usernameMsg, setUsernameMsg] = useState('');

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [passwordMsg, setPasswordMsg] = useState('');

    const [genderMsg, setGenderMsg] = useState('');

    if (!user) return null;

    const handleChangeUsername = async (e: React.FormEvent) => {
        e.preventDefault();
        setUsernameMsg('');
        try {
            const result = await changeUsername(newUsername);
            loginUser({ ...user, username: result.newUsername }, localStorage.getItem('token')!);
            setNewUsername('');
            setUsernameMsg('Имя успешно изменено');
        } catch (err: any) {
            setUsernameMsg(err.message);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordMsg('');
        try {
            await changePassword(oldPassword, newPassword);
            setOldPassword('');
            setNewPassword('');
            setPasswordMsg('Пароль успешно изменён');
        } catch (err: any) {
            setPasswordMsg(err.message);
        }
    };

    const handleGenderChange = async (newGender: 'male' | 'female') => {
        try {
            await changeGender(newGender);
            loginUser({ ...user, gender: newGender }, localStorage.getItem('token')!);
            // Принудительно обновляем данные персонажа с сервера, чтобы гарантировать актуальный gender
            const fresh = await fetchCharacter();
            setCharacter(fresh);
            setGenderMsg('Пол изменён');
        } catch (err: any) {
            setGenderMsg(err.message);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const currentGender = user.gender || 'male';

    return (
        <div style={{ padding: '1rem', color: '#eee', maxWidth: '500px', margin: '0 auto' }}>
            <button onClick={() => navigate('/')} style={{ background: '#555', border: 'none', color: '#fff', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', marginBottom: '1rem' }}>← Назад</button>
            <h2>👤 Аккаунт</h2>
            <p>Текущее имя: <strong>{user.username}</strong></p>

            {/* Смена имени */}
            <div style={{ background: '#1e1e30', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <h3>Сменить имя</h3>
                <form onSubmit={handleChangeUsername}>
                    <input type="text" placeholder="Новое имя" value={newUsername} onChange={e => setNewUsername(e.target.value)} style={inputStyle} required />
                    <button type="submit" style={{ ...buttonStyle, background: '#3498db' }}>Сохранить</button>
                </form>
                {usernameMsg && <p style={{ margin: '0.5rem 0', color: usernameMsg.includes('успешно') ? '#2ecc71' : '#e74c3c' }}>{usernameMsg}</p>}
            </div>

            {/* Смена пароля */}
            <div style={{ background: '#1e1e30', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <h3>Сменить пароль</h3>
                <form onSubmit={handleChangePassword}>
                    <input type="password" placeholder="Старый пароль" value={oldPassword} onChange={e => setOldPassword(e.target.value)} style={inputStyle} required />
                    <input type="password" placeholder="Новый пароль" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} required />
                    <button type="submit" style={{ ...buttonStyle, background: '#3498db' }}>Сохранить</button>
                </form>
                {passwordMsg && <p style={{ margin: '0.5rem 0', color: passwordMsg.includes('успешно') ? '#2ecc71' : '#e74c3c' }}>{passwordMsg}</p>}
            </div>

            {/* Выбор пола */}
            <div style={{ background: '#1e1e30', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <h3>Пол</h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={() => handleGenderChange('male')}
                        style={{
                            ...buttonStyle,
                            background: currentGender === 'male' ? '#3498db' : '#555',
                        }}
                    >
                        Мужской
                    </button>
                    <button
                        onClick={() => handleGenderChange('female')}
                        style={{
                            ...buttonStyle,
                            background: currentGender === 'female' ? '#e91e63' : '#555',
                        }}
                    >
                        Женский
                    </button>
                </div>
                {genderMsg && <p style={{ margin: '0.5rem 0', color: genderMsg.includes('успешно') ? '#2ecc71' : '#e74c3c' }}>{genderMsg}</p>}
            </div>

            <button onClick={handleLogout} style={{ ...buttonStyle, background: '#c0392b' }}>Выйти</button>
        </div>
    );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '0.4rem', marginBottom: '0.5rem', background: '#333', border: '1px solid #555', borderRadius: '4px', color: '#fff' };
const buttonStyle: React.CSSProperties = { border: 'none', color: '#fff', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };