import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { exigerEtablissement } from '@/services/permissions';
import { listerNiveaux, resoudreAnnee } from '@/services/academique';
import { listerClasses } from '@/services/classes';
import { deviseEtablissement, listerFrais, soldesDeLaClasse } from '@/services/finances';
import { formaterMontant } from '@/lib/argent';
import { nomAffiche } from '@/lib/format';
import { Carte, CorpsCarte } from '@/components/ui/carte';
import { EtatVide } from '@/components/ui/etats';
import { Alerte } from '@/components/ui/alerte';
import { SelecteurAnnee } from '@/components/academique/selecteur-annee';
import {
  CarteFrais,
  EnTeteSoldes,
  FormulaireFrais,
  ReglageDevise,
  SelecteurClasseSoldes,
} from './formulaires';
import { TitrePage } from '@/components/ui/titre-page';

export const metadata: Metadata = { title: 'Finances' };

export default async function PageFinances({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; classe?: string }>;
}) {
  const contexte = await exigerEtablissement('finance.read');
  const { annee: anneeDemandee, classe: classeId } = await searchParams;

  const { annee, annees } = await resoudreAnnee(contexte.etablissementActif.id, anneeDemandee);
  const peutConfigurer = contexte.permissions.has('finance.configure');
  const peutAffecter = contexte.permissions.has('finance.assign');
  const peutRegler = contexte.permissions.has('establishments.update');
  const format = contexte.reglages.name_display_format;

  const devise = await deviseEtablissement(
    contexte.etablissementActif.id,
    contexte.reglages.currency,
  );

  if (!annee) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <TitrePage teinte="finances">Finances</TitrePage>
        <Alerte ton="alerte" titre="Aucune année académique">
          Les frais se rattachent à une année.{' '}
          <Link href="/annees" className="font-medium text-primaire">
            Créez-en une d&apos;abord
          </Link>
          .
        </Alerte>
      </div>
    );
  }

  const [frais, classes, niveaux] = await Promise.all([
    listerFrais(annee.id),
    listerClasses(annee.id),
    listerNiveaux(contexte.etablissementActif.id, true),
  ]);

  const soldes = classeId ? await soldesDeLaClasse(classeId) : [];
  const classesActives = classes.filter((classe) => classe.is_active);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <TitrePage teinte="finances">Finances</TitrePage>
          <p className="text-sm text-encre-douce">
            {contexte.etablissementActif.name} · {frais.length} frais sur {annee.name} · devise{' '}
            {devise}
          </p>
        </div>
        <SelecteurAnnee annees={annees} anneeActive={annee.id} />
      </header>

      {peutRegler ? <ReglageDevise devise={devise} /> : null}

      {peutConfigurer ? (
        <FormulaireFrais
          anneeId={annee.id}
          anneeNom={annee.name}
          devise={devise}
          niveaux={niveaux}
        />
      ) : null}

      {frais.length === 0 ? (
        <Carte>
          <EtatVide
            icone={<Wallet className="size-8" />}
            titre="Aucun frais"
            description={
              peutConfigurer
                ? `Définissez les frais de l'année ${annee.name}.`
                : `Aucun frais n'est défini pour l'année ${annee.name}.`
            }
          />
        </Carte>
      ) : (
        <div className="space-y-4">
          {frais.map((ligne) => (
            <CarteFrais
              key={ligne.id}
              frais={ligne}
              classes={classesActives}
              peutConfigurer={peutConfigurer}
              peutAffecter={peutAffecter}
            />
          ))}
        </div>
      )}

      <div className="space-y-4">
        <EnTeteSoldes />
        <Suspense fallback={null}>
          <SelecteurClasseSoldes classes={classesActives} classeActive={classeId ?? ''} />
        </Suspense>

        {classeId ? (
          <Carte className="overflow-hidden">
            {soldes.length === 0 ? (
              <EtatVide
                icone={<Wallet className="size-8" />}
                titre="Aucun apprenant"
                description="Cette classe ne compte aucune inscription vivante."
              />
            ) : (
              soldes.map((solde) => (
                <Link
                  key={solde.inscriptionId}
                  href={`/finances/${solde.inscriptionId}`}
                  className="flex flex-wrap items-center gap-3 border-b border-bordure p-5 transition-colors last:border-b-0 hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-encre">
                      {nomAffiche(solde.apprenant, format)}
                      {solde.apprenant.learner_code ? (
                        <span className="ms-2 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-encre-douce">
                          {solde.apprenant.learner_code}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm text-encre-douce">
                      {solde.devise === ''
                        ? 'Aucune créance'
                        : `${formaterMontant(solde.regle, solde.devise)} réglés sur ${formaterMontant(solde.du, solde.devise)}`}
                      {solde.enRetard > 0 ? (
                        <span className="ms-2 font-medium text-alerte">
                          {solde.enRetard} échéance{solde.enRetard > 1 ? 's' : ''} en retard
                        </span>
                      ) : null}
                    </p>
                  </div>

                  {solde.devise === '' ? null : (
                    <span
                      className={
                        solde.solde > 0
                          ? 'font-semibold tabular-nums text-danger'
                          : 'font-semibold tabular-nums text-succes'
                      }
                    >
                      {formaterMontant(solde.solde, solde.devise)}
                    </span>
                  )}
                </Link>
              ))
            )}
          </Carte>
        ) : (
          <Carte>
            <CorpsCarte>
              <p className="text-sm text-encre-douce">
                Choisissez une classe pour voir ses soldes, apprenant par apprenant.
              </p>
            </CorpsCarte>
          </Carte>
        )}
      </div>
    </div>
  );
}
