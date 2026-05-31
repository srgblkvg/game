# Tailwind CSS Design System — Implementation Plan

> **Goal:** Заменить все инлайн-стили на единую дизайн-систему на Tailwind CSS,
> добавить адаптивность, вынести повторяющиеся UI-паттерны в общие компоненты.

**Architecture:** Tailwind v4 с Vite-плагином, кастомная тёмная тема, слой
общих UI-компонентов, постепенный рефакторинг страниц.

**Tech Stack:** Tailwind CSS v4, @tailwindcss/vite, React 19, TypeScript, Vite 8

---

## Текущее состояние

- 2 CSS-файла: index.css (анимации + глобальные стили) и arena.css
- Все страницы используют голые style={{...}} — цвета, отступы, шрифты вбиты руками
- Адаптивность делается через useState(isMobile) в каждой странице отдельно
- Повторяющиеся паттерны: кнопка «Назад», карточка предмета, модалка, фильтры

## Целевая архитектура

```
client/src/
  styles/
    theme.css          ← Tailwind-вход + кастомные CSS-переменные
  components/
    ui/
      Button.tsx        ← универсальная кнопка (варианты: primary, secondary, danger, ghost)
      Card.tsx          ← карточка с рамкой редкости
      Modal.tsx         ← модальное окно
      Badge.tsx         ← бейдж редкости / статуса
      BackButton.tsx    ← кнопка «← Назад»
      PageHeader.tsx    ← заголовок страницы
      FilterBar.tsx     ← панель фильтров
      ItemIcon.tsx      ← иконка предмета (квадратик с цветом/картинкой)
      StatLine.tsx      ← строка стата (название + значение)
      EmptyState.tsx    ← заглушка «ничего нет»
      TabBar.tsx        ← вкладки
    ...
  pages/
    ...                  ← заменяем style={{}} на className="..."
```

---

## Этап 1: Установка и настройка Tailwind

### Task 1: Установить Tailwind CSS v4 и Vite-плагин

**Files:**
- Modify: `client/package.json`
- Modify: `client/vite.config.ts`
- Create: `client/src/styles/theme.css`

**Step 1: Установка пакетов**

```bash
cd /mnt/c/project/game/client
npm install tailwindcss @tailwindcss/vite
```

**Step 2: Добавить плагин в vite.config.ts**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3001', ws: true },
    },
  },
});
```

**Step 3: Создать theme.css с дизайн-токенами**

```css
@import "tailwindcss";

@theme {
  /* Основная палитра */
  --color-bg-primary: #1a1a2e;
  --color-bg-secondary: #1e1e30;
  --color-bg-card: #2a2a3e;
  --color-bg-card-hover: #2a2a4e;
  --color-bg-input: #333;
  --color-bg-modal: #2a2a3e;

  /* Текст */
  --color-text-primary: #eee;
  --color-text-secondary: #ccc;
  --color-text-muted: #888;
  --color-text-accent: #f1c40f;

  /* Акценты */
  --color-accent-success: #2ecc71;
  --color-accent-danger: #e63946;
  --color-accent-info: #3498db;
  --color-accent-warning: #f1c40f;
  --color-accent-purple: #9b59b6;

  /* Рамки */
  --color-border-default: #444;
  --color-border-light: #555;

  /* Редкости */
  --color-rarity-junk: #888;
  --color-rarity-common: #ccc;
  --color-rarity-uncommon: #2ecc71;
  --color-rarity-rare: #3498db;
  --color-rarity-epic: #9b59b6;
  --color-rarity-legendary: #f1c40f;
  --color-rarity-mythic: #e74c3c;

  /* Размеры */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 10px;
  --radius-2xl: 12px;

  /* Тени */
  --shadow-card: 0 4px 12px rgba(0, 0, 0, 0.8);
}

/* Глобальные стили */
body {
  background: var(--color-bg-primary);
  min-height: 100vh;
  color: var(--color-text-primary);
  font-family: 'Segoe UI', sans-serif;
  padding-bottom: 40px;
}

/* Кастомная полоса прокрутки */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--color-bg-secondary); }
::-webkit-scrollbar-thumb { background: var(--color-border-default); border-radius: 3px; }
```

**Step 4: Обновить main.tsx — заменить импорт index.css на theme.css**

```tsx
import './styles/theme.css';
```

**Step 5: Проверка**

```bash
cd /mnt/c/project/game/client && npm run dev
```

Убедиться, что фон тёмный, шрифт белый, ошибок сборки нет.

---

## Этап 2: Базовые UI-компоненты

### Task 2: Создать компонент Button

**Create:** `client/src/components/ui/Button.tsx`

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type Size = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:   'bg-blue-500 hover:bg-blue-600 text-white',
  secondary: 'bg-gray-600 hover:bg-gray-500 text-white',
  danger:    'bg-red-600 hover:bg-red-500 text-white',
  ghost:     'bg-transparent hover:bg-white/10 text-gray-300',
  success:   'bg-green-500 hover:bg-green-600 text-white',
};

const sizeClasses: Record<Size, string> = {
  xs: 'text-xs px-1.5 py-0.5 rounded-sm',
  sm: 'text-sm px-2 py-1 rounded',
  md: 'text-sm px-3 py-1.5 rounded-md',
  lg: 'text-base px-4 py-2 rounded-lg',
};

export default function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  fullWidth,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-1 font-medium',
        'cursor-pointer transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      ].filter(Boolean).join(' ')}
      disabled={disabled}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
```

**Verification:** Импортировать Button в любую страницу и проверить визуально.

### Task 3: Создать компонент Card

**Create:** `client/src/components/ui/Card.tsx`

```tsx
import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  borderColor?: string;   // CSS-цвет рамки (для редкости)
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
}

const paddingClasses = {
  sm: 'p-2',
  md: 'p-3',
  lg: 'p-4',
};

export default function Card({
  children,
  borderColor,
  padding = 'md',
  className = '',
  style,
  ...props
}: CardProps) {
  return (
    <div
      className={[
        'bg-[var(--color-bg-card)] rounded-xl',
        'shadow-[var(--shadow-card)]',
        paddingClasses[padding],
        borderColor ? 'border-2' : 'border border-[var(--color-border-light)]',
        className,
      ].filter(Boolean).join(' ')}
      style={{
        ...(borderColor ? { borderColor } : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
```

### Task 4: Создать компонент Modal

**Create:** `client/src/components/ui/Modal.tsx`

```tsx
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}

export default function Modal({ open, onClose, title, children, maxWidth = '400px' }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-bg-modal)] border-2 border-red-600 rounded-xl p-4 mx-4 text-[var(--color-text-primary)]"
        style={{ maxWidth }}
        onClick={e => e.stopPropagation()}
      >
        {title && <h3 className="text-lg font-bold mb-2">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
```

### Task 5: Создать компоненты Badge, BackButton, PageHeader

**Create:** `client/src/components/ui/Badge.tsx`

```tsx
interface BadgeProps {
  color?: string;
  text: string;
}

export default function Badge({ color = '#888', text }: BadgeProps) {
  return (
    <span
      className="inline-block text-xs font-bold px-1.5 py-0.5 rounded text-white"
      style={{ background: color }}
    >
      {text}
    </span>
  );
}
```

**Create:** `client/src/components/ui/BackButton.tsx`

```tsx
import { useNavigate } from 'react-router-dom';
import Button from './Button';

export default function BackButton({ to }: { to?: string }) {
  const navigate = useNavigate();
  return (
    <Button variant="secondary" size="sm" onClick={() => to ? navigate(to) : navigate(-1)}>
      ← Назад
    </Button>
  );
}
```

**Create:** `client/src/components/ui/PageHeader.tsx`

```tsx
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
}

export default function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
      <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h2>
      {children}
    </div>
  );
}
```

### Task 6: Создать компонент ItemIcon

**Create:** `client/src/components/ui/ItemIcon.tsx`

```tsx
interface ItemIconProps {
  color: string;
  image?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' };
const textSizes = { sm: 'text-xs', md: 'text-xs', lg: 'text-sm' };

export default function ItemIcon({ color, image, name, size = 'md' }: ItemIconProps) {
  return (
    <div
      className={[
        'rounded flex items-center justify-center font-bold text-white flex-shrink-0 border-2',
        sizes[size],
        textSizes[size],
      ].join(' ')}
      style={{
        borderColor: color,
        background: image
          ? `url(/${image}) center / contain no-repeat`
          : color,
        textShadow: '0 0 2px #000',
      }}
    >
      {!image && name.substring(0, 2)}
    </div>
  );
}
```

---

## Этап 3: Рефакторинг страниц

Приоритет: от самых коротких к самым длинным, чтобы быстро увидеть результат.

### Task 7: Рефакторинг Header.tsx

Заменить все style={{}} на Tailwind-классы. Использовать компонент Button.

### Task 8: Рефакторинг LoginPage.tsx

### Task 9: Рефакторинг AdminRegisterPage.tsx

### Task 10: Рефакторинг ProfilePage.tsx

### Task 11: Рефакторинг HistoryPage.tsx

### Task 12: Рефакторинг RatingPage.tsx

### Task 13: Рефакторинг JobsPage.tsx

### Task 14: Рефакторинг ShopPage.tsx

Вынести карточку предмета магазина в компонент ShopItemCard.
Использовать Card, Button, ItemIcon, Badge.
Заменить isMobile на responsive-классы Tailwind (sm:, md:).

### Task 15: Рефакторинг ArenaPage.tsx + ArenaModal.tsx

### Task 16: Рефакторинг CraftPage.tsx

Самый большой файл. Вынести слоты крафта и панель рецептов в компоненты.

### Task 17: Рефакторинг HomePage.tsx

Использовать уже отрефакторенные LeftSidebar, MainBar, RightSidebar.

### Task 18: Рефакторинг компонентов (LeftSidebar, MainBar, RightSidebar, Inventory, CharacterCard, ChatPanel, Actions)

### Task 19: Рефакторинг AdminPanel и всех подстраниц

### Task 20: Адаптивность

Добавить медиа-брейкпоинты Tailwind (sm:640, md:768, lg:1024) ко всем страницам.
Заменить useState(isMobile) на className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3" и т.д.

---

## Этап 4: Финализация

### Task 21: Очистка

- Удалить неиспользуемые CSS (arena.css если всё перенесено)
- Удалить index.css если анимации перенесены в theme.css
- Проверить что нет оставшихся style={{}} с хардкод-цветами

### Task 22: Проверка сборки

```bash
cd /mnt/c/project/game/client && npm run build
```

Убедиться, что нет ошибок, билд проходит.

---

## Основные правила рефакторинга

1. Цвета ТОЛЬКО через CSS-переменные: `text-[var(--color-text-primary)]`, `bg-[var(--color-bg-card)]`
2. Отступы через Tailwind: `p-4`, `m-2`, `gap-3` вместо style={{padding:'1rem'}}
3. Шрифты через Tailwind: `text-sm`, `font-bold` вместо style={{fontSize:'0.8rem'}}
4. Flex/Grid через Tailwind: `flex`, `grid`, `justify-center`, `items-center`
5. Адаптивность через префиксы: `md:flex-row`, `sm:text-base`
6. Рамки через Tailwind: `border`, `rounded-lg`, цвет через style или переменную
7. Кнопки — ТОЛЬКО через компонент Button
8. Модалки — ТОЛЬКО через компонент Modal
9. Карточки предметов — через Card + ItemIcon

## Порядок выполнения

Этапы 1-2 — я делаю сам (настройка + создание компонентов).
Этап 3 — по одному файлу, с проверкой сборки после каждого.
Этап 4 — финальная зачистка и билд.
