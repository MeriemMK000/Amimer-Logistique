import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('vehicle_assignments')
export class VehicleAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  vehicleCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  driverCode: string | null;

  @Column({ type: 'boolean', nullable: true })
  withDriver: boolean | null;

  @Column({ type: 'varchar', nullable: true })
  kind: string | null;

  @Column({ type: 'varchar', nullable: true })
  dateStart: string | null;

  @Column({ type: 'varchar', nullable: true })
  dateEnd: string | null;

  @Column({ type: 'varchar', nullable: true })
  siteCode: string | null;

  // Code BU du referentiel business_units (ex : "COM"). Sert a la refacturation.
  @Column({ type: 'varchar', nullable: true })
  businessUnit: string | null;

  // Code centre de cout (un `ca` de la BU ci-dessus, ex : "COM-VEN").
  @Column({ type: 'varchar', nullable: true })
  costCenter: string | null;

  // Retour DG « logique affectation site » : nature du centre analytique auquel se rattache
  // toute utilisation / consommation de ce véhicule.
  //   'site'   → le centre analytique EST le chantier `siteCode` (marqueur qui pilote la
  //              proposition des véhicules lors d'une sortie de cuve du site).
  //   'person' → voiture de service rattachée à `assigneeName` / `structure`.
  //   'bu'     → rattachement direct à une business unit / un centre de coût.
  // null → déduit à la création (siteCode ⇒ 'site', assigneeName ⇒ 'person', sinon 'bu').
  @Column({ type: 'varchar', nullable: true })
  costCenterKind: string | null;

  // Objet de l'affectation (imprimé sur l'ordre de mission). Défaut : mise à disposition chantier.
  @Column({ type: 'varchar', nullable: true })
  purpose: string | null;

  // Ordre de mission de l'affectation (retour DG : « affectation site = ordre de mission comme
  // les autres »). Jeton de vérification du QR + date d'émission.
  @Column({ type: 'varchar', nullable: true })
  verifyToken: string | null;

  @Column({ type: 'varchar', nullable: true })
  ordreEmisAt: string | null;

  @Column({ type: 'double precision', nullable: true })
  vehicleMonthlyCost: number | null;

  // Affectation permanente d'une voiture a une personne / structure (retour DG).
  @Column({ type: 'varchar', nullable: true })
  assigneeName: string | null;

  @Column({ type: 'varchar', nullable: true })
  structure: string | null;

  // Trajet quotidien domicile (km / jour) — alimente le suivi conso de la voiture affectee.
  @Column({ type: 'double precision', nullable: true })
  dailyHomeKm: number | null;

  // Carte carburant liee + plafond mensuel (DA) propre a cette voiture.
  @Column({ type: 'varchar', nullable: true })
  fuelCardNumber: string | null;

  @Column({ type: 'double precision', nullable: true })
  monthlyFuelCap: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  // Retour DG : méthode de contrôle carburant de ce véhicule sur son affectation.
  //   'mission'       → comparé aux km RÉELS des missions (véhicules missionnaires)
  //   'km_difference' → comparé au km début → km fin de mois (sites / direction / commerciaux)
  //   'hours'         → comparé aux heures de fonctionnement (engins)
  // null → déduit de l'affectation (engin=hours, personne/site=km_difference, sinon mission).
  @Column({ type: 'varchar', nullable: true })
  controlType: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  createdAt: Date | null;
}
