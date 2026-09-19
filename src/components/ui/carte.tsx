import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Carte({ className, ...reste }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-douce border border-bordure bg-carte shadow-carte', className)}
      {...reste}
    />
  );
}

export function EnTeteCarte({ className, ...reste }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-bordure px-5 py-4', className)} {...reste} />;
}

export function CorpsCarte({ className, ...reste }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...reste} />;
}

export function TitreCarte({ className, ...reste }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-base font-semibold text-encre', className)} {...reste} />;
}

export function SousTitreCarte({ className, ...reste }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-sm text-encre-douce', className)} {...reste} />;
}
