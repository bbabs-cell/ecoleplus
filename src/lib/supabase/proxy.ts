import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { envPublic } from '@/lib/env';
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
