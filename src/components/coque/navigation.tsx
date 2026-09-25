'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Building2,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Scale,
  School,
  ScrollText,
  Settings,
  Users,
  Wallet,
  UsersRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EntreeNavigation {
  href: string;
  libelle: string;
  icone: keyof typeof ICONES;
  /** Ouvre un nouveau groupe visuel au-dessus de cette entrée. */
  separateur?: boolean;
}

/**
 * Chaque écran appartient à un domaine, et chaque domaine a sa teinte.
 *
 * Ce n'est pas de la décoration : après quelques jours d'usage, la couleur
 * dit où l'on se trouve avant que le libellé ne soit lu. Les classes sont
 * écrites en toutes lettres — Tailwind ne voit pas les noms construits à
 * l'exécution.
 */
const TEINTES = {
  socle: {
    pastille: 'bg-teinte-socle-douce text-teinte-socle',
    actif: 'bg-teinte-socle-douce text-teinte-socle',
    trait: 'bg-teinte-socle',
  },
  academique: {
    pastille: 'bg-teinte-academique-douce text-teinte-academique',
    actif: 'bg-teinte-academique-douce text-teinte-academique',
    trait: 'bg-teinte-academique',
  },
  personnes: {
    pastille: 'bg-teinte-personnes-douce text-teinte-personnes',
    actif: 'bg-teinte-personnes-douce text-teinte-personnes',
    trait: 'bg-teinte-personnes',
  },
  presences: {
    pastille: 'bg-teinte-presences-douce text-teinte-presences',
    actif: 'bg-teinte-presences-douce text-teinte-presences',
    trait: 'bg-teinte-presences',
  },
  notation: {
    pastille: 'bg-teinte-notation-douce text-teinte-notation',
    actif: 'bg-teinte-notation-douce text-teinte-notation',
    trait: 'bg-teinte-notation',
  },
  finances: {
    pastille: 'bg-teinte-finances-douce text-teinte-finances',
    actif: 'bg-teinte-finances-douce text-teinte-finances',
    trait: 'bg-teinte-finances',
  },
  admin: {
    pastille: 'bg-teinte-admin-douce text-teinte-admin',
    actif: 'bg-teinte-admin-douce text-teinte-admin',
    trait: 'bg-teinte-admin',
  },
} as const;

export type Teinte = keyof typeof TEINTES;

/** Le domaine de chaque écran. Une seule table, pour toute l'application. */
export const TEINTE_PAR_ICONE: Record<keyof typeof ICONES, Teinte> = {
  tableau: 'socle',
  etablissements: 'socle',
  annees: 'academique',
  niveaux: 'academique',
  matieres: 'academique',
  enseignants: 'personnes',
  classes: 'personnes',
  apprenants: 'personnes',
  presences: 'presences',
  evaluations: 'notation',
  bulletins: 'notation',
  baremes: 'notation',
  finances: 'finances',
  membres: 'admin',
  organisation: 'admin',
  journal: 'admin',
};

const ICONES = {
  tableau: LayoutDashboard,
  etablissements: Building2,
  annees: CalendarRange,
  niveaux: Layers,
  matieres: BookOpen,
  enseignants: GraduationCap,
  classes: School,
  apprenants: UsersRound,
  presences: ClipboardCheck,
  evaluations: ClipboardList,
  bulletins: FileText,
  baremes: Scale,
  finances: Wallet,
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
export function Navigation({
  entrees,
  libelleNavigation = 'Navigation principale',
}: {
  entrees: EntreeNavigation[];
  libelleNavigation?: string;
}) {
  const chemin = usePathname();

  return (
    <nav aria-label={libelleNavigation} className="space-y-0.5">
      {entrees.map((entree) => {
        const Icone = ICONES[entree.icone];
        const actif = chemin === entree.href || chemin.startsWith(`${entree.href}/`);

        const teinte = TEINTES[TEINTE_PAR_ICONE[entree.icone]];

        return (
          <Link
            key={entree.href}
            href={entree.href}
            aria-current={actif ? 'page' : undefined}
            className={cn(
              // 44 px de haut sur mobile : c'est la cible tactile recommandée.
              // À partir de lg, le pointeur est précis et la densité reprend.
              'group relative flex min-h-11 items-center gap-2.5 rounded-douce px-2.5 py-1.5 text-sm font-medium lg:min-h-0',
              'transition-[background-color,color,transform] duration-[--duree] ease-[--elan]',
              // Un trait fin ouvre chaque groupe : socle, académique, administration.
              entree.separateur && 'mt-3 border-t border-bordure pt-3',
              actif ? teinte.actif : 'text-encre-douce hover:bg-surface-2 hover:text-encre',
            )}
          >
            {/* Repère d'ancrage de l'entrée active, du côté du bord. */}
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-y-2 start-0 w-[3px] rounded-full transition-opacity duration-[--duree]',
                teinte.trait,
                actif ? 'opacity-100' : 'opacity-0',
              )}
            />
            <span
              aria-hidden="true"
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-[0.5rem]',
                'transition-transform duration-[--duree] ease-[--elan] group-hover:scale-105',
                teinte.pastille,
              )}
            >
              <Icone className="size-4" />
            </span>
            {entree.libelle}
          </Link>
        );
      })}
    </nav>
  );
}
