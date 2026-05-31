import { useState, useEffect } from 'react';
import { fetchAdminJobs, createAdminJob, updateAdminJob, deleteAdminJob, adminFinishJobsByJobId } from '../../api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

const inputClass = 'w-full p-1.5 mb-1 bg-[var(--color-bg-input)] border border-[var(--color-border-light)] rounded text-[var(--color-text-primary)] text-sm';

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
            loadJobs();
        } catch (e: any) { setMessage(e.message); }
    };

    const formData = editingJob || newJob;
    const setForm = editingJob ? setEditingJob : setNewJob;

    return (
        <div>
            <Card className="mb-4">
                <h3 className="font-bold mb-2">{editingJob ? 'Редактировать работу' : 'Добавить работу'}</h3>
                <div className="flex flex-col gap-2">
                    <label className="text-sm">
                        Название<br />
                        <input placeholder="Название" value={formData.name} onChange={e => setForm({ ...formData, name: e.target.value })} className={inputClass} />
                    </label>
                    <label className="text-sm">
                        Описание<br />
                        <input placeholder="Описание" value={formData.description} onChange={e => setForm({ ...formData, description: e.target.value })} className={inputClass} />
                    </label>
                    <div className="flex gap-2">
                        <label className="text-sm flex-1">
                            Длительность (сек)<br />
                            <input type="number" value={formData.duration} onChange={e => setForm({ ...formData, duration: +e.target.value })} className={inputClass} />
                        </label>
                        <label className="text-sm flex-1">
                            Мин. награда<br />
                            <input type="number" value={formData.rewardMin} onChange={e => setForm({ ...formData, rewardMin: +e.target.value })} className={inputClass} />
                        </label>
                        <label className="text-sm flex-1">
                            Макс. награда<br />
                            <input type="number" value={formData.rewardMax} onChange={e => setForm({ ...formData, rewardMax: +e.target.value })} className={inputClass} />
                        </label>
                    </div>
                </div>
                <div className="mt-3 flex gap-2">
                    {editingJob ? (
                        <>
                            <Button variant="success" size="sm" onClick={handleUpdateJob}>Сохранить</Button>
                            <Button variant="danger" size="sm" onClick={() => setEditingJob(null)}>Отмена</Button>
                        </>
                    ) : (
                        <Button variant="success" size="sm" onClick={handleCreateJob}>Создать</Button>
                    )}
                </div>
            </Card>

            <Card>
                <h3 className="font-bold mb-2">Все работы</h3>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-[var(--color-border-default)]">
                                <th className="text-left p-1">ID</th><th className="text-left p-1">Название</th><th className="text-left p-1">Длит.</th><th className="text-left p-1">Мин.</th><th className="text-left p-1">Макс.</th><th className="text-left p-1">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map((job: any) => (
                                <tr key={job.id} className="border-b border-[var(--color-border-light)]">
                                    <td className="p-1">{job.id}</td><td className="p-1">{job.name}</td><td className="p-1">{job.duration}</td><td className="p-1">{job.rewardMin}</td><td className="p-1">{job.rewardMax}</td>
                                    <td className="p-1">
                                        <Button variant="primary" size="xs" className="mr-1" onClick={() => setEditingJob(job)}>Ред.</Button>
                                        <Button variant="danger" size="xs" className="mr-1" onClick={() => handleDeleteJob(job.id)}>Удалить</Button>
                                        <Button size="xs" style={{ background: '#8e44ad' }} onClick={() => handleFinishAllJobsByType(job.id)}>Завершить все</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {message && <div className="mt-4 p-3 bg-[var(--color-bg-card)] rounded text-sm">{message}</div>}
        </div>
    );
}
