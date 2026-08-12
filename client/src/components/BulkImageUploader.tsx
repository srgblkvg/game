import { useState, useRef } from 'react';
import Button from './ui/Button';
import { getHeaders } from '../api/helpers';

interface BulkImageUploaderProps {
    items: { id: number; name: string; imagePath: string | null }[];
    title?: string;
}

export default function BulkImageUploader({ items, title }: BulkImageUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const fileRefs = useRef<Map<number, HTMLInputElement>>(new Map());
    const hasItems = items.some(i => i.imagePath?.startsWith('/uploads/'));

    if (!hasItems) return null;

    const handleUpload = async () => {
        setUploading(true);
        setMessage('');
        const images: { targetPath: string; dataUrl: string }[] = [];
        for (const item of items) {
            if (!item.imagePath?.startsWith('/uploads/')) continue;
            const input = fileRefs.current.get(item.id);
            const file = input?.files?.[0];
            if (!file) continue;
            const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });
            images.push({ targetPath: item.imagePath, dataUrl });
        }
        if (images.length === 0) { setUploading(false); setMessage('Не выбрано ни одного файла'); return; }
        try {
            const res = await fetch('/api/admin/upload-bulk', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ images }),
            });
            const data = await res.json();
            const ok = data.results?.filter((r: any) => r.success).length || 0;
            setMessage(`Загружено ${ok}/${images.length}`);
        } catch (e: any) { setMessage(e.message); }
        finally { setUploading(false); }
    };

    return (
        <div className="mt-4 p-3 bg-[var(--color-bg-card)] rounded border border-[var(--color-accent-warning)]">
            <h3 className="font-bold text-sm mb-2">{title || 'Массовая загрузка изображений'}</h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-2">Файлы сохранятся под существующими именами из БД</p>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto mb-3">
                {items.filter(i => i.imagePath?.startsWith('/uploads/')).map(item => (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                        <span className="w-28 truncate text-xs">{item.name}</span>
                        <span className="text-[0.6rem] text-[var(--color-text-muted)] truncate flex-1">{item.imagePath}</span>
                        <input type="file" accept="image/*" className="text-xs w-32"
                            ref={el => { if (el) fileRefs.current.set(item.id, el); }} />
                    </div>
                ))}
            </div>
            <Button variant="primary" size="md" onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Загрузка...' : `Загрузить всё (${items.filter(i => i.imagePath?.startsWith('/uploads/')).length})`}
            </Button>
            {message && <p className="text-xs mt-2 text-[var(--color-accent-success)]">{message}</p>}
        </div>
    );
}
