import { initials } from '../../utils/format';

export default function Avatar({ name, size = 'md', className = '' }) {
  const s = size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-11 w-11 text-sm' : 'h-8 w-8 text-[11px]';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-white ${s} ${className}`} aria-hidden>
      {initials(name)}
    </span>
  );
}
