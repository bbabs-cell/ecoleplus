import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, GraduationCap, MailPlus, School, Users, UsersRound } from 'lucide-react';
import { exigerOrganisation } from '@/services/permissions';
import { statistiquesAcademiques, statistiquesSocle } from '@/services/tableau-de-bord';
import { nomAffiche } from '@/lib/format';
import { nomPays } from '@/lib/reference';
import { Carte, CorpsCarte } from '@/components/ui/carte';
import { Alerte } from '@/components/ui/alerte';
import { Etiquette } from '@/components/ui/etiquette';
import { cn } from '@/lib/utils';
import { TitrePage } from '@/components/ui/titre-page';

export const metadata: Metadata = { title: 'Tableau de bord' };

/**
 * Teintes des indicateurs, écrites en toutes lettres : Tailwind ne voit pas
 * les noms de classes construits à l'exécution.
 */
const PASTILLES = {
  socle: 'bg-teinte-socle-douce text-teinte-socle',
  academique: 'bg-teinte-academique-douce text-teinte-academique',
  personnes: 'bg-teinte-personnes-douce text-teinte-personnes',
  admin: 'bg-teinte-admin-douce text-teinte-admin',
} as const;

const LISERES = {
  socle: 'before:bg-teinte-socle',
  academique: 'before:bg-teinte-academique',
  personnes: 'before:bg-teinte-personnes',
  admin: 'before:bg-teinte-admin',
} as const;

function Indicateur({
  libelle,
  valeur,
  Icone,
  href,
  teinte,
}: {
  libelle: string;
  valeur: number;
  Icone: typeof Users;
  href?: string;
  teinte: keyof typeof PASTILLES;
}) {
  const contenu = (
    <Carte
      className={cn(
        'releve relative h-full overflow-hidden',
        // Un liseré de la couleur du domaine, du côté du bord : il rattache
        // le chiffre à l'écran où on ira le consulter.
        'before:absolute before:inset-y-0 before:start-0 before:w-1 before:content-[""]',
        LISERES[teinte],
      )}
    >
      <CorpsCarte className="flex items-center gap-4 ps-6">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-douce',
            PASTILLES[teinte],
          )}
        >
          <Icone className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular-nums text-encre">{valeur}</p>
          <p className="truncate text-sm text-encre-douce">{libelle}</p>
        </div>
      </CorpsCarte>
    </Carte>
  );

  return href ? (
    <Link href={href} className="block focus-visible:outline-none">
      {contenu}
    </Link>
  ) : (
    contenu
  );
}

export default async function PageTableauDeBord() {
  const contexte = await exigerOrganisation();
  const { permissions, reglages, organisation, profil, adhesion } = contexte;

  const stats = await statistiquesSocle(permissions.has('members.invite'));

  // Les chiffres académiques n'ont de sens qu'avec un établissement de travail
  // et la permission de le consulter.
  const academique =
    contexte.etablissementActif && permissions.has('learners.read')
      ? await statistiquesAcademiques(contexte.etablissementActif.id)
      : null;
  const prenom = nomAffiche(profil, reglages.name_display_format).split(' ')[0] ?? '';

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <TitrePage teinte="socle">
          Bonjour{prenom ? ` ${prenom}` : ''}
        </TitrePage>
        <p className="text-sm text-encre-douce">
          {organisation.name} · {nomPays(organisation.country_code, reglages.default_locale)} ·{' '}
          <Etiquette>{adhesion.role.label}</Etiquette>
        </p>
      </header>

      <div className="anim-cascade grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Indicateur
          libelle={stats.etablissements > 1 ? 'Établissements actifs' : 'Établissement actif'}
          valeur={stats.etablissements}
          Icone={Building2}
          teinte="socle"
          href={permissions.has('establishments.read') ? '/etablissements' : undefined}
        />
        <Indicateur
          libelle={stats.membres > 1 ? 'Membres actifs' : 'Membre actif'}
          valeur={stats.membres}
          Icone={Users}
          teinte="admin"
          href={permissions.has('members.read') ? '/membres' : undefined}
        />
        {stats.invitationsEnAttente !== null ? (
          <Indicateur
            libelle="Invitations en attente"
            valeur={stats.invitationsEnAttente}
            Icone={MailPlus}
            teinte="admin"
            href="/membres"
          />
        ) : null}
      </div>

      {academique ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-encre">
            Année en cours
            {academique.anneeNom ? (
              <span className="font-normal text-encre-douce"> · {academique.anneeNom}</span>
            ) : null}
          </h2>

          {academique.anneeNom ? (
            <div className="anim-cascade grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Indicateur
                libelle="Apprenants inscrits"
                valeur={academique.apprenantsActifs}
                Icone={UsersRound}
                teinte="personnes"
                href="/apprenants"
              />
              <Indicateur
                libelle={academique.classes > 1 ? 'Classes ouvertes' : 'Classe ouverte'}
                valeur={academique.classes}
                Icone={School}
                teinte="personnes"
                href={permissions.has('classes.read') ? '/classes' : undefined}
              />
              <Indicateur
                libelle={academique.enseignants > 1 ? 'Enseignants actifs' : 'Enseignant actif'}
                valeur={academique.enseignants}
                Icone={GraduationCap}
                teinte="personnes"
                href={permissions.has('teachers.read') ? '/enseignants' : undefined}
              />
            </div>
          ) : (
            <Alerte ton="info" titre="Aucune année académique en cours">
              Désignez une année courante pour suivre les effectifs.{' '}
              {permissions.has('academic.manage') ? (
                <Link href="/annees" className="font-medium text-primaire">
                  Gérer les années
                </Link>
              ) : null}
            </Alerte>
          )}
        </section>
      ) : null}

      {stats.etablissements === 0 && permissions.has('establishments.create') ? (
        <Alerte ton="info" titre="Commencez par créer un établissement">
          Classes, enseignants et apprenants se rattachent tous à un établissement. C&apos;est la
          première brique à poser.{' '}
          <Link href="/etablissements" className="font-medium text-primaire">
            Créer un établissement
          </Link>
        </Alerte>
      ) : null}

      <Carte>
        <CorpsCarte className="space-y-2">
          <h2 className="text-sm font-semibold text-encre">Ce qui arrive ensuite</h2>
          <p className="text-sm text-encre-douce">
            Le socle et la gestion académique sont en place : organisations, établissements,
            rôles, années, niveaux, matières, enseignants, classes, apprenants et inscriptions.
            La phase suivante apporte les présences et la notation — sessions d&apos;appel,
            évaluations, barèmes configurables et bulletins.
          </p>
        </CorpsCarte>
      </Carte>
    </div>
  );
}
