import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { exigerEtablissement } from '@/services/permissions';
import { fichiersDeLApprenant } from '@/services/fichiers';
import { stockageConfigure } from '@/lib/r2/client';
import { CarteDocuments } from '@/components/fichiers/documents';
import { lireDossier } from '@/services/apprenants';
import { listerAnnees, listerNiveaux } from '@/services/academique';
import { listerClasses } from '@/services/classes';
import { formaterDate, initiales, nomAffiche } from '@/lib/format';
import type { Classe } from '@/lib/types/database';
import { Carte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';
import { Etiquette } from '@/components/ui/etiquette';
import { StatutInscription } from '@/components/academique/statut-inscription';
import { ActionsInscription, FicheApprenant, FormulaireReinscription } from './formulaires';

export const metadata: Metadata = { title: 'Dossier apprenant' };

export default async function PageDossier({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contexte = await exigerEtablissement('learners.read');

  const dossier = await lireDossier(id);

  // RLS a déjà filtré : un dossier hors de portée revient vide, et il ne faut
  // pas distinguer « inexistant » de « pas le droit ».
  if (!dossier) notFound();

  const format = contexte.reglages.name_display_format;
  const peutModifier = contexte.permissions.has('learners.manage');
  const peutGerer = contexte.permissions.has('enrollments.manage');

  const documents = contexte.permissions.has('files.read')
    ? await fichiersDeLApprenant(dossier.apprenant.id)
    : [];

  const annees = await listerAnnees(contexte.etablissementActif.id);
  const niveaux = peutGerer ? await listerNiveaux(contexte.etablissementActif.id, true) : [];

  // Classes de chaque année, pour l'affectation et la réinscription.
  const classesParAnnee: Record<string, Pick<Classe, 'id' | 'name'>[]> = {};
  if (peutGerer) {
    const listes = await Promise.all(
      annees.map(async (annee) => [annee.id, await listerClasses(annee.id)] as const),
    );
    for (const [anneeId, classes] of listes) {
      classesParAnnee[anneeId] = classes
        .filter((classe) => classe.is_active)
        .map(({ id: classeId, name }) => ({ id: classeId, name }));
    }
  }

  const nom = nomAffiche(dossier.apprenant, format);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/apprenants"
        className="inline-flex items-center gap-1.5 text-sm text-encre-douce transition-colors hover:text-encre"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Retour aux apprenants
      </Link>

      <header className="flex flex-wrap items-center gap-4">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primaire-douce text-sm font-semibold text-primaire"
          aria-hidden="true"
        >
          {initiales(dossier.apprenant, format)}
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-encre">{nom || 'Sans nom'}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-encre-douce">
            {dossier.apprenant.learner_code ? (
              <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
                {dossier.apprenant.learner_code}
              </span>
            ) : null}
            {dossier.apprenant.is_archived ? <Etiquette ton="alerte">Archivé</Etiquette> : null}
            <span>
              {dossier.inscriptions.length} inscription
              {dossier.inscriptions.length > 1 ? 's' : ''}
            </span>
          </p>
        </div>
      </header>

      <FicheApprenant apprenant={dossier.apprenant} peutModifier={peutModifier} />

      <Carte>
        <EnTeteCarte>
          <TitreCarte>Scolarité</TitreCarte>
          <SousTitreCarte>
            Historique complet, toutes années et tous établissements confondus.
          </SousTitreCarte>
        </EnTeteCarte>

        {dossier.inscriptions.map((inscription) => (
          <div key={inscription.id} className="space-y-3 border-t border-bordure p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-encre">{inscription.annee?.name ?? 'Année inconnue'}</p>
                  <StatutInscription statut={inscription.status} />
                </div>
                <p className="mt-0.5 text-sm text-encre-douce">
                  {[
                    inscription.etablissement?.name,
                    inscription.niveau?.name,
                    inscription.classe?.name ?? 'Sans classe',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="mt-0.5 text-xs text-encre-douce">
                  Du {formaterDate(inscription.enrolled_on, contexte.reglages)}
                  {inscription.ended_on
                    ? ` au ${formaterDate(inscription.ended_on, contexte.reglages)}`
                    : ''}
                  {inscription.status_reason ? ` · ${inscription.status_reason}` : ''}
                </p>
              </div>
            </div>

            <ActionsInscription
              inscriptionId={inscription.id}
              statutActuel={inscription.status}
              classeActuelle={inscription.class_id}
              classes={classesParAnnee[inscription.academic_year_id] ?? []}
              peutGerer={peutGerer}
            />
          </div>
        ))}
      </Carte>

      {peutGerer ? (
        <FormulaireReinscription
          apprenantId={dossier.apprenant.id}
          annees={annees}
          niveaux={niveaux}
          classesParAnnee={classesParAnnee}
        />
      ) : null}

      {contexte.permissions.has('files.read') ? (
        <CarteDocuments
          titre="Pièces du dossier"
          fichiers={documents}
          chemin={`/apprenants/${dossier.apprenant.id}`}
          reglages={contexte.reglages}
          format={contexte.reglages.name_display_format}
          cible={{ apprenantId: dossier.apprenant.id }}
          peutDeposer={contexte.permissions.has('files.upload')}
          peutSupprimer={contexte.permissions.has('files.delete')}
          stockageActif={stockageConfigure()}
          categorieSuggeree="Acte de naissance"
        />
      ) : null}
    </div>
  );
}
