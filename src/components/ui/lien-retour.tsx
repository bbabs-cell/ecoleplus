import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Lien de retour en tête d'un écran de détail.
 *
 * Il était répété à l'identique dans six pages, avec deux variantes de classes
 * et une hauteur de 20 px — impossible à viser au doigt. Une seule définition,
 * et 44 px de haut tant qu'on est sous `lg`.
 *
 * La flèche suit le sens d'écriture : en arabe, revenir en arrière pointe à
 * droite. `rtl:rotate-180` s'en charge, sans second composant.
 */
export function LienRetour({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-encre-douce',
        'transition-colors hover:text-encre lg:min-h-0',
        className,
      )}
    >
      <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
      {children}
    </Link>
  );
}
