import { clientServeur } from '@/lib/supabase/server';
import type { Establishment } from '@/lib/types/database';

export const TAILLE_PAGE = 25;

export interface PageResultats<T> {
  lignes: T[];
  total: number;
  page: number;
  pages: number;
}

/**
 * Établissements visibles par l'appelant, paginés.
 *
 * Aucun filtre sur l'organisation : RLS s'en charge, et l'ajouter ici
 * laisserait croire que c'est cette ligne qui protège (règles de code, 11 pour
 * la pagination, CLAUDE.md règle 1 pour le cloisonnement).
 */
export async function listerEtablissements(
  page = 1,
  inclureArchives = false,
): Promise<PageResultats<Establishment>> {
  const supabase = await clientServeur();
  const depuis = (page - 1) * TAILLE_PAGE;

  let requete = supabase
    .from('establishments')
    .select('*', { count: 'exact' })
    .order('name')
    .range(depuis, depuis + TAILLE_PAGE - 1);

  if (!inclureArchives) {
    requete = requete.neq('status', 'ARCHIVED');
  }

  const { data, count, error } = await requete;

  if (error) throw error;

  const total = count ?? 0;

  return {
    lignes: data ?? [],
    total,
    page,
    pages: Math.max(1, Math.ceil(total / TAILLE_PAGE)),
  };
}

export async function lireEtablissement(id: string): Promise<Establishment | null> {
  const supabase = await clientServeur();
  const { data } = await supabase.from('establishments').select('*').eq('id', id).maybeSingle();
  return data ?? null;
}
