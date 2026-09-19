import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { envPublic } from '@/lib/env';
import type { Database } from '@/lib/types/database';

/**
 * Client Supabase pour Server Components, Server Actions et Route Handlers.
 *
 * Toujours créé par requête : ce client porte les cookies de session de
 * l'appelant, donc son JWT, donc son contexte RLS. Le mettre en cache
 * exposerait la session d'un utilisateur à un autre.
 */
export async function clientServeur() {
  // `cookies()` d'abord : sa lecture signale à Next que la route est dynamique.
  // Valider l'environnement avant lèverait pendant le prérendu du build, sur
  // une machine qui n'a légitimement aucun secret.
  const magasin = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = envPublic();

  return createServerClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return magasin.getAll();
        },
        setAll(aEcrire) {
          try {
            for (const { name, value, options } of aEcrire) {
              magasin.set(name, value, options);
            }
          } catch {
            // Un Server Component ne peut pas écrire de cookie. Ce n'est pas une
            // erreur : le middleware a déjà rafraîchi la session pour cette
            // requête, et c'est lui qui pose les cookies.
          }
        },
      },
    },
  );
}
