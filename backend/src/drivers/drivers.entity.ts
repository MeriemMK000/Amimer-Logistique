import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('drivers')
export class Driver {
  @PrimaryColumn({ type: 'varchar' })
  code: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', nullable: true })
  license: string | null;

  @Column({ type: 'varchar', nullable: true })
  licenseExpiry: string | null;

  @Column({ type: 'jsonb', nullable: true })
  quals: any | null;

  @Column({ type: 'varchar', nullable: true })
  status: string | null;

  @Column({ type: 'int', nullable: true })
  hoursWeek: number | null;

  @Column({ type: 'int', nullable: true })
  hoursMonth: number | null;

  @Column({ type: 'double precision', nullable: true })
  fatigue: number | null;

  @Column({ type: 'varchar', nullable: true })
  vehicleCode: string | null;

  @Column({ type: 'boolean', nullable: true })
  permanent: boolean | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  // Coût du chauffeur pour la refacturation des heures (missions + heures travaillées sur site).
  // Retour DG : « c'est ce coût qu'on utilisera pour facturer les heures chauffeurs ».
  //  - `dailyCost` (journée 8 h) prioritaire s'il est renseigné ; sinon `hourlyCost × 8`.
  @Column({ type: 'int', nullable: true })
  hourlyCost: number | null;

  @Column({ type: 'double precision', nullable: true })
  dailyCost: number | null;

  @Column({ type: 'jsonb', nullable: true })
  plan: any | null;

  // Partie 2 : apte a partir en mission (certains chauffeurs ne partent jamais).
  @Column({ type: 'boolean', nullable: true, default: true })
  apteMission: boolean | null;

  // Retour DG : distinguer un CHAUFFEUR (conduit des véhicules en mission) d'un UTILISATEUR
  // (a une voiture de service, ne part pas en mission — directeur, cadre…).
  //   'chauffeur' (défaut) | 'utilisateur'
  @Column({ type: 'varchar', nullable: true, default: 'chauffeur' })
  personType: string | null;

  // Chauffeur dedie a une business unit (code du referentiel business_units, ex : "MOB") — sinon null.
  @Column({ type: 'varchar', nullable: true })
  dedicatedTo: string | null;

  // Centre de cout de rattachement (code d'un `ca` de la BU ci-dessus, ex : "MOB-PER") — pour la refacturation.
  @Column({ type: 'varchar', nullable: true })
  dedicatedCa: string | null;

  // Lieu de travail (base) — sert au calcul frais de mission selon distance (Partie 1).
  @Column({ type: 'varchar', nullable: true })
  workLocation: string | null;

  @Column({ type: 'int', nullable: true, default: 48 })
  maxWeeklyHours: number | null;

  // Disponibilite hebdo horaire : [{day:0-6, from:'HH:MM', to:'HH:MM'}] plages OUVERTES.
  @Column({ type: 'jsonb', nullable: true })
  availability: { day: number; from: string; to: string }[] | null;

  // Adresse reelle du domicile (retour DG) + distance domicile <-> lieu de travail (km).
  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({ type: 'double precision', nullable: true })
  workDistanceKm: number | null;

  // Note d'evaluation ScaleUp saisie manuellement (en attendant l'acces a la plateforme).
  @Column({ type: 'double precision', nullable: true })
  scaleUpScore: number | null;
}
