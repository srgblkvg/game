import { fetchAdminJobs, createAdminJob, updateAdminJob, deleteAdminJob, adminFinishJobsByJobId } from '../../api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ImageUploader from '../../components/ImageUploader';
import BulkImageUploader from '../../components/BulkImageUploader';
import { inputClass } from '../../utils/formStyles';
import { useCrud } from '../../hooks/useCrud';

const DEFAULT_JOB = { name: '', description: '', duration: 0, rewardMin: 0, rewardMax: 0, background: '' };

export default function AdminJobs() {
  const crud = useCrud({
    fetchAll: fetchAdminJobs,
    createItem: createAdminJob,
    updateItem: (id, item) => updateAdminJob(id, item),
    deleteItem: deleteAdminJob,
    defaultItem: DEFAULT_JOB,
  });

  const handleFinishAll = async (jobId: number) => {
    try {
      await adminFinishJobsByJobId(jobId);
      crud.clearMessage();
      crud.load();
    } catch (e: any) { /* ignore */ }
  };

  const formData = crud.editing || crud.newItem;
  const setForm = crud.editing
    ? (upd: any) => crud.setEditing((prev: any) => ({ ...prev, ...upd }))
    : (upd: any) => crud.setNewItem(upd);

  return (
    <div>
      <Card className="mb-4">
        <h3 className="font-bold mb-2">{crud.editing ? 'Редактировать работу' : 'Добавить работу'}</h3>
        <div className="flex flex-col gap-2">
          <label className="text-sm">Название<br />
            <input value={formData.name} onChange={e => setForm({ name: e.target.value })} className={inputClass} />
          </label>
          <label className="text-sm">Описание<br />
            <input value={formData.description} onChange={e => setForm({ description: e.target.value })} className={inputClass} />
          </label>
          <div className="flex gap-2">
            <label className="text-sm flex-1">Длительность (сек)<br />
              <input type="number" value={formData.duration} onChange={e => setForm({ duration: +e.target.value })} className={inputClass} />
            </label>
            <label className="text-sm flex-1">Мин. награда<br />
              <input type="number" value={formData.rewardMin} onChange={e => setForm({ rewardMin: +e.target.value })} className={inputClass} />
            </label>
            <label className="text-sm flex-1">Макс. награда<br />
              <input type="number" value={(formData as any).rewardMax ?? ''} onChange={e => setForm({ ...formData, rewardMax: +e.target.value } as any)} className={inputClass} />
            </label>
          </div>
          <ImageUploader
            currentUrl={formData.background || null}
            folder="jobs"
            onUploaded={(url) => setForm({ background: url })}
            label="Фоновое изображение"
          />
        </div>
        <div className="mt-3 flex gap-2">
          {crud.editing ? (
            <>
              <Button variant="success" size="md" onClick={crud.update}>Сохранить</Button>
              <Button variant="danger" size="md" onClick={crud.cancelEdit}>Отмена</Button>
            </>
          ) : (
            <Button variant="success" size="md" onClick={crud.create}>Создать</Button>
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
              {crud.items.map((job: any) => (
                <tr key={job.id} className="border-b border-[var(--color-border-light)]">
                  <td className="p-1">{job.id}</td><td className="p-1">{job.name}</td><td className="p-1">{job.duration}</td><td className="p-1">{job.rewardMin}</td><td className="p-1">{job.rewardMax}</td>
                  <td className="p-1">
                    <Button variant="primary" size="md" className="mr-1" onClick={() => crud.startEdit(job)}>Ред.</Button>
                    <Button variant="danger" size="md" className="mr-1" onClick={() => crud.remove(job.id)}>Удалить</Button>
                    <Button size="md" style={{ background: '#8e44ad' }} onClick={() => handleFinishAll(job.id)}>Завершить все</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <BulkImageUploader
        items={crud.items.map((j: any) => ({ id: j.id, name: j.name, imagePath: j.background }))}
        title="Массовая загрузка фонов работ"
      />

      {crud.message && <div className="mt-4 p-3 bg-[var(--color-bg-card)] rounded text-sm">{crud.message}</div>}
    </div>
  );
}
