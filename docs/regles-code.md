# Règles de code — EcolePlus

1. TypeScript strict, éviter `any` sauf justification explicite en commentaire.
2. Validation des entrées côté client **et** serveur — ne jamais faire confiance aux données du frontend.
3. Server Components par défaut, Client Components seulement si nécessaire (interactivité).
4. Logique métier dans `services/`, jamais uniquement dans les composants.
5. Pas de duplication ; composants réutilisables dans `components/ui/`.
6. Aucun secret dans le code — variables d'environnement uniquement, jamais loggées.
7. Ne pas désactiver une vérification de sécurité pour "faire marcher vite".
8. Ne pas modifier une migration déjà appliquée — créer une nouvelle migration.
9. Messages d'erreur compréhensibles, jamais de fuite d'info technique/sécurité dans les erreurs.
10. Gérer explicitement : chargement / erreur / vide pour chaque vue de données.
11. Pagination sur toute liste potentiellement large ; index PostgreSQL adaptés.
12. Ne pas ajouter de dépendance sans raison claire.
13. Ne jamais déclarer une fonctionnalité terminée si elle est incomplète ou simulée.
