import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Navigation par liens : la page reste partageable et fonctionne sans JS. */
export function Pagination({
  page,
  pages,
  total,
  chemin,
}: {
  page: number;
  pages: number;
  total: number;
  chemin: string;
}) {
  if (pages <= 1) return null;

  const lien = (cible: number) => `${chemin}?page=${cible}`;
  const classe =
    'inline-flex h-8 items-center gap-1 rounded-douce border border-bordure px-3 text-xs font-medium';

  return (
    <nav
      className="flex items-center justify-between gap-4 border-t border-bordure px-5 py-3"
      aria-label="Pagination"
    >
      <p className="text-xs text-encre-douce">
        Page {page} sur {pages} · {total} élément{total > 1 ? 's' : ''}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={lien(page - 1)} className={cn(classe, 'hover:bg-surface-2')} rel="prev">
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Précédent
          </Link>
        ) : (
          <span className={cn(classe, 'opacity-40')} aria-disabled="true">
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Précédent
          </span>
        )}
        {page < pages ? (
          <Link href={lien(page + 1)} className={cn(classe, 'hover:bg-surface-2')} rel="next">
            Suivant
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <span className={cn(classe, 'opacity-40')} aria-disabled="true">
            Suivant
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
}
