import type { NextRequest } from 'next/server';
import { actualiserSession } from '@/lib/supabase/proxy';

export async function proxy(requete: NextRequest) {
  return actualiserSession(requete);
}

export const config = {
  matcher: [
    /*
     * Tout sauf les ressources statiques et les images : les faire transiter
     * par le proxy coûterait un appel Auth à chaque fichier servi.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
