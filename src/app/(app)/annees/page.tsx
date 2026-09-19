import type { Metadata } from 'next';
import { CalendarRange } from 'lucide-react';
import { exigerEtablissement } from '@/services/permissions';
import { listerAnnees, listerPeriodes } from '@/services/academique';
import { formaterDate } from '@/lib/format';
import { Carte, CorpsCarte } from '@/components/ui/carte';
import { EtatVide } from '@/components/ui/etats';
import { Etiquette } from '@/components/ui/etiquette';
import { BoutonAnneeCourante, FormulaireAnnee, PeriodesAnnee } from './formulaires';

export const metadata: Metadata = { title: 'Années académiques' };

export default async function PageAnnees() {
  const contexte = await exigerEtablissement('academic.read');
  const peutModifier = contexte.permissions.has('academic.manage');

  const annees = await listerAnnees(contexte.etablissementActif.id);
  const periodesParAnnee = await Promise.all(
    annees.map(async (annee) => [annee.id, await listerPeriodes(annee.id)] as const),
  );
  const periodes = new Map(periodesParAnnee);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-encre">Années académiques</h1>
        <p className="text-sm text-encre-douce">
          {contexte.etablissementActif.name} · le libellé et le découpage sont libres : aucun
          calendrier n&apos;est présupposé.
        </p>
      </header>

      {peutModifier ? <FormulaireAnnee /> : null}

      {annees.length === 0 ? (
        <Carte>
          <EtatVide
            icone={<CalendarRange className="size-8" />}
            titre="Aucune année académique"
            description={
              peutModifier
                ? "Créez une année : classes, inscriptions et bulletins s'y rattacheront."
                : 'Aucune année n’a encore été définie pour cet établissement.'
            }
          />
        </Carte>
      ) : (
        <div className="space-y-4">
          {annees.map((annee) => (
            <Carte key={annee.id}>
              <CorpsCarte className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-encre">{annee.name}</h2>
                      {annee.is_current ? <Etiquette ton="succes">Année en cours</Etiquette> : null}
                    </div>
                    <p className="mt-0.5 text-sm text-encre-douce">
                      Du {formaterDate(annee.starts_on, contexte.reglages)} au{' '}
                      {formaterDate(annee.ends_on, contexte.reglages)}
                    </p>
                  </div>
                  {peutModifier && !annee.is_current ? (
                    <BoutonAnneeCourante anneeId={annee.id} />
                  ) : null}
                </div>

                <PeriodesAnnee
                  anneeId={annee.id}
                  periodes={periodes.get(annee.id) ?? []}
                  peutModifier={peutModifier}
                />
              </CorpsCarte>
            </Carte>
          ))}
        </div>
      )}
    </div>
  );
}
