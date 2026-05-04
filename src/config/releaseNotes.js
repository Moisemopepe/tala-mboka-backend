export const releaseNotes = {
  "0.5.9": {
    adminNotes: `Version 0.5.9

Fonctionnel :
- Séparation propre entre modération et niveau de risque.
- Les alertes invitées restent en attente jusqu'à validation admin.
- Les filtres danger/critique fonctionnent avec les vraies données.
- Les catégories Autre et Enlèvement sont acceptées par le backend.
- L'upload d'image fonctionne aussi en local sans Cloudinary.`,
    userNotes: `Version 0.5.9

Amélioration :
- Les alertes et filtres sont plus fiables.
- Les signalements invités sont mieux modérés avant publication.`
  },
  "0.5.8": {
    adminNotes: `Version 0.5.8

Site web :
- Retrait du lien public Autorités et du bloc admin sur la vitrine.
- Retrait du texte "Version web en amélioration continue" dans le footer.

Qualité :
- Correction de plusieurs libellés français dans le site, l'application et l'admin.`,
    userNotes: `Version 0.5.8

Amélioration :
- La page d'accueil est plus simple.
- Plusieurs textes sont mieux corrigés en français.`
  },
  "0.5.7": {
    adminNotes: `Version 0.5.7

Site web :
- Hero public plus court et plus lisible.
- Apercu visuel de l'application avec carte et alertes.
- Exemples d'alertes visibles meme si l'API ne retourne encore aucun signalement.
- Textes et CTA clarifies pour une presentation plus professionnelle.`,
    userNotes: `Version 0.5.7

Nouveauté :
- La page d'accueil est plus claire.
- Les exemples d'alertes rendent la plateforme plus facile a comprendre.`
  },
  "0.5.6": {
    adminNotes: `Version 0.5.6

Architecture :
- Separation claire entre site web public et application citoyenne.
- La page / devient un vrai site de presentation.
- L'application citoyenne passe sous /app.

Navigation :
- Anciens liens rediriges vers les nouveaux chemins.
- Admin conserve son accès dédié.`,
    userNotes: `Version 0.5.6

Nouveauté :
- Tala Mboka a maintenant un vrai site public.
- L'application citoyenne reste disponible dans /app.`
  },
  "0.2.7": {
    adminNotes: `Version 0.2.7

Maintenance:
- Verification globale du code.
- Correction d'une logique de risque obsolete.

Qualite:
- Build frontend et syntaxe backend verifies.`,
    userNotes: `Version 0.2.7

Amelioration:
- Stabilite generale de l'application amelioree.`
  },
  "0.2.6": {
    adminNotes: `Version 0.2.6

Auth:
- Bloc securite retire de l'inscription.

UX:
- Formulaire plus simple et plus direct.`,
    userNotes: `Version 0.2.6

Amelioration:
- Inscription plus legere et plus directe.`
  },
  "0.2.5": {
    adminNotes: `Version 0.2.5

Inscription:
- Validation temps reel ajoutee.
- Confirmation mot de passe ajoutee.
- Erreurs affichees sous les champs.
- Bouton bloque si formulaire invalide.

UX:
- Etats visuels vert/rouge.
- Message donnees securisees ajoute.`,
    userNotes: `Version 0.2.5

Amelioration:
- Inscription plus claire et securisante.
- Confirmation mot de passe ajoutee.`
  },
  "0.2.4": {
    adminNotes: `Version 0.2.4

Auth:
- Icônes internes des inputs retirees.
- Lien mot de passe oublie masque en inscription.
- Champ mot de passe garde seulement le bouton oeil.

UX:
- Formulaire plus propre et lisible.`,
    userNotes: `Version 0.2.4

Amelioration:
- Formulaire connexion/inscription plus propre.
- Mot de passe oublie affiche seulement en connexion.`
  },
  "0.2.3": {
    adminNotes: `Version 0.2.3

Auth:
- Les icones des champs disparaissent pendant la saisie.
- Le texte des inputs reste mieux aligne.

UX:
- Correction visuelle sur telephone et mot de passe.`,
    userNotes: `Version 0.2.3

Amelioration:
- Les champs de connexion sont plus propres pendant la saisie.`
  },
  "0.2.2": {
    adminNotes: `Version 0.2.2

Auth:
- Badge utilisateurs actifs retire.
- Message OTP futur retire.
- Espacement des icones input corrige.

UX:
- Champs telephone et mot de passe plus propres.`,
    userNotes: `Version 0.2.2

Amelioration:
- Page connexion plus propre.
- Champs mieux alignes.`
  },
  "0.2.1": {
    adminNotes: `Version 0.2.1

Auth:
- Header plus compact.
- Cards benefices animees.
- Tabs login/register ameliorees.
- Focus input vert ajoute.

UX:
- Messages confiance et OTP futur ajoutes.`,
    userNotes: `Version 0.2.1

Amelioration:
- Page connexion plus fluide.
- Messages plus rassurants.`
  },
  "0.2.0": {
    adminNotes: `Version 0.2.0

Auth:
- Page login/register modernisee.
- Benefices utilisateurs ajoutes.
- Inputs avec icones.
- Affichage mot de passe ajoute.

UX:
- Loading, succes et erreurs plus clairs.
- Social proof ajoute.`,
    userNotes: `Version 0.2.0

Nouveautes:
- Connexion et inscription plus simples.
- Mot de passe affichable.

Amelioration:
- Page compte plus rassurante.`
  },
  "0.1.9": {
    adminNotes: `Version 0.1.9

Carte:
- Clustering des alertes ajoute.
- Heatmap risque ajoutee.
- Popup riche avec risque et distance.
- Mode Carte / Liste ajoute.

UX:
- Filtres risque, categorie et distance.
- Localisation utilisateur sur la carte.`,
    userNotes: `Version 0.1.9

Nouveautes:
- Carte plus intelligente.
- Zones a risque visibles.
- Alertes proches plus faciles a trouver.`
  },
  "0.1.8": {
    adminNotes: `Version 0.1.8

Fil citoyen:
- Cards plus professionnelles.
- Temps relatif et distance ajoutees.
- Placeholder image ajoute.
- Voir plus pour descriptions longues.

UX:
- Actions partager et voir sur carte.
- Hover et clic plus fluides.`,
    userNotes: `Version 0.1.8

Nouveautes:
- Fil citoyen plus clair.
- Distance, partage et bouton carte ajoutes.

Amelioration:
- Les alertes sont plus faciles a lire.`
  },
  "0.1.7": {
    adminNotes: `Version 0.1.7

Signalement:
- Page de signalement reorganisee en blocs.
- Validation front ajoutee.
- Preview images jusqu'a 3 fichiers.
- Marqueur carte deplacable.

UX:
- Loading anti double-submit.
- Bloc succes avec actions rapides.`,
    userNotes: `Version 0.1.7

Nouveautes:
- Formulaire de signalement plus clair.
- Image preview et position plus facile a choisir.

Amelioration:
- Messages d'erreur et succes plus utiles.`
  },
  "0.1.6": {
    adminNotes: `Version 0.1.6

Profil:
- Page profil plus dynamique.
- Stats utilisateur ajoutees.
- Dernieres alertes visibles.

UX:
- Avatar avec initiale.
- Badge Utilisateur actif.`,
    userNotes: `Version 0.1.6

Nouveautes:
- Profil plus complet.
- Vos stats et dernieres alertes sont visibles.`
  },
  "0.1.5": {
    adminNotes: `Version 0.1.5

UX:
- Ajout de la page Mes alertes.
- Badges de statut plus clairs.
- Empty states uniformes.

Admin:
- Tri par date.
- Refresh automatique toutes les 30s.
- Message clair si session expire.`,
    userNotes: `Version 0.1.5

Nouveautes:
- Page Mes alertes.
- Statuts plus lisibles.

Amelioration:
- Message clair apres envoi d'une alerte.`
  },
  "0.1.4": {
    adminNotes: `Version 0.1.4

UX:
- Le contour bleu du logo n'apparait plus apres un clic souris.
- Le focus reste disponible pour la navigation clavier.`,
    userNotes: `Version 0.1.4

Amelioration:
- Le logo a un comportement visuel plus propre au clic.`
  },
  "0.1.3": {
    adminNotes: `Version 0.1.3

Admin:
- Le logo du header redirige maintenant vers l'accueil.

UX:
- Navigation plus naturelle sur toutes les pages.`,
    userNotes: `Version 0.1.3

Amelioration:
- Cliquer sur le logo ramene maintenant a l'accueil.`
  },
  "0.1.2": {
    adminNotes: `Version 0.1.2

Admin:
- Envoi automatique des notifications de version.
- Notes plus courtes et faciles a lire.

Technique:
- Anti-doublon: une version n'est notifiee qu'une fois.`,
    userNotes: `Version 0.1.2

Nouveautes:
- Notifications de mise a jour plus claires.

Amelioration:
- Texte plus court et plus lisible.`
  },
  "0.1.1": {
    adminNotes: `Version 0.1.1

Admin:
- Notes de version pre-remplies.
- Bouton pour remettre les notes par defaut.`,
    userNotes: `Version 0.1.1

Amelioration:
- Les infos de mise a jour sont plus claires.`
  },
  "0.1.0": {
    adminNotes: `Version 0.1.0

Admin:
- Formulaire vide apres envoi.
- Numerotation de version plus propre.`,
    userNotes: `Version 0.1.0

Amelioration:
- Version de l'application plus lisible.`
  }
};

export function getReleaseNotes(version) {
  return releaseNotes[version] || {
    adminNotes: `Version ${version}

Admin:
- Nouvelle mise a jour disponible.

Action:
- Verifier le changelog avant publication.`,
    userNotes: `Version ${version}

Nouveautes:
- Tala Mboka a ete mis a jour.`
  };
}
