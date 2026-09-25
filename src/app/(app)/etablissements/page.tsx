import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { exigerPermission } from '@/services/permissions';
import { listerEtablissements } from '@/services/etablissements';
import { Carte } from '@/components/ui/carte';
import { EtatVide } from '@/components/ui/etats';
import { Pagination } from '@/components/ui/pagination';
import { FormulaireCreation, LigneEtablissement } from './formulaires';
import { TitrePage } from '@/components/ui/titre-page';

export const metadata: Metadata = { title: 'Établissements' };

export default async function PageEtablissements({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const contexte = await exigerPermission('establishments.read');
  const { page: pageBrute } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageBrute ?? '1', 10) || 1);

  const resultats = await listerEtablissements(page, true);
  const peutCreer = contexte.permissions.has('establishments.create');
  const peutModifier = contexte.permissions.has('establishments.update');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-1">
        <TitrePage teinte="socle">Établissements</TitrePage>
        <p className="text-sm text-encre-douce">
          Écoles, campus, facultés ou centres rattachés à votre organisation.
        </p>
      </header>

      {peutCreer ? <FormulaireCreation /> : null}

      <Carte className="overflow-hidden">
        {resultats.lignes.length === 0 ? (
          <EtatVide
            icone={<Building2 className="size-8" />}
            titre="Aucun établissement"
            description={
              peutCreer
                ? "Créez le premier établissement pour commencer à structurer l'organisation."
                : "Aucun établissement ne vous est rattaché pour le moment."
            }
          />
        ) : (
          <>
            {resultats.lignes.map((etablissement) => (
              <LigneEtablissement
                key={etablissement.id}
                etablissement={etablissement}
                peutModifier={peutModifier}
              />
            ))}
            <Pagination
              page={resultats.page}
              pages={resultats.pages}
              total={resultats.total}
              chemin="/etablissements"
            />
          </>
        )}
      </Carte>
    </div>
  );
}
