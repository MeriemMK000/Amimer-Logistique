import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('missions')
export class Mission {
  @PrimaryColumn({ type: 'varchar' })
  num: string;

  @Column({ type: 'varchar', nullable: true })
  driverCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  vehicleCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  fromLoc: string | null;

  @Column({ type: 'varchar', nullable: true })
  toLoc: string | null;

  @Column({ type: 'varchar', nullable: true })
  status: string | null;

  @Column({ type: 'varchar', nullable: true })
  dateStart: string | null;

  @Column({ type: 'varchar', nullable: true })
  timeStart: string | null;

  @Column({ type: 'varchar', nullable: true })
  dateEnd: string | null;

  @Column({ type: 'varchar', nullable: true })
  timeEnd: string | null;

  @Column({ type: 'int', nullable: true })
  distance: number | null;

  @Column({ type: 'int', nullable: true })
  dAller: number | null;

  @Column({ type: 'int', nullable: true })
  dRetour: number | null;

  @Column({ type: 'varchar', nullable: true })
  zone: string | null;

  // Qualification requise (code) — vide = aucune. Partie 1 module Mission.
  @Column({ type: 'varchar', nullable: true })
  requiredQual: string | null;

  // Critere qualite vehicule/chauffeur (delegation officielle, produits sensibles...). Partie 2.
  @Column({ type: 'varchar', nullable: true })
  qualityCriteria: string | null;

  // Frais de mission applicables (auto selon distance vs lieu de travail chauffeur). Partie 1.
  @Column({ type: 'boolean', nullable: true })
  fraisApplicable: boolean | null;

  // Jeton de verification de l'ordre de mission (QR code). Partie 1.
  @Column({ type: 'varchar', nullable: true })
  verifyToken: string | null;

  @Column({ type: 'varchar', nullable: true })
  startedAt: string | null;

  @Column({ type: 'varchar', nullable: true })
  finishedAt: string | null;

  // Ordre de mission émis (retour DG : au démarrage) → transmis au chauffeur sur son app.
  @Column({ type: 'varchar', nullable: true })
  ordreEmisAt: string | null;

  // Coordonnées précises de l'itinéraire (retour DG : adresses, pas seulement des villes).
  // { from:{name,lat,lon}, to:{...}, waypoints:[{name,lat,lon}], waypointsRet:[...] }
  @Column({ type: 'jsonb', nullable: true })
  routeGeo: {
    from?: { name?: string; lat: number; lon: number } | null;
    to?: { name?: string; lat: number; lon: number } | null;
    waypoints?: Array<{ name?: string; lat: number; lon: number }> | null;
    waypointsRet?: Array<{ name?: string; lat: number; lon: number }> | null;
    source?: string;
  } | null;

  // Validation du chauffeur sur son telephone (app chauffeur).
  @Column({ type: 'boolean', nullable: true })
  driverAccepted: boolean | null;

  @Column({ type: 'varchar', nullable: true })
  driverAcceptedAt: string | null;

  // Reference de la demande de prise en charge a l'origine de la mission (Phase 8).
  @Column({ type: 'varchar', nullable: true })
  pecRef: string | null;

  // Mission planifiee issue d'une PEC : doit etre validee par la logistique avant lancement.
  @Column({ type: 'boolean', nullable: true })
  officeValidated: boolean | null;

  @Column({ type: 'varchar', nullable: true })
  officeValidatedAt: string | null;

  @Column({ type: 'int', nullable: true })
  cost: number | null;

  @Column({ type: 'jsonb', nullable: true })
  waypoints: any | null;

  @Column({ type: 'boolean', nullable: true })
  closed: boolean | null;

  @Column({ type: 'varchar', nullable: true })
  bu: string | null;

  @Column({ type: 'varchar', nullable: true })
  ca: string | null;

  // 3e axe analytique (retour DG) : site / chantier de rattachement (ex. Hassi Messaoud).
  @Column({ type: 'varchar', nullable: true })
  site: string | null;

  @Column({ type: 'int', nullable: true })
  frais: number | null;

  @Column({ type: 'boolean', nullable: true })
  fraisConfirmed: boolean | null;

  @Column({ type: 'varchar', nullable: true })
  fraisDateConfirm: string | null;

  @Column({ type: 'jsonb', nullable: true })
  fraisDetail: any | null;

  @Column({ type: 'varchar', nullable: true })
  fraisCat: string | null;

  @Column({ type: 'varchar', nullable: true })
  fraisZone: string | null;

  @Column({ type: 'boolean', nullable: true })
  autoClotured: boolean | null;

  @Column({ type: 'varchar', nullable: true })
  retType: string | null;

  @Column({ type: 'jsonb', nullable: true })
  waypointsRet: any | null;

  // Commentaire libre (report / changement d'itinéraire / justification) — retour DG.
  @Column({ type: 'text', nullable: true })
  comment: string | null;

  // N° de la demande DPC d'origine (transformation DPC → mission).
  @Column({ type: 'varchar', nullable: true })
  dpcRef: string | null;

  // Plusieurs demandes de prise en charge groupées dans une même mission (retour DG) :
  // leurs points de dépose/reprise deviennent des étapes ; les coûts se répartissent par BU/structure.
  @Column({ type: 'jsonb', nullable: true })
  dpcRefs: string[] | null;

  // Répartition frais + cession entre les BU/structures des demandes groupées.
  // [{ dpcCode, bu, structure, pax, segmentKm, roundTrip, sharePct }]
  @Column({ type: 'jsonb', nullable: true })
  costSplit: Array<{ dpcCode: string; bu: string | null; structure: string | null; pax: number; segmentKm: number; roundTrip: boolean; sharePct: number }> | null;

  // Personnes transportées — pic sur le tronçon le plus chargé (regroupement) ou saisi.
  // Contrôlé contre la capacité (places) du véhicule affecté.
  @Column({ type: 'int', nullable: true })
  pax: number | null;

  // Tonnage de fret requis (pic sur le tronçon le plus chargé, ou saisi).
  // Contrôlé contre la charge utile (maxTonnage) du véhicule affecté.
  @Column({ type: 'double precision', nullable: true })
  tonnage: number | null;

  // La fin théorique est dépassée (J+1) → le système propose la clôture.
  @Column({ type: 'boolean', nullable: true, default: false })
  clotureSuggested: boolean | null;
}
