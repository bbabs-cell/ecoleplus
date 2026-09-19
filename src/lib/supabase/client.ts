'use client';

import { createBrowserClient } from '@supabase/ssr';
import { envPublic } from '@/lib/env';
import type { Database } from '@/lib/types/database';

/**
 * Client Supabase côté navigateur.
 *
 * Réservé à ce qui doit impérativement s'exécuter dans le navigateur :
 * connexion, déconnexion, rafraîchissement de session. Toute lecture ou
 * écriture de données métier passe par un Server Component ou une Server
 * Action, où la permission est revérifiée côté serveur (règles de code, 2 et 3).
 */
export function clientNavigateur() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = envPublic();
  return createBrowserClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
