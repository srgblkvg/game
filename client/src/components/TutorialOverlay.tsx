import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { TutorialStep } from '../data/tutorialSteps';

interface TutorialOverlayProps {
  steps: TutorialStep[];
  /** Индекс текущего шага (0-based). Если не задан — используется внутреннее состояние. */
  stepIndex?: number;
  /** Вызывается при завершении туториала (пропуск или последний шаг) */
  onComplete: () => void;
  /** Вызывается при нажатии «Далее» — продвигает на следующий шаг */
  onNextStep?: () => void;
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
  arrow?: 'up' | 'down' | 'none';
}

const PADDING = 8;
const TOOLTIP_MARGIN = 12;
const MOBILE_BREAKPOINT = 480;

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
  const tooltipH = isMobile ? 280 : 280;
  const gap = 48;

  const spaceTop = target.top - TOOLTIP_MARGIN;
  const spaceBottom = viewportH - target.bottom - TOOLTIP_MARGIN;
  const spaceLeft = target.left - TOOLTIP_MARGIN;
  const spaceRight = viewportW - target.right - TOOLTIP_MARGIN;

  if (isMobile) {
    if (stepAction === '__header__') {
      const headerH = document.getElementById('site-header')?.offsetHeight || 60;
      return { left: 0, top: headerH + 8 };
    }
    return { left: 0, top: 8 };
  }

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

  const ordered: (() => boolean)[] = [];
  if (preferredPos === 'top') ordered.push(tryTop, tryBottom, tryRight, tryLeft);
  else if (preferredPos === 'bottom') ordered.push(tryBottom, tryTop, tryRight, tryLeft);
  else if (preferredPos === 'left') ordered.push(tryLeft, tryRight, tryBottom, tryTop);
  else if (preferredPos === 'right') ordered.push(tryRight, tryLeft, tryBottom, tryTop);
  else if (preferredPos === 'center') {
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

  if (tLeft === undefined!) {
    tLeft = clamp((viewportW - tooltipW) / 2, TOOLTIP_MARGIN, viewportW - tooltipW - TOOLTIP_MARGIN);
    tTop = clamp((viewportH - tooltipH) / 2, TOOLTIP_MARGIN, viewportH - tooltipH - TOOLTIP_MARGIN);
    arrow = 'none';
  }

  if (!isMobile) {
    const chatEl = document.querySelector('.chat-panel');
    const chatH = chatEl ? chatEl.getBoundingClientRect().height : 0;
    const maxTop = viewportH - chatH - tooltipH - TOOLTIP_MARGIN;
    tTop = Math.min(tTop!, maxTop);
  }

  return { left: tLeft!, top: tTop!, arrow };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export default function TutorialOverlay({ steps, stepIndex, onComplete, onNextStep }: TutorialOverlayProps) {
  const [current, setCurrent] = useState(stepIndex ?? 0);

  useEffect(() => {
    if (stepIndex !== undefined) setCurrent(stepIndex);
  }, [stepIndex]);

  // Защита от выхода индекса за границы массива шагов
  useEffect(() => {
    if (stepIndex !== undefined && stepIndex >= steps.length) {
      onComplete();
    }
  }, [stepIndex, steps.length, onComplete]);

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [arrowDir, setArrowDir] = useState<'up' | 'down' | 'none'>('none');
  const [isMobile, setIsMobile] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const step = steps[current];
  const isLast = current >= steps.length - 1;

  // Если шаг не определён (выход за границы) — ничего не рендерим,
  // useEffect выше вызовет onComplete и компонент размонтируется
  if (!step) return null;

  useEffect(() => {
    if (step?.action) {
      step.action.split(',').forEach(a => {
        window.dispatchEvent(new CustomEvent(a.trim()));
      });
    }
  }, [current, step]);

  const calcPosition = useCallback(() => {
    if (!step) return;

    if (step.tooltipPosition === 'center') {
      setTargetRect(null);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mobile = vw < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      setTooltipStyle({
        left: mobile ? `${TOOLTIP_MARGIN}px` : `${Math.max(TOOLTIP_MARGIN, (vw - 320) / 2)}px`,
        top: mobile ? '60px' : `${Math.max(TOOLTIP_MARGIN, (vh - 280) / 2)}px`,
        maxWidth: mobile ? `calc(100vw - ${TOOLTIP_MARGIN * 2}px)` : '320px',
        width: mobile ? `calc(100vw - ${TOOLTIP_MARGIN * 2}px)` : '320px',
      });
      setArrowDir('none');
      return;
    }

    const el = document.querySelector(step.targetSelector);
    if (!el) {
      setTimeout(() => calcPosition(), 300);
      return;
    }

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mobile = vw < MOBILE_BREAKPOINT;
    setIsMobile(mobile);

    setTargetRect({
      top: rect.top, left: rect.left, width: rect.width, height: rect.height,
      bottom: rect.bottom, right: rect.right,
    });

    const headerH = document.getElementById('site-header')?.offsetHeight || 0;
    const chatEl = document.querySelector('.chat-panel');
    const chatH = chatEl ? chatEl.getBoundingClientRect().height : 0;
    const topClearance = headerH;
    const bottomClearance = chatH;

    const isFullyVisible =
      rect.top >= topClearance && rect.left >= 0 &&
      rect.bottom <= vh - bottomClearance && rect.right <= vw;

    if (!isFullyVisible) {
      document.body.style.overflow = '';
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      window.scrollBy({ top: -(headerH + 8), behavior: 'instant' });
      const afterRect = el.getBoundingClientRect();
      if (afterRect.bottom > vh - bottomClearance - 16) {
        window.scrollBy({ top: -(afterRect.bottom - (vh - bottomClearance) + 16), behavior: 'instant' });
      }
      document.body.style.overflow = 'hidden';
      const newRect = el.getBoundingClientRect();
      setTargetRect({
        top: newRect.top, left: newRect.left, width: newRect.width, height: newRect.height,
        bottom: newRect.bottom, right: newRect.right,
      });
      const pos = calcTooltipPosition(
        { top: newRect.top, left: newRect.left, width: newRect.width, height: newRect.height, bottom: newRect.bottom, right: newRect.right },
        step.tooltipPosition || 'bottom', vw, vh, mobile, step.action,
      );
      setTooltipStyle({
        left: `${pos.left}px`, top: `${pos.top}px`,
        maxWidth: mobile ? `calc(100vw - ${TOOLTIP_MARGIN * 2}px)` : '320px',
      });
      setArrowDir(pos.arrow || 'none');
      return;
    }

    const pos = calcTooltipPosition(
      { top: rect.top, left: rect.left, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right },
      step.tooltipPosition || 'bottom', vw, vh, mobile, step.action,
    );
    setTooltipStyle({
      left: `${pos.left}px`, top: `${pos.top}px`,
      maxWidth: mobile ? `calc(100vw - ${TOOLTIP_MARGIN * 2}px)` : '320px',
    });
    setArrowDir(pos.arrow || 'none');
  }, [step, current, steps.length]);

  useEffect(() => {
    calcPosition();
    window.addEventListener('resize', calcPosition);
    window.addEventListener('scroll', calcPosition);
    return () => {
      window.removeEventListener('resize', calcPosition);
      window.removeEventListener('scroll', calcPosition);
    };
  }, [calcPosition]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSkip = () => { onComplete(); };

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else if (onNextStep) {
      onNextStep();
    } else {
      setCurrent(prev => prev + 1);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
      if (e.key === 'Enter') handleNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, isLast]);

  const isCenter = step?.tooltipPosition === 'center';
  const r = targetRect || { top: window.innerHeight / 2 - 50, left: window.innerWidth / 2 - 160, width: 320, height: 100, bottom: window.innerHeight / 2 + 50, right: window.innerWidth / 2 + 160 };
  const isFake = !targetRect && !isCenter;
  const pr = PADDING;

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
    ...(isMobile ? { left: '50%', transform: 'translateX(-50%)' } : {}),
  };

  return createPortal(
    <div ref={overlayRef} className="tutorial-overlay">
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: isCenter ? '0px' : `${Math.max(0, r.top - pr)}px`,
        background: isCenter ? 'rgba(0,0,0,0.5)' : (isFake ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.75)'),
        zIndex: 100,
      }} />
      <div style={{
        position: 'fixed', top: isCenter ? '0px' : `${r.bottom + pr}px`, left: 0, right: 0, bottom: 0,
        background: isCenter ? 'rgba(0,0,0,0.5)' : (isFake ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.75)'),
        zIndex: 100,
      }} />
      {!isCenter && (
        <div style={{
          position: 'fixed', top: `${Math.max(0, r.top - pr)}px`, left: 0,
          width: `${Math.max(0, r.left - pr)}px`, height: `${r.height + pr * 2}px`,
          background: isFake ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.75)',
          zIndex: 100,
        }} />
      )}
      {!isCenter && (
        <div style={{
          position: 'fixed', top: `${Math.max(0, r.top - pr)}px`,
          left: `${r.left + r.width + pr}px`, right: 0,
          height: `${r.height + pr * 2}px`,
          background: isFake ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.75)',
          zIndex: 100,
        }} />
      )}
      {!isCenter && (
        <div style={{
          position: 'fixed', top: `${r.top - pr}px`, left: `${r.left - pr}px`,
          width: `${r.width + pr * 2}px`, height: `${r.height + pr * 2}px`,
          border: '2px solid var(--color-accent-warning, #f1c40f)',
          borderRadius: '8px',
          boxShadow: '0 0 20px rgba(241, 196, 15, 0.3), inset 0 0 20px rgba(241, 196, 15, 0.1)',
          zIndex: 101, pointerEvents: 'none',
        }} />
      )}
      <div style={tooltipCombined}>
        {!isMobile && !isCenter && arrowDir !== 'none' && (
          <div style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            ...(arrowDir === 'up'
              ? { top: '-8px', borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '8px solid var(--color-bg-secondary, #1e1e30)' }
              : { bottom: '-8px', borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '8px solid var(--color-bg-secondary, #1e1e30)' }),
            width: 0, height: 0, zIndex: 103,
          }} />
        )}
        <h3 style={{
          fontSize: isMobile ? '0.9rem' : '1.1rem', fontWeight: 700,
          color: 'var(--color-text-primary, #eee)', margin: '0 0 4px 0',
        }}>
          {step.title}
        </h3>
        <p style={{
          fontSize: isMobile ? '0.72rem' : '0.85rem',
          color: 'var(--color-text-secondary, #ccc)',
          margin: '0 0 12px 0', lineHeight: 1.5,
        }}>
          {step.description}
        </p>
        <p style={{
          fontSize: '0.65rem', color: 'var(--color-text-muted, #888)',
          margin: '0 0 8px 0', textAlign: 'center',
        }}>
          Шаг {current + 1} из {steps.length}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={handleSkip}
            style={{
              background: 'none', border: 'none',
              color: 'var(--color-text-muted, #888)',
              fontSize: isMobile ? '0.65rem' : '0.7rem',
              cursor: 'pointer', padding: '4px 8px', borderRadius: '4px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary, #ccc)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted, #888)'; }}
          >
            Пропустить обучение
          </button>
          <button
            onClick={handleNext}
            style={{
              background: 'var(--color-accent-success, #27ae60)',
              border: 'none', color: '#fff',
              fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: 600,
              cursor: 'pointer', padding: '6px 20px', borderRadius: '8px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            {isLast ? '✓ Завершить' : 'Далее →'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
