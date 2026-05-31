import { getItemImage } from '../../utils/itemUtils';

interface ItemIconProps {
  item?: any;
  color?: string;
  image?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' };
const textSizes = { sm: 'text-[0.6rem]', md: 'text-xs', lg: 'text-sm' };

export default function ItemIcon({
  item,
  color,
  image,
  name = '?',
  size = 'md',
  className = '',
}: ItemIconProps) {
  const resolvedColor = color || '#555';
  const img = image || (item ? getItemImage(item) : null);

  return (
    <div
      className={`rounded-md flex items-center justify-center font-bold text-white flex-shrink-0 border-2 ${sizes[size]} ${textSizes[size]} ${className}`}
      style={{
        borderColor: resolvedColor,
        background: img
          ? `url(/${img}) center / contain no-repeat`
          : resolvedColor,
        textShadow: '0 0 2px #000',
      }}
    >
      {!img && name.substring(0, 2)}
    </div>
  );
}
