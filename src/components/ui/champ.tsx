import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const BASE =
  'w-full rounded-douce border bg-carte px-3 py-2 text-sm text-encre placeholder:text-encre-douce/70 ' +
  'transition-colors disabled:opacity-50';

interface Habillage {
  label: string;
  htmlFor: string;
  erreur?: string | undefined;
  aide?: string | undefined;
  obligatoire?: boolean;
  children: ReactNode;
}

/**
 * Habillage commun d'un champ : libellé explicite lié au contrôle, texte
 * d'aide, message d'erreur annoncé aux lecteurs d'écran.
 */
export function Champ({ label, htmlFor, erreur, aide, obligatoire, children }: Habillage) {
  const idAide = aide ? `${htmlFor}-aide` : undefined;
  const idErreur = erreur ? `${htmlFor}-erreur` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-encre">
        {label}
        {obligatoire ? (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children}
      {aide ? (
        <p id={idAide} className="text-xs text-encre-douce">
          {aide}
        </p>
      ) : null}
      {erreur ? (
        <p id={idErreur} role="alert" className="text-xs font-medium text-danger">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

// `ComponentPropsWithRef` plutôt que `InputHTMLAttributes` : React 19 passe
// `ref` comme une prop ordinaire, et l'appelant doit pouvoir en poser une.
export function Saisie({
  className,
  erreur,
  ...reste
}: ComponentPropsWithRef<'input'> & { erreur?: boolean }) {
  return (
    <input
      aria-invalid={erreur || undefined}
      className={cn(BASE, erreur ? 'border-danger' : 'border-bordure', className)}
      {...reste}
    />
  );
}

export function Liste({
  className,
  erreur,
  ...reste
}: ComponentPropsWithRef<'select'> & { erreur?: boolean }) {
  return (
    <select
      aria-invalid={erreur || undefined}
      className={cn(BASE, erreur ? 'border-danger' : 'border-bordure', className)}
      {...reste}
    />
  );
}
