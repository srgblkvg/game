import { useState, useRef, useEffect } from 'react';
import Button from './ui/Button';
import Modal from './ui/Modal';
import { getHeaders } from '../api/helpers';

interface ImageUploaderProps {
    currentUrl?: string | null;
    folder?: string;
    onUploaded: (url: string) => void;
    label?: string;
    className?: string;
}

export default function ImageUploader({ currentUrl, folder, onUploaded, label, className }: ImageUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(currentUrl || null);
    const [error, setError] = useState('');
    const [showGallery, setShowGallery] = useState(false);
    const [gallery, setGallery] = useState<string[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setPreview(currentUrl || null); }, [currentUrl]);

    const loadGallery = async () => {
        try {
            const r = await fetch(`/api/admin/images?folder=${folder || ''}`, { headers: getHeaders() });
            setGallery(await r.json());
        } catch { setGallery([]); }
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setError('Файл больше 5MB'); return; }

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

    const selectFromGallery = (url: string) => {
        setPreview(url);
        onUploaded(url);
        setShowGallery(false);
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
                <Button variant="secondary" size="xs" onClick={() => { loadGallery(); setShowGallery(true); }} title="Выбрать из галереи">
                    📁
                </Button>
                {preview && (
                    <Button variant="secondary" size="xs" onClick={() => { setPreview(null); onUploaded(''); }}>
                        ✕
                    </Button>
                )}
            </div>
            {error && <div className="text-[var(--color-accent-danger)] text-xs mt-1">{error}</div>}

            <Modal open={showGallery} onClose={() => setShowGallery(false)} title="Галерея изображений" borderColor="var(--color-border-default)">
                {gallery.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)]">Нет загруженных изображений</p>
                ) : (
                    <div className="grid grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto">
                        {gallery.map(url => (
                            <img key={url} src={url} alt=""
                                className={`w-full aspect-square object-cover rounded cursor-pointer border-2 hover:border-[var(--color-accent-info)] transition-colors ${preview === url ? 'border-[var(--color-accent-info)]' : 'border-transparent'}`}
                                onClick={() => selectFromGallery(url)}
                            />
                        ))}
                    </div>
                )}
            </Modal>
        </div>
    );
}
