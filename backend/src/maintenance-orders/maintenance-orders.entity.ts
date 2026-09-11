import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('maintenance_orders')
export class MaintenanceOrder {
  @PrimaryColumn({ type: 'varchar' })
  num: string;

  @Column({ type: 'varchar', nullable: true })
  vehicleCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  type: string | null;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'varchar', nullable: true })
  priority: string | null;

  @Column({ type: 'varchar', nullable: true })
  status: string | null;

  @Column({ type: 'int', nullable: true })
  partsCost: number | null;

  @Column({ type: 'int', nullable: true })
  laborCost: number | null;

  @Column({ type: 'int', nullable: true })
  totalCost: number | null;

  @Column({ type: 'varchar', nullable: true })
  date: string | null;

  @Column({ type: 'varchar', nullable: true })
  supplierCode: string | null;

  @Column({ type: 'jsonb', nullable: true })
  operations: any | null;

  // Statuts detailles (Partie 3) : ouvert -> diagnostic -> valide -> en_lancement -> termine (+ annule)
  @Column({ type: 'jsonb', nullable: true })
  statusHistory: { status: string; at: string; note?: string }[] | null;

  // Vehicule loue repare a l'exterieur : en_reparation | lance_repare | reparation_maintenance_cloturee
  @Column({ type: 'varchar', nullable: true })
  leaseRepairStatus: string | null;

  // OT cree suite a une declaration de panne chauffeur
  @Column({ type: 'varchar', nullable: true })
  sourceDeclarationId: string | null;

  // Modele preventif a l'origine de cet OT (echeance -> OT) : evite le doublon dans la liste
  // des echeances tant que l'OT n'est pas termine / annule.
  @Column({ type: 'varchar', nullable: true })
  planId: string | null;

  @Column({ type: 'varchar', nullable: true })
  cmd: string | null; // n° commande

  @Column({ type: 'int', nullable: true })
  breakdownHours: number | null; // heures d'immobilisation liees a cet OT

  @Column({ type: 'varchar', nullable: true })
  declaredBy: string | null; // chauffeur a l'origine d'une declaration de panne (app chauffeur)

  // Validation du detenteur du vehicule (chaque intervention doit etre validee par lui).
  @Column({ type: 'varchar', nullable: true })
  holderNotifiedAt: string | null;

  @Column({ type: 'boolean', nullable: true })
  holderValidated: boolean | null;

  @Column({ type: 'varchar', nullable: true })
  holderValidatedAt: string | null;

  @Column({ type: 'varchar', nullable: true })
  holderValidatedBy: string | null;
}
