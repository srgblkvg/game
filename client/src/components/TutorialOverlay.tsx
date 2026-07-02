import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { TutorialStep } from '../data/tutorialSteps';

interface TutorialOverlayProps {
  steps: TutorialStep[];
  /** Вызывается при завершении туториала (пропуск или последний шаг) */
  onComplete: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

const PADDING = 12; // отступ вокруг подсвеченной области

export default function TutorialOverlay({ steps, onComplete }: TutorialOverlayProps) {
  const [current, setCurrent] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const overlayRef = useRef<HTMLDivElement>(null);

  const step = steps[current];
  const isLast = current === steps.length - 1;

  const calcPosition = useCallback(() => {
    if (!step) return;

    const el = document.querySelector(step.targetSelector);
    if (!el) {
      // Элемент не найден — пропускаем шаг
      if (current < steps.length - 1) {
        setCurrent(prev => prev + 1);
      } else {
        onComplete();
      }
      return;
    }

    const rect = el.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right,
    });

    // Позиция подсказки
    const pos = step.tooltipPosition || 'bottom';
    const tooltipW = 320;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let tLeft: number;
    let tTop: number;

    switch (pos) {
      case 'top':
        tLeft = Math.max(16, Math.min(viewportW - tooltipW - 16, rect.left + rect.width / 2 - tooltipW / 2));
        tTop = Math.max(16, rect.top - 16);
        break;
      case 'bottom':
        tLeft = Math.max(16, Math.min(viewportW - tooltipW - 16, rect.left + rect.width / 2 - tooltipW / 2));
        tTop = Math.min(viewportH - 16, rect.bottom + 16);
        break;
      case 'left':
        tLeft = Math.max(16, rect.left - tooltipW - 16);
        tTop = Math.max(16, Math.min(viewportH - 16, rect.top + rect.height / 2));
        break;
      case 'right':
        tLeft = Math.min(viewportW - tooltipW - 16, rect.right + 16);
        tTop = Math.max(16, Math.min(viewportH - 16, rect.top + rect.height / 2));
        break;
      case 'center':
        tLeft = Math.max(16, (viewportW - tooltipW) / 2);
        tTop = Math.max(16, (viewportH - 200) / 2);
        break;
      default:
        tLeft = Math.max(16, Math.min(viewportW - tooltipW - 16, rect.left + rect.width / 2 - tooltipW / 2));
        tTop = Math.min(viewportH - 16, rect.bottom + 16);
    }

    setTooltipStyle({
      left: `${tLeft}px`,
      top: `${tTop}px`,
    });
  }, [step, current, steps.length, onComplete]);

  useEffect(() => {
    calcPosition();
    window.addEventListener('resize', calcPosition);
    window.addEventListener('scroll', calcPosition);
    return () => {
      window.removeEventListener('resize', calcPosition);
      window.removeEventListener('scroll', calcPosition);
    };
  }, [calcPosition]);

  // Блокируем скролл фона
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrent(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  // Обработка клавиш
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
      if (e.key === 'Enter' || e.key === ' ') handleNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, isLast]);

  if (!targetRect) {
    return null;
  }

  const r = targetRect;
  const pr = PADDING;

  return createPortal(
    <div ref={overlayRef} className="tutorial-overlay">
      {/* Четыре затемняющих прямоугольника вокруг цели */}
      {/* Верхний */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: `${Math.max(0, r.top - pr)}px`,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 100,
      }} />
      {/* Нижний */}
      <div style={{
        position: 'fixed',
        top: `${r.bottom + pr}px`,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 100,
      }} />
      {/* Левый */}
      <div style={{
        position: 'fixed',
        top: `${Math.max(0, r.top - pr)}px`,
        left: 0,
        width: `${Math.max(0, r.left - pr)}px`,
        height: `${r.height + pr * 2}px`,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 100,
      }} />
      {/* Правый */}
      <div style={{
        position: 'fixed',
        top: `${Math.max(0, r.top - pr)}px`,
        left: `${r.left + r.width + pr}px`,
        right: 0,
        height: `${r.height + pr * 2}px`,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 100,
      }} />

      {/* Рамка подсветки */}
      <div style={{
        position: 'fixed',
        top: `${r.top - pr}px`,
        left: `${r.left - pr}px`,
        width: `${r.width + pr * 2}px`,
        height: `${r.height + pr * 2}px`,
        border: '2px solid var(--color-accent-warning, #f1c40f)',
        borderRadius: '8px',
        boxShadow: '0 0 20px rgba(241, 196, 15, 0.3), inset 0 0 20px rgba(241, 196, 15, 0.1)',
        zIndex: 101,
        pointerEvents: 'none',
      }} />

      {/* Подсказка */}
      <div style={{
        position: 'fixed',
        ...tooltipStyle,
        width: '320px',
        maxWidth: 'calc(100vw - 32px)',
        background: 'var(--color-bg-secondary, #1e1e30)',
        border: '1px solid var(--color-border-default, #444)',
        borderRadius: '12px',
        padding: '20px',
        zIndex: 102,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        {/* Индикатор шагов */}
        <div style={{
          display: 'flex',
          gap: '6px',
          marginBottom: '16px',
        }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: '24px',
                height: '4px',
                borderRadius: '2px',
                background: i === current
                  ? 'var(--color-accent-warning, #f1c40f)'
                  : i < current
                    ? 'var(--color-accent-success, #2ecc71)'
                    : 'var(--color-border-light, #555)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        {/* Счётчик */}
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--color-text-muted, #888)',
          marginBottom: '8px',
        }}>
          Шаг {current + 1} из {steps.length}
        </div>

        {/* Заголовок */}
        <h3 style={{
          fontSize: '1.1rem',
          fontWeight: 700,
          color: 'var(--color-text-primary, #eee)',
          margin: '0 0 8px 0',
        }}>
          {step.title}
        </h3>

        {/* Описание */}
        <p style={{
          fontSize: '0.85rem',
          color: 'var(--color-text-secondary, #ccc)',
          margin: '0 0 20px 0',
          lineHeight: 1.5,
        }}>
          {step.description}
        </p>

        {/* Кнопки */}
        <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <button
            onClick={handleSkip}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted, #888)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: '6px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary, #ccc)';
              e.currentTarget.style.background = 'var(--color-bg-hover, rgba(255,255,255,0.08))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-muted, #888)';
              e.currentTarget.style.background = 'none';
            }}
          >
            Пропустить
          </button>

          <button
            onClick={handleNext}
            style={{
              background: 'var(--color-accent-warning, #f1c40f)',
              color: 'var(--color-warning-text, #0d0d1a)',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '10px 24px',
              borderRadius: '8px',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            {isLast ? 'Понятно!' : 'Далее'}
          </button>
        </div>

        {/* Подсказка по клавишам */}
        <div style={{
          marginTop: '12px',
          fontSize: '0.65rem',
          color: 'var(--color-text-muted, #888)',
          textAlign: 'center',
        }}>
          Enter — далее · Esc — пропустить
        </div>
      </div>
    </div>,
    document.body,
  );
}
