import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variante = 'primaire' | 'secondaire' | 'discret' | 'danger';
type Taille = 'normale' | 'petite';

const VARIANTES: Record<Variante, string> = {
  primaire: 'bg-primaire text-primaire-contraste hover:brightness-110 shadow-carte',
  secondaire: 'bg-carte text-encre border border-bordure hover:bg-surface-2',
  discret: 'text-encre-douce hover:bg-surface-2 hover:text-encre',
  danger: 'bg-danger text-white hover:brightness-110',
};

const TAILLES: Record<Taille, string> = {
  normale: 'h-10 px-4 text-sm',
  petite: 'h-8 px-3 text-xs',
};

interface ProprietesBouton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  taille?: Taille;
}

export function Bouton({
  variante = 'primaire',
  taille = 'normale',
  className,
  ...reste
}: ProprietesBouton) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-douce font-medium',
        'transition-[filter,background-color,color] duration-150',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTES[variante],
        TAILLES[taille],
        className,
      )}
      {...reste}
    />
  );
}
