import type { Metadata } from 'next';
import { exigerPermission } from '@/services/permissions';
import { devises, fuseauxHoraires, LANGUES, nomDevise, nomLangue, nomPays } from '@/lib/reference';
import { formaterDate } from '@/lib/format';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';
import { Alerte } from '@/components/ui/alerte';
import { FormulaireFiche, FormulaireReglages } from './formulaires';
import { TitrePage } from '@/components/ui/titre-page';

export const metadata: Metadata = { title: 'Organisation' };

export default async function PageOrganisation() {
  const contexte = await exigerPermission('organization.read');
  const { organisation, reglages, permissions } = contexte;

  const peutModifierFiche = permissions.has('organization.update');
  const peutModifierReglages = permissions.has('organization.settings.update');

  const locale = reglages.default_locale;
  const comparateur = new Intl.Collator(locale);

  const listeFuseaux = fuseauxHoraires().map((zone) => ({ valeur: zone, libelle: zone }));
  const listeDevises = devises()
    .map((code) => ({ valeur: code, libelle: `${code} — ${nomDevise(code, locale)}` }))
    .sort((a, b) => comparateur.compare(a.libelle, b.libelle));
  const listeLangues = LANGUES.map((code) => ({ valeur: code, libelle: nomLangue(code, locale) }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <TitrePage teinte="admin">Organisation</TitrePage>
        <p className="text-sm text-encre-douce">
          {nomPays(organisation.country_code, locale)} · créée le{' '}
          {formaterDate(organisation.created_at, reglages)}
        </p>
      </header>

      {!peutModifierFiche && !peutModifierReglages ? (
        <Alerte ton="info">
          Vous consultez ces informations en lecture seule : leur modification demande une
          permission que votre rôle ne porte pas.
        </Alerte>
      ) : null}

      <Carte>
        <EnTeteCarte>
          <TitreCarte>Fiche</TitreCarte>
          <SousTitreCarte>Coordonnées de l&apos;organisation.</SousTitreCarte>
        </EnTeteCarte>
        <CorpsCarte>
          <FormulaireFiche organisation={organisation} lectureSeule={!peutModifierFiche} />
        </CorpsCarte>
      </Carte>

      <Carte>
        <EnTeteCarte>
          <TitreCarte>Paramètres régionaux</TitreCarte>
          <SousTitreCarte>
            Ces réglages déterminent l&apos;affichage dans toute l&apos;application. Aucune de ces
            valeurs n&apos;est codée en dur : le pays ne les impose pas.
          </SousTitreCarte>
        </EnTeteCarte>
        <CorpsCarte>
          <FormulaireReglages
            reglages={reglages}
            fuseaux={listeFuseaux}
            devises={listeDevises}
            langues={listeLangues}
            lectureSeule={!peutModifierReglages}
          />
        </CorpsCarte>
      </Carte>
    </div>
  );
}
