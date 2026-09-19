import { cn } from '@/lib/utils';

type Ton = 'neutre' | 'primaire' | 'succes' | 'alerte' | 'danger';

const TONS: Record<Ton, string> = {
  neutre: 'bg-surface-2 text-encre-douce border-bordure',
  primaire: 'bg-primaire-douce text-primaire border-primaire/25',
  succes: 'bg-succes-douce text-succes border-succes/25',
  alerte: 'bg-alerte-douce text-alerte border-alerte/25',
  danger: 'bg-danger-douce text-danger border-danger/25',
};

export function Etiquette({
  ton = 'neutre',
  children,
  className,
}: {
  ton?: Ton;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        TONS[ton],
        className,
      )}
    >
      {children}
    </span>
  );
}
