import type { Locale } from '@/i18n/locales';

/**
 * Dictionnaires.
 *
 * La clé est la chaîne FRANÇAISE exacte. Une entrée absente n'est pas une
 * erreur : la chaîne s'affiche telle quelle. Traduire un écran consiste donc à
 * ajouter des lignes, jamais à en modifier ailleurs.
 *
 * `fr` n'existe pas comme dictionnaire : la clé EST le français.
 */
type Dictionnaire = Record<string, string>;

const en: Dictionnaire = {
  // Navigation
  'Tableau de bord': 'Dashboard',
  Établissements: 'Establishments',
  Années: 'Academic years',
  Niveaux: 'Levels',
  Matières: 'Subjects',
  Enseignants: 'Teachers',
  Classes: 'Classes',
  Apprenants: 'Learners',
  Présences: 'Attendance',
  Évaluations: 'Assessments',
  Bulletins: 'Report cards',
  Barèmes: 'Grading scales',
  Finances: 'Finance',
  Membres: 'Members',
  "Journal d'audit": 'Audit log',
  Organisation: 'Organisation',
  'Navigation principale': 'Main navigation',
  'Se déconnecter': 'Sign out',

  // Vocabulaire partagé
  Enregistrer: 'Save',
  Annuler: 'Cancel',
  Fermer: 'Close',
  Ajouter: 'Add',
  Retirer: 'Remove',
  Rechercher: 'Search',
  Motif: 'Reason',
  Date: 'Date',
  Classe: 'Class',
  Matière: 'Subject',
  Période: 'Term',
  Apprenant: 'Learner',
  Statut: 'Status',
  Langue: 'Language',
  'Langue de l’interface': 'Interface language',

  // Notation — le vocabulaire qui porte la règle 4
  Note: 'Score',
  Absent: 'Absent',
  'Absence justifiée': 'Excused absence',
  Dispensé: 'Exempt',
  'Sans objet': 'Not applicable',
  'Non saisie': 'Not entered',
  Brouillon: 'Draft',
  Saisie: 'Entered',
  Vérifiée: 'Verified',
  Publiée: 'Published',
  Corrigée: 'Corrected',
  Invalidée: 'Cancelled',
  Archivée: 'Archived',

  // Finances
  'Total dû': 'Total due',
  Réglé: 'Paid',
  Solde: 'Balance',
  Échéances: 'Instalments',
  Impayée: 'Unpaid',
  Partielle: 'Partial',
  Soldée: 'Settled',
  Annulée: 'Cancelled',
  Imprimer: 'Print',
  'Reçu n°': 'Receipt no.',
  ANNULÉ: 'VOIDED',
  Déposer: 'Upload',
};

const es: Dictionnaire = {
  'Tableau de bord': 'Panel',
  Établissements: 'Centros',
  Années: 'Cursos académicos',
  Niveaux: 'Niveles',
  Matières: 'Asignaturas',
  Enseignants: 'Profesorado',
  Classes: 'Clases',
  Apprenants: 'Alumnado',
  Présences: 'Asistencia',
  Évaluations: 'Evaluaciones',
  Bulletins: 'Boletines',
  Barèmes: 'Escalas de calificación',
  Finances: 'Finanzas',
  Membres: 'Miembros',
  "Journal d'audit": 'Registro de auditoría',
  Organisation: 'Organización',
  'Navigation principale': 'Navegación principal',
  'Se déconnecter': 'Cerrar sesión',

  Enregistrer: 'Guardar',
  Annuler: 'Cancelar',
  Fermer: 'Cerrar',
  Ajouter: 'Añadir',
  Retirer: 'Quitar',
  Rechercher: 'Buscar',
  Motif: 'Motivo',
  Date: 'Fecha',
  Classe: 'Clase',
  Matière: 'Asignatura',
  Période: 'Periodo',
  Apprenant: 'Alumno',
  Statut: 'Estado',
  Langue: 'Idioma',
  'Langue de l’interface': 'Idioma de la interfaz',

  Note: 'Nota',
  Absent: 'Ausente',
  'Absence justifiée': 'Ausencia justificada',
  Dispensé: 'Exento',
  'Sans objet': 'No aplicable',
  'Non saisie': 'Sin registrar',
  Brouillon: 'Borrador',
  Saisie: 'Registrada',
  Vérifiée: 'Verificada',
  Publiée: 'Publicada',
  Corrigée: 'Corregida',
  Invalidée: 'Anulada',
  Archivée: 'Archivada',

  'Total dû': 'Total adeudado',
  Réglé: 'Pagado',
  Solde: 'Saldo',
  Échéances: 'Plazos',
  Impayée: 'Impagada',
  Partielle: 'Parcial',
  Soldée: 'Saldada',
  Annulée: 'Anulada',
  Imprimer: 'Imprimir',
  'Reçu n°': 'Recibo n.º',
  ANNULÉ: 'ANULADO',
  Déposer: 'Subir',
};

const ar: Dictionnaire = {
  'Tableau de bord': 'لوحة القيادة',
  Établissements: 'المؤسسات',
  Années: 'السنوات الدراسية',
  Niveaux: 'المستويات',
  Matières: 'المواد',
  Enseignants: 'المدرّسون',
  Classes: 'الأقسام',
  Apprenants: 'المتعلّمون',
  Présences: 'الحضور',
  Évaluations: 'التقييمات',
  Bulletins: 'كشوف النقاط',
  Barèmes: 'سلالم التنقيط',
  Finances: 'المالية',
  Membres: 'الأعضاء',
  "Journal d'audit": 'سجل التدقيق',
  Organisation: 'المؤسسة',
  'Navigation principale': 'التنقل الرئيسي',
  'Se déconnecter': 'تسجيل الخروج',

  Enregistrer: 'حفظ',
  Annuler: 'إلغاء',
  Fermer: 'إغلاق',
  Ajouter: 'إضافة',
  Retirer: 'إزالة',
  Rechercher: 'بحث',
  Motif: 'السبب',
  Date: 'التاريخ',
  Classe: 'القسم',
  Matière: 'المادة',
  Période: 'الفترة',
  Apprenant: 'المتعلّم',
  Statut: 'الحالة',
  Langue: 'اللغة',
  'Langue de l’interface': 'لغة الواجهة',

  Note: 'نقطة',
  Absent: 'غائب',
  'Absence justifiée': 'غياب مبرَّر',
  Dispensé: 'معفى',
  'Sans objet': 'غير معني',
  'Non saisie': 'غير مسجَّلة',
  Brouillon: 'مسودة',
  Saisie: 'مسجَّلة',
  Vérifiée: 'مدقَّقة',
  Publiée: 'منشورة',
  Corrigée: 'مصحَّحة',
  Invalidée: 'ملغاة',
  Archivée: 'مؤرشفة',

  'Total dû': 'المجموع المستحق',
  Réglé: 'المدفوع',
  Solde: 'الرصيد',
  Échéances: 'الأقساط',
  Impayée: 'غير مدفوعة',
  Partielle: 'جزئية',
  Soldée: 'مسدَّدة',
  Annulée: 'ملغاة',
  Imprimer: 'طباعة',
  'Reçu n°': 'وصل رقم',
  ANNULÉ: 'ملغى',
  Déposer: 'رفع',
};

const DICTIONNAIRES: Record<Locale, Dictionnaire> = { fr: {}, en, es, ar };

/**
 * Traduit une chaîne française.
 *
 * Absente du dictionnaire, elle est rendue telle quelle. C'est un repli
 * délibéré, pas un accident : mieux vaut un écran à moitié français qu'un
 * écran parsemé d'identifiants techniques.
 */
export function traduire(chaine: string, locale: Locale): string {
  return DICTIONNAIRES[locale][chaine] ?? chaine;
}

/** Nombre d'entrées traduites, utile pour mesurer la couverture. */
export function tailleDictionnaire(locale: Locale): number {
  return Object.keys(DICTIONNAIRES[locale]).length;
}
