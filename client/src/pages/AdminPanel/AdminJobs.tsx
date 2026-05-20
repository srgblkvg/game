import { useState, useEffect } from 'react';
import { fetchAdminJobs, createAdminJob, updateAdminJob, deleteAdminJob, adminFinishJobsByJobId } from '../../api';

export default function AdminJobs() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [message, setMessage] = useState('');
    const [editingJob, setEditingJob] = useState<any>(null);
    const [newJob, setNewJob] = useState({ name: '', description: '', duration: 0, rewardMin: 0, rewardMax: 0 });

    const loadJobs = async () => {
        try { setJobs(await fetchAdminJobs()); } catch (e) { console.error(e); }
    };

    useEffect(() => { loadJobs(); }, []);

    const handleCreateJob = async () => {
        try {
            await createAdminJob(newJob);
            setMessage('Работа создана');
            loadJobs();
            setNewJob({ name: '', description: '', duration: 0, rewardMin: 0, rewardMax: 0 });
        } catch (e: any) { setMessage(e.message); }
    };

    const handleUpdateJob = async () => {
        try {
            await updateAdminJob(editingJob.id, editingJob);
            setMessage('Работа обновлена');
            setEditingJob(null);
            loadJobs();
        } catch (e: any) { setMessage(e.message); }
    };

    const handleDeleteJob = async (id: number) => {
        if (!confirm('Удалить работу?')) return;
        try { await deleteAdminJob(id); loadJobs(); } catch (e: any) { setMessage(e.message); }
    };

    const handleFinishAllJobsByType = async (jobId: number) => {
        try {
            const res = await adminFinishJobsByJobId(jobId);
            setMessage(`Завершено работ: ${res.count}`);
            loadJobs(); // список игроков не обновляем, т.к. это другой компонент
        } catch (e: any) { setMessage(e.message); }
    };

    return (
        <div>
            <div style={{ marginBottom: '1rem', background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                <h3>{editingJob ? 'Редактировать работу' : 'Добавить работу'}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label>Название<br /><input placeholder="Название" value={editingJob ? editingJob.name : newJob.name} onChange={e => editingJob ? setEditingJob({ ...editingJob, name: e.target.value }) : setNewJob({ ...newJob, name: e.target.value })} style={inputStyle} /></label>
                    <label>Описание<br /><input placeholder="Описание" value={editingJob ? editingJob.description : newJob.description} onChange={e => editingJob ? setEditingJob({ ...editingJob, description: e.target.value }) : setNewJob({ ...newJob, description: e.target.value })} style={inputStyle} /></label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <label style={{ flex: 1 }}>Длительность (сек)<br /><input type="number" value={editingJob ? editingJob.duration : newJob.duration} onChange={e => editingJob ? setEditingJob({ ...editingJob, duration: +e.target.value }) : setNewJob({ ...newJob, duration: +e.target.value })} style={inputStyle} /></label>
                        <label style={{ flex: 1 }}>Мин. награда<br /><input type="number" value={editingJob ? editingJob.rewardMin : newJob.rewardMin} onChange={e => editingJob ? setEditingJob({ ...editingJob, rewardMin: +e.target.value }) : setNewJob({ ...newJob, rewardMin: +e.target.value })} style={inputStyle} /></label>
                        <label style={{ flex: 1 }}>Макс. награда<br /><input type="number" value={editingJob ? editingJob.rewardMax : newJob.rewardMax} onChange={e => editingJob ? setEditingJob({ ...editingJob, rewardMax: +e.target.value }) : setNewJob({ ...newJob, rewardMax: +e.target.value })} style={inputStyle} /></label>
                    </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                    {editingJob ? (
                        <>
                            <button onClick={handleUpdateJob} style={{ background: '#2ecc71', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', marginRight: '0.5rem' }}>Сохранить</button>
                            <button onClick={() => setEditingJob(null)} style={{ background: '#e74c3c', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Отмена</button>
                        </>
                    ) : (
                        <button onClick={handleCreateJob} style={{ background: '#2ecc71', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Создать</button>
                    )}
                </div>
            </div>

            <div style={{ background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                <h3>Все работы</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #444' }}>
                            <th>ID</th><th>Название</th><th>Длит.</th><th>Мин.</th><th>Макс.</th><th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {jobs.map((job: any) => (
                            <tr key={job.id} style={{ borderBottom: '1px solid #333' }}>
                                <td>{job.id}</td><td>{job.name}</td><td>{job.duration}</td><td>{job.rewardMin}</td><td>{job.rewardMax}</td>
                                <td>
                                    <button onClick={() => setEditingJob(job)} style={{ background: '#3498db', border: 'none', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', marginRight: '0.3rem' }}>Ред.</button>
                                    <button onClick={() => handleDeleteJob(job.id)} style={{ background: '#c0392b', border: 'none', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', marginRight: '0.3rem' }}>Удалить</button>
                                    <button onClick={() => handleFinishAllJobsByType(job.id)} style={{ background: '#8e44ad', border: 'none', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>Завершить все</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {message && <div style={{ marginTop: '1rem', background: '#2a2a3e', padding: '0.5rem', borderRadius: '4px' }}>{message}</div>}
        </div>
    );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '0.3rem', marginBottom: '0.5rem', background: '#333', border: '1px solid #555', borderRadius: '4px', color: '#fff' };