import { clientServeur } from '@/lib/supabase/server';
import type { Teacher } from '@/lib/types/database';
import { TAILLE_PAGE, type PageResultats } from '@/services/etablissements';

export async function listerEnseignants(
  etablissementId: string,
  page = 1,
): Promise<PageResultats<Teacher>> {
  const supabase = await clientServeur();
  const depuis = (page - 1) * TAILLE_PAGE;

  const { data, count, error } = await supabase
    .from('teachers')
    .select('*', { count: 'exact' })
    .eq('establishment_id', etablissementId)
    .order('family_name')
    .order('given_name')
    .range(depuis, depuis + TAILLE_PAGE - 1);

  if (error) throw error;

  const total = count ?? 0;
  return { lignes: data ?? [], total, page, pages: Math.max(1, Math.ceil(total / TAILLE_PAGE)) };
}

/** Enseignants actifs, pour les listes de choix (professeur principal, affectations). */
export async function enseignantsActifs(etablissementId: string): Promise<Teacher[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('establishment_id', etablissementId)
    .eq('status', 'ACTIVE')
    .order('family_name');

  if (error) throw error;
  return data ?? [];
}
