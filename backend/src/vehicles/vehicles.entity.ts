import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('vehicles')
export class Vehicle {
  @PrimaryColumn({ type: 'varchar' })
  code: string;

  @Column({ type: 'varchar', nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  @Column({ type: 'varchar', nullable: true })
  type: string | null;

  @Column({ type: 'varchar', nullable: true })
  plate: string | null;

  @Column({ type: 'varchar', nullable: true })
  status: string | null;

  @Column({ type: 'varchar', nullable: true })
  fuel: string | null;

  @Column({ type: 'varchar', nullable: true })
  ownership: string | null;

  @Column({ type: 'int', nullable: true })
  km: number | null;

  // Base kilometrique de reference + date (Partie 1 : km cumule = base + realise depuis).
  @Column({ type: 'int', nullable: true })
  kmBase: number | null;

  @Column({ type: 'varchar', nullable: true })
  kmBaseDate: string | null;

  // Trajet domicile quotidien (aller-retour), ajoute aux km mission (Partie 3).
  @Column({ type: 'int', nullable: true })
  dailyHomeKm: number | null;

  @Column({ type: 'int', nullable: true })
  tankLiters: number | null;

  @Column({ type: 'varchar', nullable: true })
  leaseStart: string | null;

  @Column({ type: 'varchar', nullable: true })
  leaseEnd: string | null;

  @Column({ type: 'int', nullable: true })
  leaseAlertDays: number | null;

  // Coût mensuel du véhicule LOUÉ (loyer), quand il n'y a pas de contrat de location détaillé.
  @Column({ type: 'int', nullable: true })
  leaseCost: number | null;

  // Coût de possession mensuel d'un véhicule PROPRE (retour DG : « on n'a pas défini le coût
  // du véhicule propre pour la refacturation »). = amortissement + assurance + vignette +
  // provision entretien. Dérive un coût/jour (÷ jours ouvrés) et /heure (÷ 8) pour les missions.
  @Column({ type: 'double precision', nullable: true })
  ownedMonthlyCost: number | null;

  // Coût quotidien (journée 8 h) d'un véhicule PROPRE (retour DG : « comme le loué a un coût
  // de location, le propre doit avoir un coût quotidien pour 8 h »). Saisie PRIORITAIRE sur
  // le mensuel : si renseigné, coût/mois = coût/jour × jours ouvrés, coût/heure = ÷ 8.
  @Column({ type: 'double precision', nullable: true })
  ownedDailyCost: number | null;

  @Column({ type: 'double precision', nullable: true })
  normOff: number | null;

  @Column({ type: 'double precision', nullable: true })
  normCorr: number | null;

  @Column({ type: 'double precision', nullable: true })
  normOffH: number | null;

  @Column({ type: 'double precision', nullable: true })
  normCorrH: number | null;

  // Retour DG : % de correction de la norme constructeur, saisi par véhicule.
  // normCorr(H) = normOff(H) × (1 + normCorrectionPct / 100). Défaut 5 %.
  @Column({ type: 'double precision', nullable: true, default: 5 })
  normCorrectionPct: number | null;

  @Column({ type: 'varchar', nullable: true })
  ctDate: string | null;

  // Échéance du contrôle technique (prochaine visite obligatoire) — sert aux alertes.
  @Column({ type: 'varchar', nullable: true })
  ctExpiry: string | null;

  @Column({ type: 'varchar', nullable: true })
  ctStatus: string | null;

  @Column({ type: 'varchar', nullable: true })
  insDate: string | null;

  @Column({ type: 'varchar', nullable: true })
  insPolicy: string | null;

  @Column({ type: 'varchar', nullable: true })
  insStatus: string | null;

  @Column({ type: 'varchar', nullable: true })
  greyCard: string | null;

  @Column({ type: 'varchar', nullable: true })
  vignette: string | null;

  @Column({ type: 'varchar', nullable: true })
  driverCode: string | null;

  @Column({ type: 'int', nullable: true })
  breakdownHours: number | null;

  @Column({ type: 'int', nullable: true })
  hourMeter: number | null;

  @Column({ type: 'int', nullable: true })
  hourlyCost: number | null;

  @Column({ type: 'jsonb', nullable: true })
  equipment: any | null;

  // Vehicule commercial (roule sans ordre de mission) : le systeme reclame un releve mensuel.
  @Column({ type: 'boolean', nullable: true })
  isCommercial: boolean | null;

  // Marge de cession individuelle (%) — prioritaire sur la marge par type / globale (Facturation BU).
  @Column({ type: 'double precision', nullable: true })
  margePct: number | null;

  // ── Champs issus des registres réels Amimer Énergie (fichiers parc / affectation) ──
  // Genre métier (plus fin que `type`) : VIP | CTTE | CAM | TR | ENGIN | REMORQUE.
  @Column({ type: 'varchar', nullable: true })
  genre: string | null;

  // Bailleur quand ownership = LOCATION (SOVAC, EURL SAADNA…).
  @Column({ type: 'varchar', nullable: true })
  lessor: string | null;

  // Année de mise en circulation.
  @Column({ type: 'int', nullable: true })
  serviceYear: number | null;

  // Puissance fiscale (CV).
  @Column({ type: 'int', nullable: true })
  fiscalPower: number | null;

  // N° de châssis (VIN).
  @Column({ type: 'varchar', nullable: true })
  chassis: string | null;

  // Site / localisation de rattachement du parc (Seddouk, Blida, El Goléa, Gassi Touil…).
  @Column({ type: 'varchar', nullable: true })
  siteBase: string | null;

  // Nombre de places (personnes transportables) — surtout véhicules légers / VIP / minibus.
  // Sert au contrôle de capacité lors de l'affectation d'une mission.
  @Column({ type: 'int', nullable: true })
  seats: number | null;

  // Nombre de pneus du véhicule (varie : 4, 6, 10, 12… selon le camion) — saisi en fiche.
  @Column({ type: 'int', nullable: true })
  tireCount: number | null;

  // Charge utile maximale en tonnes (camions / lourds) — contrôle « tonnage nécessaire » des missions.
  @Column({ type: 'double precision', nullable: true })
  maxTonnage: number | null;

  // Prise en charge de la panne : 'non_pris_en_charge' | 'pris_en_charge' | 'en_reparation'.
  @Column({ type: 'varchar', nullable: true })
  breakdownStatus: string | null;

  // Date prévisionnelle de remise en marche (véhicule en panne).
  @Column({ type: 'varchar', nullable: true })
  repairEta: string | null;
}
