import { useState, useRef } from 'react';
import Button from './ui/Button';
import { getHeaders } from '../api/helpers';

interface ImageUploaderProps {
    currentUrl?: string | null;
    folder?: string; // subfolder under /uploads/admin/
    onUploaded: (url: string) => void;
    label?: string;
    className?: string;
}

export default function ImageUploader({ currentUrl, folder, onUploaded, label, className }: ImageUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(currentUrl || null);
    const [error, setError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { setError('Файл больше 2MB'); return; }

        setError('');
        setUploading(true);
        try {
            const reader = new FileReader();
            const dataUrl = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const res = await fetch('/api/admin/upload-image', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: dataUrl, folder: folder || '' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');

            setPreview(data.url);
            onUploaded(data.url);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className={className}>
            {label && <div className="text-xs text-[var(--color-text-muted)] mb-1">{label}</div>}
            <div className="flex items-center gap-2">
                {preview && (
                    <img src={preview} alt="" className="w-12 h-12 object-cover rounded border border-[var(--color-border-default)]" />
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
                <Button variant="secondary" size="xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? 'Загрузка...' : preview ? 'Заменить' : 'Загрузить'}
                </Button>
                {preview && (
                    <Button variant="secondary" size="xs" onClick={() => { setPreview(null); onUploaded(''); }}>
                        ✕
                    </Button>
                )}
            </div>
            {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
        </div>
    );
}
