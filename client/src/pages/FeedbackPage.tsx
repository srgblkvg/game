import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import BackButton from '../components/BackButton';
import { inputClass } from '../utils/formStyles';

export default function FeedbackPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { if (!user) navigate('/login'); }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setMsg('');
        if (!subject.trim()) { setMsg('Укажите тему'); return; }
        if (!message.trim()) { setMsg('Введите сообщение'); return; }
        try {
            setLoading(true);
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
            });
            const data = await res.json();
            if (res.ok) { setSubject(''); setMessage(''); setMsg('✅ Отправлено. Спасибо!'); }
            else setMsg(data.error || 'Ошибка');
        } catch { setMsg('Ошибка сети'); }
        finally { setLoading(false); }
    };

    return (
        <div className="max-w-lg mx-auto px-4 py-4">
            <BackButton />
            <h1 className="text-xl font-bold mb-4">📬 Обратная связь</h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
                Есть идея, вопрос или нашли баг? Напишите нам — администратор прочитает.
            </p>
            <Card>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder="Тема"
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        className={inputClass}
                    />
                    <textarea
                        placeholder="Сообщение"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        className={inputClass}
                        rows={5}
                        style={{ resize: 'vertical' }}
                    />
                    <Button variant="primary" size="md" type="submit" disabled={loading}>
                        {loading ? 'Отправка...' : 'Отправить'}
                    </Button>
                    {msg && <p className={`mt-2 text-sm ${msg.startsWith('✅') ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-accent-danger)]'}`}>{msg}</p>}
                </form>
            </Card>
        </div>
    );
}
