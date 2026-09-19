import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GraduationCap } from 'lucide-react';
import { brand } from '@/config/brand';
import { contexteSession } from '@/services/session';
import { deconnexionAction } from '@/services/auth.actions';
import {
  CODES_PAYS,
  LANGUES,
  devises,
  fuseauxHoraires,
  nomDevise,
  nomLangue,
  nomPays,
} from '@/lib/reference';
import { Carte, CorpsCarte, EnTeteCarte, SousTitreCarte, TitreCarte } from '@/components/ui/carte';
import { Alerte } from '@/components/ui/alerte';
import { Bouton } from '@/components/ui/bouton';
import { FormulaireOrganisation, type Option } from './formulaire';

export const metadata: Metadata = { title: 'Bienvenue' };

export default async function PageBienvenue() {
  const contexte = await contexteSession();
  if (!contexte) redirect('/connexion');

  // Déjà rattaché à une organisation : rien à faire ici.
  if (contexte.organisation) redirect('/tableau-de-bord');

  // Cas piégeux : le compte EST membre d'une organisation active, mais le jeton
  // n'en porte pas le contexte. RLS refuse donc tout, et l'écran de création
  // s'afficherait alors que l'organisation existe déjà.
  //
  // La cause est presque toujours la même : le hook d'émission du JWT n'est pas
  // activé côté Supabase. Plutôt qu'une impasse silencieuse, on nomme le
  // problème et on donne la manipulation exacte.
  if (contexte.adhesion) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-4 py-10">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-douce bg-primaire text-primaire-contraste">
            <GraduationCap className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-encre">{brand.name}</span>
        </div>

        <Carte>
          <EnTeteCarte>
            <TitreCarte>Contexte d&apos;organisation absent</TitreCarte>
            <SousTitreCarte>
              Votre compte est bien rattaché à une organisation, mais le jeton de session n&apos;en
              porte pas le contexte. Toutes les données restent donc inaccessibles.
            </SousTitreCarte>
          </EnTeteCarte>
          <CorpsCarte className="space-y-4">
            <Alerte ton="alerte" titre="Le hook JWT n'est probablement pas activé">
              <p className="mb-2">
                Dans le tableau de bord Supabase :{' '}
                <strong>Authentication → Hooks → Customize Access Token (JWT) Claims</strong>, puis
                sélectionnez <code className="font-mono text-xs">ecoleplus.custom_access_token_hook</code>.
              </p>
              <p>
                Déconnectez-vous et reconnectez-vous ensuite, pour qu&apos;un nouveau jeton soit
                émis.
              </p>
            </Alerte>

            <p className="text-sm text-encre-douce">
              Ce refus est volontaire : sans contexte vérifié côté serveur, la sécurité échoue
              fermée plutôt que d&apos;ouvrir l&apos;accès par défaut.
            </p>

            <form action={deconnexionAction}>
              <Bouton type="submit" variante="secondaire">
                Se déconnecter
              </Bouton>
            </form>
          </CorpsCarte>
        </Carte>
      </main>
    );
  }

  const locale = contexte.profil.locale;
  const comparateur = new Intl.Collator(locale);

  const pays: Option[] = CODES_PAYS.map((code) => ({
    valeur: code,
    libelle: nomPays(code, locale),
  })).sort((a, b) => comparateur.compare(a.libelle, b.libelle));

  const fuseaux: Option[] = fuseauxHoraires().map((zone) => ({ valeur: zone, libelle: zone }));

  const listeDevises: Option[] = devises()
    .map((code) => ({ valeur: code, libelle: `${code} — ${nomDevise(code, locale)}` }))
    .sort((a, b) => comparateur.compare(a.libelle, b.libelle));

  const langues: Option[] = LANGUES.map((code) => ({
    valeur: code,
    libelle: nomLangue(code, locale),
  }));

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-douce bg-primaire text-primaire-contraste">
          <GraduationCap className="size-5" aria-hidden="true" />
        </span>
        <span className="text-lg font-semibold tracking-tight text-encre">{brand.name}</span>
      </div>

      <Carte>
        <EnTeteCarte>
          <TitreCarte>Créez votre organisation</TitreCarte>
          <SousTitreCarte>
            Ces réglages déterminent la langue, le fuseau et la devise de votre espace. Rien n&apos;est
            figé : tout se modifie ensuite.
          </SousTitreCarte>
        </EnTeteCarte>
        <CorpsCarte className="space-y-5">
          <Alerte ton="info">
            Vous avez reçu un lien d&apos;invitation ? Ouvrez-le directement : il vous rattachera à
            l&apos;organisation qui vous a invité, sans créer la vôtre.
          </Alerte>
          <FormulaireOrganisation
            pays={pays}
            fuseaux={fuseaux}
            devises={listeDevises}
            langues={langues}
            defauts={{ fuseau: 'UTC', langue: locale }}
          />
        </CorpsCarte>
      </Carte>
    </main>
  );
}
