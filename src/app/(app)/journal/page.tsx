import type { Metadata } from 'next';
import { ScrollText } from 'lucide-react';
import { exigerPermission } from '@/services/permissions';
import { listerJournal } from '@/services/journal';
import { formaterDateHeure } from '@/lib/format';
import { Carte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';
import { EtatVide } from '@/components/ui/etats';
import { Pagination } from '@/components/ui/pagination';
import { TitrePage } from '@/components/ui/titre-page';

export const metadata: Metadata = { title: "Journal d'audit" };

/** Libellés lisibles. Une action inconnue s'affiche telle quelle plutôt que de disparaître. */
const LIBELLES: Record<string, string> = {
  'organization.created': 'Organisation créée',
  'invitation.created': 'Invitation créée',
  'invitation.revoked': 'Invitation révoquée',
  'invitation.accepted': 'Invitation acceptée',
  'membership.role_changed': 'Rôle modifié',
  'membership.status_changed': 'Statut de membre modifié',
  'membership.establishments_changed': 'Rattachements modifiés',
};

export default async function PageJournal({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const contexte = await exigerPermission('audit.read');
  const { page: pageBrute } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageBrute ?? '1', 10) || 1);

  const journal = await listerJournal(page);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-1">
        <TitrePage teinte="admin">Journal d&apos;audit</TitrePage>
        <p className="text-sm text-encre-douce">
          Trace des opérations sensibles. Ce journal est en écriture seule : rien ne s&apos;y
          modifie ni ne s&apos;y supprime.
        </p>
      </header>

      <Carte className="overflow-hidden">
        <EnTeteCarte>
          <TitreCarte>Événements</TitreCarte>
          <SousTitreCarte>Du plus récent au plus ancien.</SousTitreCarte>
        </EnTeteCarte>

        {journal.lignes.length === 0 ? (
          <EtatVide
            icone={<ScrollText className="size-8" />}
            titre="Aucun événement"
            description="Les opérations sensibles apparaîtront ici au fur et à mesure."
          />
        ) : (
          <>
            <ul className="divide-y divide-bordure">
              {journal.lignes.map((entree) => (
                <li key={entree.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                  <span className="text-sm font-medium text-encre">
                    {LIBELLES[entree.action] ?? entree.action}
                  </span>
                  <span className="text-xs text-encre-douce">
                    par {entree.actor_label ?? 'système'}
                  </span>
                  <span className="ms-auto text-xs tabular-nums text-encre-douce">
                    {formaterDateHeure(entree.occurred_at, contexte.reglages)}
                  </span>
                  {entree.reason ? (
                    <p className="w-full text-xs text-encre-douce">Motif : {entree.reason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            <Pagination
              page={journal.page}
              pages={journal.pages}
              total={journal.total}
              chemin="/journal"
            />
          </>
        )}
      </Carte>
    </div>
  );
}
