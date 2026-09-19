import { clientServeur } from '@/lib/supabase/server';
import type { AuditLog } from '@/lib/types/database';
import { TAILLE_PAGE, type PageResultats } from '@/services/etablissements';

/**
 * Journal d'audit, du plus récent au plus ancien.
 *
 * La lecture exige la permission `audit.read`, imposée par la policy : sans
 * elle, la requête ne renvoie rien plutôt qu'une erreur.
 */
export async function listerJournal(page = 1): Promise<PageResultats<AuditLog>> {
  const supabase = await clientServeur();
  const depuis = (page - 1) * TAILLE_PAGE;

  const { data, count, error } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('occurred_at', { ascending: false })
    .range(depuis, depuis + TAILLE_PAGE - 1);

  if (error) throw error;

  const total = count ?? 0;
  return { lignes: data ?? [], total, page, pages: Math.max(1, Math.ceil(total / TAILLE_PAGE)) };
}
