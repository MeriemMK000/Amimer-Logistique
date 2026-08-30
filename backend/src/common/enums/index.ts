export enum UserRole {
  ADMIN = 'ADMIN',
  GESTIONNAIRE_FLOTTE = 'GESTIONNAIRE_FLOTTE',
  DISPATCHEUR = 'DISPATCHEUR',
  CHAUFFEUR = 'CHAUFFEUR',
  COMPTABLE = 'COMPTABLE',
}

export enum VehicleType {
  LEGER = 'LEGER',
  LOURD = 'LOURD',
  ENGIN = 'ENGIN',
  REMORQUE = 'REMORQUE',
}

export enum VehicleStatus {
  DISPONIBLE = 'DISPONIBLE',
  EN_MISSION = 'EN_MISSION',
  EN_MAINTENANCE = 'EN_MAINTENANCE',
  HORS_SERVICE = 'HORS_SERVICE',
}

export enum OwnershipType {
  PROPRE = 'PROPRE',
  LOCATION = 'LOCATION',
}

export enum FuelType {
  ESSENCE = 'ESSENCE',
  GASOIL = 'GASOIL',
  GPL = 'GPL',
}

export enum DocumentType {
  CARTE_GRISE = 'CARTE_GRISE',
  CONTROLE_TECHNIQUE = 'CONTROLE_TECHNIQUE',
  ASSURANCE = 'ASSURANCE',
  PERMIS = 'PERMIS',
  AUTRE = 'AUTRE',
}

export enum MaintenanceType {
  PERIODIQUE = 'PERIODIQUE',
  CURATIVE = 'CURATIVE',
}

export enum MaintenanceStatus {
  PLANIFIE = 'PLANIFIE',
  EN_COURS = 'EN_COURS',
  TERMINE = 'TERMINE',
  ANNULE = 'ANNULE',
}

export enum IncidentType {
  INCIDENT = 'INCIDENT',
  ACCIDENT = 'ACCIDENT',
}

export enum IncidentSeverity {
  MINEUR = 'MINEUR',
  MOYEN = 'MOYEN',
  GRAVE = 'GRAVE',
}

export enum IncidentStatus {
  OUVERT = 'OUVERT',
  EN_COURS = 'EN_COURS',
  RESOLU = 'RESOLU',
  CLOS = 'CLOS',
}

export enum MissionStatus {
  PLANIFIEE = 'PLANIFIEE',
  EN_COURS = 'EN_COURS',
  MODIFIEE = 'MODIFIEE',
  TERMINEE = 'TERMINEE',
  ANNULEE = 'ANNULEE',
}

export enum DriverStatus {
  DISPONIBLE = 'DISPONIBLE',
  EN_MISSION = 'EN_MISSION',
  EN_REPOS = 'EN_REPOS',
  INDISPONIBLE = 'INDISPONIBLE',
}

export enum ExpenseStatus {
  CALCULE = 'CALCULE',
  VALIDE = 'VALIDE',
  PAYE = 'PAYE',
}

export enum AlertType {
  DOCUMENT_EXPIRY = 'DOCUMENT_EXPIRY',
  MAINTENANCE_DUE = 'MAINTENANCE_DUE',
  LEASE_EXPIRY = 'LEASE_EXPIRY',
  FUEL_ANOMALY = 'FUEL_ANOMALY',
  DRIVER_HOURS = 'DRIVER_HOURS',
}

export enum AlertPriority {
  BASSE = 'BASSE',
  MOYENNE = 'MOYENNE',
  HAUTE = 'HAUTE',
  CRITIQUE = 'CRITIQUE',
}
