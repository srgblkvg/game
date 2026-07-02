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

interface TooltipPosition {
  left: number;
  top: number;
  /** Стрелка-указатель: куда направлена подсказка относительно цели */
  arrow?: 'up' | 'down' | 'none';
}

const PADDING = 8; // отступ вокруг подсвеченной области
const TOOLTIP_MARGIN = 12; // минимальный отступ tooltip от краёв экрана
const MOBILE_BREAKPOINT = 480;

/** Вычисляет лучшую позицию tooltip с учётом доступного пространства */
function calcTooltipPosition(
  target: TargetRect,
  preferredPos: string,
  viewportW: number,
  viewportH: number,
  isMobile: boolean,
  stepAction?: string,
): TooltipPosition {
  const tooltipMaxW = isMobile ? viewportW - TOOLTIP_MARGIN * 2 : 320;
  const tooltipW = Math.min(320, tooltipMaxW);
  // Оценка высоты tooltip (заголовок + описание + кнопки)
  const tooltipH = isMobile ? 280 : 280;
  const gap = 24; // отступ между target и tooltip

  // Доступное пространство с каждой стороны
  const spaceTop = target.top - TOOLTIP_MARGIN;
  const spaceBottom = viewportH - target.bottom - TOOLTIP_MARGIN;
  const spaceLeft = target.left - TOOLTIP_MARGIN;
  const spaceRight = viewportW - target.right - TOOLTIP_MARGIN;

  // На мобильном — туториал сверху. Для шапки — под шапкой, для остального — поверх
  if (isMobile) {
    const isHeaderStep = stepAction === '__header__';
    if (isHeaderStep) {
      const headerH = document.getElementById('site-header')?.offsetHeight || 60;
      return { left: 0, top: headerH + 8 };
    }
    return { left: 0, top: 8 };
  }

  // Десктоп: пробуем предпочтительную позицию, затем фолбэк
  let tLeft = clamp((viewportW - tooltipW) / 2, TOOLTIP_MARGIN, viewportW - tooltipW - TOOLTIP_MARGIN);
  let tTop = clamp((viewportH - tooltipH) / 2, TOOLTIP_MARGIN, viewportH - tooltipH - TOOLTIP_MARGIN);
  let arrow: 'up' | 'down' | 'none' = 'none';

  const tryBottom = (): boolean => {
    if (spaceBottom < tooltipH + gap) return false;
    tLeft = clamp(target.left + target.width / 2 - tooltipW / 2, TOOLTIP_MARGIN, viewportW - tooltipW - TOOLTIP_MARGIN);
    tTop = target.bottom + gap;
    arrow = 'up';
    return true;
  };

  const tryTop = (): boolean => {
    if (spaceTop < tooltipH + gap) return false;
    tLeft = clamp(target.left + target.width / 2 - tooltipW / 2, TOOLTIP_MARGIN, viewportW - tooltipW - TOOLTIP_MARGIN);
    tTop = target.top - tooltipH - gap;
    arrow = 'down';
    return true;
  };

  const tryRight = (): boolean => {
    if (spaceRight < tooltipW + gap) return false;
    tLeft = target.right + gap;
    tTop = clamp(target.top + target.height / 2 - tooltipH / 2, TOOLTIP_MARGIN, viewportH - tooltipH - TOOLTIP_MARGIN);
    arrow = 'none';
    return true;
  };

  const tryLeft = (): boolean => {
    if (spaceLeft < tooltipW + gap) return false;
    tLeft = target.left - tooltipW - gap;
    tTop = clamp(target.top + target.height / 2 - tooltipH / 2, TOOLTIP_MARGIN, viewportH - tooltipH - TOOLTIP_MARGIN);
    arrow = 'none';
    return true;
  };

  // Пробуем в порядке: предпочтительная → самая вместительная сторона
  const ordered: (() => boolean)[] = [];

  if (preferredPos === 'top') ordered.push(tryTop, tryBottom, tryRight, tryLeft);
  else if (preferredPos === 'bottom') ordered.push(tryBottom, tryTop, tryRight, tryLeft);
  else if (preferredPos === 'left') ordered.push(tryLeft, tryRight, tryBottom, tryTop);
  else if (preferredPos === 'right') ordered.push(tryRight, tryLeft, tryBottom, tryTop);
  else if (preferredPos === 'center') {
    // Центр экрана
    tLeft = clamp((viewportW - tooltipW) / 2, TOOLTIP_MARGIN, viewportW - tooltipW - TOOLTIP_MARGIN);
    tTop = clamp((viewportH - tooltipH) / 2, TOOLTIP_MARGIN, viewportH - tooltipH - TOOLTIP_MARGIN);
    arrow = 'none';
    ordered.push(() => true);
  } else {
    ordered.push(tryBottom, tryTop, tryRight, tryLeft);
  }

  for (const fn of ordered) {
    if (fn()) break;
  }

  // Фолбэк: центрируем на экране
  if (tLeft === undefined!) {
    tLeft = clamp((viewportW - tooltipW) / 2, TOOLTIP_MARGIN, viewportW - tooltipW - TOOLTIP_MARGIN);
    tTop = clamp((viewportH - tooltipH) / 2, TOOLTIP_MARGIN, viewportH - tooltipH - TOOLTIP_MARGIN);
    arrow = 'none';
  }

  return { left: tLeft, top: tTop, arrow };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export default function TutorialOverlay({ steps, onComplete }: TutorialOverlayProps) {
  const [current, setCurrent] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowDir, setArrowDir] = useState<'up' | 'down' | 'none'>('none');
  const [isMobile, setIsMobile] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const step = steps[current];
  const isLast = current === steps.length - 1;

  // Диспатчим кастомное событие при смене шага
  useEffect(() => {
    if (step?.action) {
      window.dispatchEvent(new CustomEvent(step.action));
    }
  }, [current, step]);

  const calcPosition = useCallback(() => {
    if (!step) return;

    const el = document.querySelector(step.targetSelector);
    if (!el) {
      if (current < steps.length - 1) {
        setCurrent(prev => prev + 1);
      } else {
        onComplete();
      }
      return;
    }

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mobile = vw < MOBILE_BREAKPOINT;
    setIsMobile(mobile);

    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right,
    });

    // Скроллим элемент чтобы был видим (учитываем sticky-шапку и tooltip сверху)
    const headerH = document.getElementById('site-header')?.offsetHeight || 0;
    // На мобильном tooltip сверху на top:8, h≈150 — элемент ниже с отступом 12
    const topClearance = mobile ? (8 + 150 + 12) : headerH;

    const isFullyVisible =
      rect.top >= topClearance &&
      rect.left >= 0 &&
      rect.bottom <= vh &&
      rect.right <= vw;

    if (!isFullyVisible) {
      // Временно включаем скролл для корректной работы scrollIntoView/scrollBy
      document.body.style.overflow = '';
      if (mobile) {
        // Скроллим чтобы элемент был на 170px от верха (под tooltip)
        const targetY = rect.top + window.scrollY - (8 + 150 + 12);
        window.scrollTo({ top: targetY, behavior: 'instant' });
      } else {
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        // Сдвигаем выше на высоту шапки + отступ
        window.scrollBy({ top: -(headerH + 16), behavior: 'instant' });
      }
      // Возвращаем блокировку
      document.body.style.overflow = 'hidden';
      // Пересчитываем позицию после скролла
      const newRect = el.getBoundingClientRect();
      setTargetRect({
        top: newRect.top,
        left: newRect.left,
        width: newRect.width,
        height: newRect.height,
        bottom: newRect.bottom,
        right: newRect.right,
      });

      const pos = calcTooltipPosition(
        {
          top: newRect.top,
          left: newRect.left,
          width: newRect.width,
          height: newRect.height,
          bottom: newRect.bottom,
          right: newRect.right,
        },
        step.tooltipPosition || 'bottom',
        vw,
        vh,
        mobile,
        step.action,
      );

      setTooltipStyle({
        left: `${pos.left}px`,
        top: `${pos.top}px`,
        maxWidth: mobile ? `calc(100vw - ${TOOLTIP_MARGIN * 2}px)` : '320px',
      });
      setArrowDir(pos.arrow || 'none');
      return;
    }

    const pos = calcTooltipPosition(
      {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right,
      },
      step.tooltipPosition || 'bottom',
      vw,
      vh,
      mobile,
      step.action,
    );

    setTooltipStyle({
      left: `${pos.left}px`,
      top: `${pos.top}px`,
      maxWidth: mobile ? `calc(100vw - ${TOOLTIP_MARGIN * 2}px)` : '320px',
    });
    setArrowDir(pos.arrow || 'none');
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

  // Стили tooltip с учётом мобильного режима
  const tooltipCombined: React.CSSProperties = {
    position: 'fixed',
    ...tooltipStyle,
    width: isMobile ? `calc(100vw - ${TOOLTIP_MARGIN * 2}px)` : '320px',
    background: 'var(--color-bg-secondary, #1e1e30)',
    border: '1px solid var(--color-border-default, #444)',
    borderRadius: '12px',
    padding: isMobile ? '12px' : '20px',
    zIndex: 102,
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    maxHeight: isMobile ? '35vh' : '80vh',
    overflowY: 'auto',
    ...(isMobile ? {
      left: '50%',
      transform: 'translateX(-50%)',
    } : {}),
  };

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
      <div style={tooltipCombined}>
        {/* Стрелка-указатель (только на десктопе) */}
        {!isMobile && arrowDir !== 'none' && (
          <div style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            ...(arrowDir === 'up'
              ? { top: '-8px', borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '8px solid var(--color-bg-secondary, #1e1e30)' }
              : { bottom: '-8px', borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid var(--color-bg-secondary, #1e1e30)' }),
            width: 0,
            height: 0,
            zIndex: 103,
          }} />
        )}

        {/* Индикатор шагов */}
        <div style={{
          display: 'flex',
          gap: '6px',
          marginBottom: isMobile ? '8px' : '16px',
        }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
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
          fontSize: isMobile ? '0.65rem' : '0.75rem',
          color: 'var(--color-text-muted, #888)',
          marginBottom: '4px',
        }}>
          Шаг {current + 1} из {steps.length}
        </div>

        {/* Заголовок */}
        <h3 style={{
          fontSize: isMobile ? '0.9rem' : '1.1rem',
          fontWeight: 700,
          color: 'var(--color-text-primary, #eee)',
          margin: '0 0 4px 0',
        }}>
          {step.title}
        </h3>

        {/* Описание */}
        <p style={{
          fontSize: isMobile ? '0.72rem' : '0.85rem',
          color: 'var(--color-text-secondary, #ccc)',
          margin: '0 0 12px 0',
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
              fontSize: isMobile ? '0.75rem' : '0.8rem',
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
              fontSize: isMobile ? '0.8rem' : '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: isMobile ? '8px 20px' : '10px 24px',
              borderRadius: '8px',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            {isLast ? 'Понятно!' : 'Далее'}
          </button>
        </div>

        {/* Подсказка по клавишам — только десктоп */}
        {!isMobile && (
          <div style={{
            marginTop: '12px',
            fontSize: '0.65rem',
            color: 'var(--color-text-muted, #888)',
            textAlign: 'center',
          }}>
            Enter — далее · Esc — пропустить
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
