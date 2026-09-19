import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Ton = 'info' | 'succes' | 'alerte' | 'danger';

const TONS: Record<Ton, { classe: string; Icone: typeof Info }> = {
  info: { classe: 'bg-primaire-douce text-encre border-primaire/25', Icone: Info },
  succes: { classe: 'bg-succes-douce text-encre border-succes/25', Icone: CheckCircle2 },
  alerte: { classe: 'bg-alerte-douce text-encre border-alerte/25', Icone: AlertTriangle },
  danger: { classe: 'bg-danger-douce text-encre border-danger/30', Icone: XCircle },
};

export function Alerte({
  ton = 'info',
  titre,
  children,
  className,
}: {
  ton?: Ton;
  titre?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { classe, Icone } = TONS[ton];

  return (
    <div
      role={ton === 'danger' || ton === 'alerte' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-douce border px-4 py-3 text-sm', classe, className)}
    >
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        {titre ? <p className="font-semibold">{titre}</p> : null}
        {children ? <div className="[&_a]:underline">{children}</div> : null}
      </div>
    </div>
  );
}
