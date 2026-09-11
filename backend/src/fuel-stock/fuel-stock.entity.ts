import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Mouvement de stock carburant par site (cuve / bidons physiques, retour DG) — EN LITRES.
 *  - initial : saisie manuelle du stock de départ d'une cuve (retour DG Q3 : « on saisit
 *              manuellement au début, puis on suit les mouvements »). Réinitialise le cumul.
 *  - appro   : approvisionnement (date, fournisseur, litres, montant → prix moyen du litre)
 *  - sortie  : litres servis à un véhicule bénéficiaire (interne ou externe), date
 * Le stock du site se décrémente. Une sortie vers un véhicule interne crée aussi un
 * `fuel_entry` (source = stock_site) pour le contrôle de consommation.
 */
@Entity('fuel_stock_ops')
export class FuelStockOp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  siteCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  opType: string | null; // 'initial' | 'appro' | 'sortie'

  @Column({ type: 'varchar', nullable: true })
  date: string | null;

  @Column({ type: 'varchar', nullable: true, default: 'GASOIL' })
  fuelType: string | null;

  @Column({ type: 'double precision', nullable: true })
  liters: number | null;

  // appro
  @Column({ type: 'double precision', nullable: true })
  amount: number | null;

  @Column({ type: 'varchar', nullable: true })
  supplier: string | null;

  // sortie
  @Column({ type: 'varchar', nullable: true })
  targetKind: string | null; // 'vehicle' | 'external'

  @Column({ type: 'varchar', nullable: true })
  targetCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  targetLabel: string | null;

  // prix unitaire (appro : amount/liters ; sortie : PMP du stock au moment de la sortie)
  @Column({ type: 'double precision', nullable: true })
  unitPrice: number | null;

  // Rattachement analytique de la sortie (retour DG : « cette conso doit figurer dans nos
  // reporting » — carburant donné à un véhicule externe imputé à une BU / un centre de coût).
  @Column({ type: 'varchar', nullable: true })
  businessUnit: string | null;

  @Column({ type: 'varchar', nullable: true })
  costCenter: string | null;

  // Sortie « hors cuve » (cas extrême : pas de stock site) → le stock n'est pas décrémenté,
  // la conso est quand même tracée et valorisée au prix carburant courant.
  @Column({ type: 'boolean', nullable: true, default: false })
  offStock: boolean | null;

  @Column({ type: 'varchar', nullable: true })
  linkedFuelEntryId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  createdAt: Date | null;
}
