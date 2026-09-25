import { cn } from '@/lib/utils';
import type { Teinte } from '@/components/coque/navigation';

/**
 * Titre d'écran, marqué de la teinte de son domaine.
 *
 * Les seize pages écrivaient le même `<h1>` sans couleur : rien ne distinguait
 * les finances de la notation avant d'avoir lu le mot. La barre colorée reprend
 * la teinte que porte déjà l'entrée de navigation — on arrive sur la page avec
 * le repère qu'on vient de cliquer.
 *
 * Les classes sont écrites en toutes lettres : Tailwind ne voit pas les noms
 * construits à l'exécution.
 */
const BARRES: Record<Teinte, string> = {
  socle: 'bg-teinte-socle',
  academique: 'bg-teinte-academique',
  personnes: 'bg-teinte-personnes',
  presences: 'bg-teinte-presences',
  notation: 'bg-teinte-notation',
  finances: 'bg-teinte-finances',
  admin: 'bg-teinte-admin',
};

export function TitrePage({
  teinte,
  children,
  className,
}: {
  teinte: Teinte;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={cn(
        'flex items-center gap-3 text-2xl font-semibold tracking-tight text-encre',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('h-7 w-1.5 shrink-0 rounded-full', BARRES[teinte])}
      />
      {children}
    </h1>
  );
}
