'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, LayoutDashboard, ScrollText, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EntreeNavigation {
  href: string;
  libelle: string;
  icone: keyof typeof ICONES;
}

const ICONES = {
  tableau: LayoutDashboard,
  etablissements: Building2,
  membres: Users,
  organisation: Settings,
  journal: ScrollText,
} as const;

/**
 * Navigation principale.
 *
 * Les entrées sont calculées côté serveur à partir des permissions : ce
 * composant ne fait qu'afficher ce qu'on lui donne. Masquer un lien reste du
 * confort — l'accès réel est refusé par RLS et par les gardes serveur.
 */
export function Navigation({ entrees }: { entrees: EntreeNavigation[] }) {
  const chemin = usePathname();

  return (
    <nav aria-label="Navigation principale" className="space-y-0.5">
      {entrees.map((entree) => {
        const Icone = ICONES[entree.icone];
        const actif = chemin === entree.href || chemin.startsWith(`${entree.href}/`);

        return (
          <Link
            key={entree.href}
            href={entree.href}
            aria-current={actif ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-douce px-3 py-2 text-sm font-medium transition-colors',
              actif
                ? 'bg-primaire-douce text-primaire'
                : 'text-encre-douce hover:bg-surface-2 hover:text-encre',
            )}
          >
            <Icone className="size-4 shrink-0" aria-hidden="true" />
            {entree.libelle}
          </Link>
        );
      })}
    </nav>
  );
}
