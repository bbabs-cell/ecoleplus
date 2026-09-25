import Link from 'next/link';
import { GraduationCap, LogOut } from 'lucide-react';
import { brand } from '@/config/brand';
import { exigerOrganisation } from '@/services/permissions';
import { deconnexionAction } from '@/services/auth.actions';
import { nomAffiche, initiales } from '@/lib/format';
import { Navigation, type EntreeNavigation } from '@/components/coque/navigation';
import { SelecteurLangue } from '@/components/i18n/selecteur-langue';
import { localeActive } from '@/i18n/serveur';
import { traduire } from '@/i18n/dictionnaires';
import { SelecteurEtablissement } from '@/components/coque/selecteur-etablissement';
import { Coque } from '@/components/coque/coque';
import { Etiquette } from '@/components/ui/etiquette';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const contexte = await exigerOrganisation();
  const { permissions, reglages, profil, organisation, adhesion } = contexte;

  // Chaque entrée est conditionnée par la permission qui commande réellement la
  // page : un lien affiché sans droit mènerait à un écran vide ou refusé.
  const entrees: EntreeNavigation[] = [
    { href: '/tableau-de-bord', libelle: 'Tableau de bord', icone: 'tableau' },
    ...(permissions.has('establishments.read')
      ? [{ href: '/etablissements', libelle: 'Établissements', icone: 'etablissements' } as const]
      : []),

    // Domaine académique. Chaque entrée n'apparaît qu'avec la permission qui
    // commande réellement la page : un lien sans droit mènerait à un refus.
    ...(permissions.has('academic.read')
      ? [
          { href: '/annees', libelle: 'Années', icone: 'annees', separateur: true } as const,
          { href: '/niveaux', libelle: 'Niveaux', icone: 'niveaux' } as const,
          { href: '/matieres', libelle: 'Matières', icone: 'matieres' } as const,
        ]
      : []),
    ...(permissions.has('teachers.read')
      ? [{ href: '/enseignants', libelle: 'Enseignants', icone: 'enseignants' } as const]
      : []),
    ...(permissions.has('classes.read')
      ? [{ href: '/classes', libelle: 'Classes', icone: 'classes' } as const]
      : []),
    ...(permissions.has('learners.read')
      ? [{ href: '/apprenants', libelle: 'Apprenants', icone: 'apprenants' } as const]
      : []),

    ...(permissions.has('attendance.read')
      ? [{ href: '/presences', libelle: 'Présences', icone: 'presences' } as const]
      : []),

    ...(permissions.has('grades.read')
      ? [
          { href: '/evaluations', libelle: 'Évaluations', icone: 'evaluations' } as const,
          { href: '/baremes', libelle: 'Barèmes', icone: 'baremes' } as const,
        ]
      : []),
    // Les bulletins ont leur propre permission : consulter les notes et
    // consulter un bulletin remis ne sont pas le même droit.
    ...(permissions.has('reports.read')
      ? [{ href: '/bulletins', libelle: 'Bulletins', icone: 'bulletins' } as const]
      : []),

    ...(permissions.has('finance.read')
      ? [{ href: '/finances', libelle: 'Finances', icone: 'finances' } as const]
      : []),

    ...(permissions.has('members.read')
      ? [{ href: '/membres', libelle: 'Membres', icone: 'membres', separateur: true } as const]
      : []),
    ...(permissions.has('audit.read')
      ? [{ href: '/journal', libelle: "Journal d'audit", icone: 'journal' } as const]
      : []),
    ...(permissions.has('organization.read')
      ? [{ href: '/organisation', libelle: 'Organisation', icone: 'organisation' } as const]
      : []),
  ];

  // Les libellés sont traduits ICI, côté serveur : la navigation reçoit du
  // texte prêt à afficher et n'a pas besoin de connaître la langue.
  const locale = await localeActive();
  const entreesTraduites = entrees.map((entree) => ({
    ...entree,
    libelle: traduire(entree.libelle, locale),
  }));

  const nom = nomAffiche(profil, reglages.name_display_format);
  const lettres = initiales(profil, reglages.name_display_format);

  const marque = (
    <Link href="/tableau-de-bord" className="flex min-h-11 items-center gap-2.5 lg:min-h-0">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-douce bg-primaire text-primaire-contraste">
        <GraduationCap className="size-4" aria-hidden="true" />
      </span>
      <span className="truncate text-sm font-semibold tracking-tight text-encre">{brand.name}</span>
    </Link>
  );

  const entete = (
    <>
      <div className="space-y-1">
        <p className="truncate text-sm font-medium text-encre">{organisation.name}</p>
        <Etiquette ton={adhesion.role.code === 'OWNER' ? 'primaire' : 'neutre'}>
          {adhesion.role.label}
        </Etiquette>
      </div>

      <SelecteurEtablissement
        etablissements={contexte.etablissements.map(({ id, name }) => ({ id, name }))}
        actifId={contexte.etablissementActif?.id ?? null}
      />
    </>
  );

  const pied = (
    <>
      <div className="border-t border-bordure pt-3">
        <SelecteurLangue locale={locale} />
      </div>

      <div className="flex items-center gap-2.5 border-t border-bordure pt-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-douce text-xs font-semibold text-accent"
          aria-hidden="true"
        >
          {lettres}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-encre">{nom || 'Sans nom'}</p>
          <p className="truncate text-xs text-encre-douce">{contexte.utilisateur.email}</p>
        </div>
        <form action={deconnexionAction}>
          <button
            type="submit"
            className="flex size-11 items-center justify-center rounded-douce text-encre-douce transition-colors hover:bg-surface-2 hover:text-encre"
            aria-label={traduire('Se déconnecter', locale)}
            title={traduire('Se déconnecter', locale)}
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </>
  );

  return (
    <Coque
      marque={marque}
      entete={entete}
      navigation={
        <Navigation
          entrees={entreesTraduites}
          libelleNavigation={traduire('Navigation principale', locale)}
        />
      }
      pied={pied}
      raccourci={
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-douce text-xs font-semibold text-accent"
          aria-hidden="true"
        >
          {lettres}
        </span>
      }
      libelleOuvrir={traduire('Ouvrir le menu', locale)}
      libelleFermer={traduire('Fermer le menu', locale)}
    >
      {children}
    </Coque>
  );
}
