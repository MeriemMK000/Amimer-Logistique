// Enums metier — alignes sur demo-fleetpro-v8 (reference/fleetpro-v8.js)

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
  EN_PANNE = 'EN_PANNE',
  HORS_SERVICE = 'HORS_SERVICE',
}

export enum OwnershipType {
  PROPRE = 'PROPRE',
  LOCATION = 'LOCATION',
}

export enum FuelType {
  GASOIL = 'GASOIL',
  ESSENCE = 'ESSENCE',
  GPL = 'GPL',
}

export enum DriverStatus {
  DISPONIBLE = 'DISPONIBLE',
  EN_MISSION = 'EN_MISSION',
  EN_REPOS = 'EN_REPOS',
  EN_CONGE = 'EN_CONGE',
  INDISPONIBLE = 'INDISPONIBLE',
}

export enum MissionStatus {
  PLANIFIEE = 'PLANIFIEE',
  EN_COURS = 'EN_COURS',
  TERMINEE = 'TERMINEE',
  CLOTUREE = 'CLOTUREE',
  ANNULEE = 'ANNULEE',
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

export enum Priority {
  BASSE = 'BASSE',
  MOYENNE = 'MOYENNE',
  HAUTE = 'HAUTE',
  CRITIQUE = 'CRITIQUE',
}

export enum DpcStatus {
  EN_ATTENTE = 'EN_ATTENTE',
  VALIDEE = 'VALIDEE',
  TRANSFORMEE = 'TRANSFORMEE',
  REFUSEE = 'REFUSEE',
}
