import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
  width?: string;
  borderColor?: string;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth,
  width,
  borderColor = 'var(--color-accent-danger)',
}: ModalProps) {
  if (!open) return null;

  const dynamicStyle: React.CSSProperties = {
    '--modal-border': borderColor,
  } as React.CSSProperties;
  if (width) {
    dynamicStyle.width = width;
    dynamicStyle.maxWidth = width;
  } else if (maxWidth) {
    dynamicStyle.maxWidth = maxWidth;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
      style={{ backgroundColor: '#111111', padding: 'max(0.75rem, env(safe-area-inset-top, 0px)) 0.75rem max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-bg-modal)] rounded-xl text-[var(--color-text-primary)] shadow-lg relative border-2 border-[var(--modal-border)] p-6 overflow-y-auto"
        style={{ ...dynamicStyle, width: dynamicStyle.width || 'min(100%, 32rem)', maxHeight: 'calc(100vh - 1.5rem)' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg leading-none cursor-pointer"
        >
          ✕
        </button>
        {title && <h3 className="text-lg font-bold mb-3 pr-6">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
