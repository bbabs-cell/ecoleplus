import { clientServeur } from '@/lib/supabase/server';
import type { AcademicTerm, AcademicYear, Level, Subject } from '@/lib/types/database';

/**
 * Lectures du référentiel académique.
 *
 * Aucun filtre sur l'organisation : RLS s'en charge. Le filtre sur
 * l'établissement, lui, est fonctionnel — il cible l'établissement de travail
 * courant, pas une frontière de sécurité.
 */

export async function listerAnnees(etablissementId: string): Promise<AcademicYear[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('academic_years')
    .select('*')
    .eq('establishment_id', etablissementId)
    .order('starts_on', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function anneeCourante(etablissementId: string): Promise<AcademicYear | null> {
  const supabase = await clientServeur();
  const { data } = await supabase
    .from('academic_years')
    .select('*')
    .eq('establishment_id', etablissementId)
    .eq('is_current', true)
    .maybeSingle();

  return data ?? null;
}

/**
 * Année sur laquelle travailler : celle demandée si elle existe, sinon l'année
 * courante, sinon la plus récente. Renvoie `null` quand aucune n'est définie.
 */
export async function resoudreAnnee(
  etablissementId: string,
  demandee?: string | undefined,
): Promise<{ annee: AcademicYear | null; annees: AcademicYear[] }> {
  const annees = await listerAnnees(etablissementId);

  const annee =
    annees.find((candidate) => candidate.id === demandee) ??
    annees.find((candidate) => candidate.is_current) ??
    annees[0] ??
    null;

  return { annee, annees };
}

export async function listerPeriodes(anneeId: string): Promise<AcademicTerm[]> {
  const supabase = await clientServeur();
  const { data, error } = await supabase
    .from('academic_terms')
    .select('*')
    .eq('academic_year_id', anneeId)
    .order('position');

  if (error) throw error;
  return data ?? [];
}

export async function listerNiveaux(
  etablissementId: string,
  seulementActifs = false,
): Promise<Level[]> {
  const supabase = await clientServeur();
  let requete = supabase
    .from('levels')
    .select('*')
    .eq('establishment_id', etablissementId)
    .order('position');

  if (seulementActifs) requete = requete.eq('is_active', true);

  const { data, error } = await requete;
  if (error) throw error;
  return data ?? [];
}

export async function listerMatieres(
  etablissementId: string,
  seulementActives = false,
): Promise<Subject[]> {
  const supabase = await clientServeur();
  let requete = supabase
    .from('subjects')
    .select('*')
    .eq('establishment_id', etablissementId)
    .order('name');

  if (seulementActives) requete = requete.eq('is_active', true);

  const { data, error } = await requete;
  if (error) throw error;
  return data ?? [];
}
