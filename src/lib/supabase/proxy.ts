import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { envPublic } from '@/lib/env';
import { COOKIE_LANGUE, estLocaleConnue, normaliserLocale } from '@/i18n/locales';
import type { Database } from '@/lib/types/database';

/** Routes accessibles sans session. Tout le reste exige une authentification. */
const ROUTES_PUBLIQUES = ['/connexion', '/inscription', '/auth', '/invitation'];

function estPublique(chemin: string): boolean {
  return ROUTES_PUBLIQUES.some(
    (prefixe) => chemin === prefixe || chemin.startsWith(`${prefixe}/`),
  );
}

/**
 * Rafraîchit la session à chaque requête et referme les routes privées.
 *
 * C'est ici — et seulement ici — que les cookies de session sont réécrits :
 * un Server Component n'en a pas le droit. Sans ce passage, un jeton expiré ne
 * serait jamais renouvelé et l'utilisateur serait déconnecté sans raison.
 *
 * Ce garde-fou ne remplace aucun contrôle : il évite un aller-retour inutile,
 * mais l'autorisation réelle reste faite par RLS et par la couche `services`.
 */
export async function actualiserSession(requete: NextRequest): Promise<NextResponse> {
  let reponse = NextResponse.next({ request: requete });

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = envPublic();

  const supabase = createServerClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return requete.cookies.getAll();
        },
        setAll(aEcrire) {
          for (const { name, value } of aEcrire) {
            requete.cookies.set(name, value);
          }
          reponse = NextResponse.next({ request: requete });
          for (const { name, value, options } of aEcrire) {
            reponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // `getUser()` et non `getSession()` : seul le premier revalide le jeton
  // auprès du serveur Auth. `getSession()` se contente de lire le cookie, donc
  // fait confiance à une donnée que le navigateur pourrait avoir altérée.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // La langue de l'organisation voyage dans le jeton (claim `locale`, posé par
  // le hook d'émission). On la recopie ici dans un cookie lisible, pour que
  // `<html lang dir>` soit juste dès la première requête : la mise en page
  // racine s'exécute avant tout contexte applicatif et ne peut pas interroger
  // la base.
  //
  // `getClaims()` et non `user.app_metadata` : les claims du hook sont posés à
  // la RACINE du jeton, pas dans `app_metadata`, et `getClaims()` est la seule
  // méthode qui les rende après vérification de la signature.
  //
  // Le choix explicite de l'utilisateur prime : s'il a déjà posé un cookie, on
  // n'y touche pas.
  if (user && !requete.cookies.has(COOKIE_LANGUE)) {
    const { data: jeton } = await supabase.auth.getClaims();
    const revendiquee = jeton?.claims['locale'];
    const locale = normaliserLocale(typeof revendiquee === 'string' ? revendiquee : undefined);

    if (estLocaleConnue(locale)) {
      reponse.cookies.set(COOKIE_LANGUE, locale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
        // Aucune décision de sécurité ne repose dessus : le falsifier ne
        // change que la langue d'affichage.
        httpOnly: false,
      });
    }
  }

  const chemin = requete.nextUrl.pathname;

  if (!user && !estPublique(chemin)) {
    const url = requete.nextUrl.clone();
    url.pathname = '/connexion';
    // Mémorise la destination pour y revenir après connexion.
    url.searchParams.set('suite', chemin);
    return NextResponse.redirect(url);
  }

  if (user && (chemin === '/connexion' || chemin === '/inscription')) {
    const url = requete.nextUrl.clone();
    url.pathname = '/tableau-de-bord';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return reponse;
}
