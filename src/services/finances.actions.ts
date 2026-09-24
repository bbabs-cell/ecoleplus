'use server';

import { revalidatePath } from 'next/cache';
import { clientServeur } from '@/lib/supabase/server';
import { exigerEtablissement, exigerPermission } from '@/services/permissions';
import {
  ajustementSchema,
  deviseSchema,
  echeanceSchema,
  fraisSchema,
  paiementSchema,
} from '@/lib/validation';
import { enUniteMineure } from '@/lib/argent';
import { champsInvalides, messageErreur } from '@/services/erreurs';
import type { EtatFormulaire } from '@/services/formulaire';
import { deviseEtablissement } from '@/services/finances';

/**
 * Devise de fonctionnement de l'établissement.
 *
 * Changer de devise ne convertit rien : les montants déjà enregistrés gardent
 * la leur. C'est volontaire — une conversion rétroactive dans une comptabilité
 * serait une falsification, pas une mise à jour.
 */
export async function definirDeviseAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('establishments.update');

  const saisie = deviseSchema.safeParse(String(donnees.get('devise') ?? '').toUpperCase());
  if (!saisie.success) {
    return { statut: 'erreur', message: 'Code de devise invalide (trois lettres, ex. « XOF »).' };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.from('establishment_settings').upsert(
    {
      organization_id: contexte.organisation.id,
      establishment_id: contexte.etablissementActif.id,
      key: 'finance.currency',
      value: saisie.data,
    },
    { onConflict: 'establishment_id,key' },
  );

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/finances');
  return {
    statut: 'succes',
    message: `Devise de l'établissement : ${saisie.data}. Les montants déjà enregistrés gardent la leur.`,
  };
}

export async function creerFraisAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('finance.configure');

  const anneeId = String(donnees.get('anneeId') ?? '');
  if (!anneeId) return { statut: 'erreur', message: 'Sélectionnez une année académique.' };

  const saisie = fraisSchema.safeParse({
    nom: donnees.get('nom'),
    code: donnees.get('code'),
    type: donnees.get('type'),
    typeLibelle: donnees.get('typeLibelle'),
    montant: donnees.get('montant'),
    niveauId: donnees.get('niveauId'),
    recurrent: donnees.get('recurrent') === 'on',
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const devise = await deviseEtablissement(
    contexte.etablissementActif.id,
    contexte.reglages.currency,
  );
  const montant = enUniteMineure(saisie.data.montant, devise);

  if (montant === null || montant <= 0) {
    return {
      statut: 'erreur',
      message: `Montant invalide pour la devise ${devise}.`,
      champs: { montant: 'Montant invalide' },
    };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.from('fee_structures').insert({
    organization_id: contexte.organisation.id,
    establishment_id: contexte.etablissementActif.id,
    academic_year_id: anneeId,
    level_id: saisie.data.niveauId || null,
    name: saisie.data.nom,
    code: saisie.data.code,
    kind: saisie.data.type,
    kind_label: saisie.data.typeLibelle || null,
    amount_minor: montant,
    currency: devise,
    is_recurring: saisie.data.recurrent,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/finances');
  return { statut: 'succes', message: 'Frais créé.' };
}

export async function ajouterEcheanceAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const contexte = await exigerEtablissement('finance.configure');

  const fraisId = String(donnees.get('fraisId') ?? '');
  const devise = String(donnees.get('devise') ?? 'EUR');
  if (!fraisId) return { statut: 'erreur', message: 'Frais introuvable.' };

  const saisie = echeanceSchema.safeParse({
    libelle: donnees.get('libelle'),
    date: donnees.get('date'),
    montant: donnees.get('montant'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const montant = enUniteMineure(saisie.data.montant, devise);
  if (montant === null || montant <= 0) {
    return {
      statut: 'erreur',
      message: `Montant invalide pour la devise ${devise}.`,
      champs: { montant: 'Montant invalide' },
    };
  }

  const supabase = await clientServeur();
  const { count } = await supabase
    .from('fee_installments')
    .select('id', { count: 'exact', head: true })
    .eq('fee_structure_id', fraisId);

  const { error } = await supabase.from('fee_installments').insert({
    organization_id: contexte.organisation.id,
    fee_structure_id: fraisId,
    label: saisie.data.libelle,
    due_on: saisie.data.date,
    share_minor: montant,
    position: (count ?? 0) + 1,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/finances');
  return { statut: 'succes', message: 'Échéance ajoutée.' };
}

export async function supprimerEcheanceAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('finance.configure');

  const echeanceId = String(donnees.get('echeanceId') ?? '');
  if (!echeanceId) return { statut: 'erreur', message: 'Échéance introuvable.' };

  const supabase = await clientServeur();
  // La clé étrangère `on delete restrict` refuse si des créances s'y rattachent
  // déjà : on ne retire pas le sol sous une dette existante.
  const { error } = await supabase.from('fee_installments').delete().eq('id', echeanceId);

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/finances');
  return { statut: 'succes', message: 'Échéance retirée.' };
}

/** Affecte un frais à toute une classe — c'est ainsi que le travail se fait. */
export async function affecterFraisAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('finance.assign');

  const fraisId = String(donnees.get('fraisId') ?? '');
  const classeId = String(donnees.get('classeId') ?? '');

  if (!fraisId) return { statut: 'erreur', message: 'Frais introuvable.' };
  if (!classeId) return { statut: 'erreur', message: 'Sélectionnez une classe.' };

  const supabase = await clientServeur();

  const { data: inscriptions, error: erreurLecture } = await supabase
    .from('enrollments')
    .select('id')
    .eq('class_id', classeId)
    .in('status', ['PREREGISTERED', 'ENROLLED', 'ACTIVE', 'SUSPENDED']);

  if (erreurLecture) return { statut: 'erreur', message: messageErreur(erreurLecture) };
  if (!inscriptions || inscriptions.length === 0) {
    return { statut: 'erreur', message: 'Aucun apprenant inscrit dans cette classe.' };
  }

  const { data, error } = await supabase.rpc('affecter_frais', {
    p_fee_structure_id: fraisId,
    p_enrollment_ids: inscriptions.map((i) => i.id),
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath('/finances');
  return {
    statut: 'succes',
    message:
      data === 0
        ? 'Aucune nouvelle créance : ce frais était déjà affecté à cette classe.'
        : `${data} créance${(data ?? 0) > 1 ? 's' : ''} créée${(data ?? 0) > 1 ? 's' : ''}.`,
  };
}

/**
 * Encaisse un paiement et émet le reçu, dans la même transaction.
 *
 * Sans affectation explicite, le montant se répartit sur les créances ouvertes
 * de la plus ancienne échéance à la plus récente. Le paiement lui-même se
 * constate toujours : montant, moyen et date sont obligatoires.
 */
export async function encaisserPaiementAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('finance.collect');

  const inscriptionId = String(donnees.get('inscriptionId') ?? '');
  const devise = String(donnees.get('devise') ?? 'EUR');
  if (!inscriptionId) return { statut: 'erreur', message: 'Inscription introuvable.' };

  const saisie = paiementSchema.safeParse({
    montant: donnees.get('montant'),
    methode: donnees.get('methode'),
    reference: donnees.get('reference'),
    date: donnees.get('date'),
    notes: donnees.get('notes'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const montant = enUniteMineure(saisie.data.montant, devise);
  if (montant === null || montant <= 0) {
    return {
      statut: 'erreur',
      message: `Montant invalide pour la devise ${devise}.`,
      champs: { montant: 'Montant invalide' },
    };
  }

  // Affectations explicites, quand la caissière a réparti elle-même.
  const affectations: { obligation_id: string; amount_minor: number }[] = [];
  for (const [cle, valeur] of donnees.entries()) {
    if (!cle.startsWith('part:')) continue;
    const texte = String(valeur).trim();
    if (texte === '') continue;

    const part = enUniteMineure(texte, devise);
    if (part === null) {
      return { statut: 'erreur', message: `Part invalide : « ${texte} ».` };
    }
    if (part <= 0) continue;
    affectations.push({ obligation_id: cle.slice('part:'.length), amount_minor: part });
  }

  const supabase = await clientServeur();
  const { data, error } = await supabase.rpc('encaisser_paiement', {
    p_enrollment_id: inscriptionId,
    p_amount_minor: montant,
    p_method_label: saisie.data.methode,
    p_reference: saisie.data.reference || (null as unknown as string),
    p_paid_on: saisie.data.date,
    p_notes: saisie.data.notes || (null as unknown as string),
    ...(affectations.length > 0 ? { p_affectations: affectations } : {}),
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath(`/finances/${inscriptionId}`);
  revalidatePath('/finances');
  // L'identifiant du reçu revient au formulaire : l'écran propose le lien vers
  // le document sans avoir à le rechercher.
  return {
    statut: 'succes',
    message: 'Paiement enregistré, reçu émis.',
    donnees: { recuId: String(data) },
  };
}

export async function annulerRecuAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('finance.void');

  const recuId = String(donnees.get('recuId') ?? '');
  const raison = String(donnees.get('raison') ?? '').trim();

  if (!recuId) return { statut: 'erreur', message: 'Reçu introuvable.' };
  if (!raison) return { statut: 'erreur', message: 'Annuler un reçu exige un motif.' };

  const supabase = await clientServeur();
  const { error } = await supabase.rpc('annuler_recu', {
    p_receipt_id: recuId,
    p_raison: raison,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  revalidatePath(`/recus/${recuId}`);
  revalidatePath('/finances');
  return {
    statut: 'succes',
    message: 'Reçu annulé. Il reste consultable, et son montant est rendu aux créances.',
  };
}

export async function ajusterCreanceAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('finance.assign');

  const devise = String(donnees.get('devise') ?? 'EUR');
  const inscriptionId = String(donnees.get('inscriptionId') ?? '');

  const saisie = ajustementSchema.safeParse({
    creanceId: donnees.get('creanceId'),
    remise: donnees.get('remise') || '',
    ajustement: donnees.get('ajustement') || '',
    raison: donnees.get('raison'),
  });

  if (!saisie.success) {
    return {
      statut: 'erreur',
      message: 'Vérifiez les champs signalés.',
      champs: champsInvalides(saisie.error.issues),
    };
  }

  const remise = saisie.data.remise === '' ? 0 : enUniteMineure(saisie.data.remise, devise);
  const ajustement =
    saisie.data.ajustement === '' ? 0 : enUniteMineure(saisie.data.ajustement, devise);

  if (remise === null || ajustement === null) {
    return { statut: 'erreur', message: `Montant invalide pour la devise ${devise}.` };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.rpc('ajuster_creance', {
    p_obligation_id: saisie.data.creanceId,
    p_discount_minor: remise,
    p_adjustment_minor: ajustement,
    p_raison: saisie.data.raison,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  if (inscriptionId) revalidatePath(`/finances/${inscriptionId}`);
  return { statut: 'succes', message: 'Créance ajustée et tracée.' };
}

export async function annulerCreanceAction(
  _precedent: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  await exigerPermission('finance.void');

  const creanceId = String(donnees.get('creanceId') ?? '');
  const raison = String(donnees.get('raison') ?? '').trim();
  const inscriptionId = String(donnees.get('inscriptionId') ?? '');

  if (!creanceId) return { statut: 'erreur', message: 'Créance introuvable.' };
  if (!raison) return { statut: 'erreur', message: 'Annuler une créance exige un motif.' };

  const supabase = await clientServeur();
  const { error } = await supabase.rpc('annuler_creance', {
    p_obligation_id: creanceId,
    p_raison: raison,
  });

  if (error) return { statut: 'erreur', message: messageErreur(error) };

  if (inscriptionId) revalidatePath(`/finances/${inscriptionId}`);
  return { statut: 'succes', message: 'Créance annulée et tracée.' };
}
