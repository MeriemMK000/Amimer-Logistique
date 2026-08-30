'use client';

import React from 'react';
import Badge from './Badge';
import {
  VehicleStatus,
  MissionStatus,
  DriverStatus,
  MaintenanceOrderStatus,
  MaintenancePriority,
  IncidentSeverity,
  IncidentStatus,
  AlertPriority,
} from '@/types';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const vehicleStatusMap: Record<VehicleStatus, { label: string; variant: BadgeVariant }> = {
  [VehicleStatus.DISPONIBLE]: { label: 'Disponible', variant: 'success' },
  [VehicleStatus.EN_MISSION]: { label: 'En mission', variant: 'info' },
  [VehicleStatus.EN_MAINTENANCE]: { label: 'En maintenance', variant: 'warning' },
  [VehicleStatus.HORS_SERVICE]: { label: 'Hors service', variant: 'danger' },
  [VehicleStatus.EN_ATTENTE]: { label: 'En attente', variant: 'default' },
};

const missionStatusMap: Record<MissionStatus, { label: string; variant: BadgeVariant }> = {
  [MissionStatus.PLANIFIEE]: { label: 'Planifiee', variant: 'default' },
  [MissionStatus.EN_COURS]: { label: 'En cours', variant: 'info' },
  [MissionStatus.TERMINEE]: { label: 'Terminee', variant: 'success' },
  [MissionStatus.ANNULEE]: { label: 'Annulee', variant: 'danger' },
};

const driverStatusMap: Record<DriverStatus, { label: string; variant: BadgeVariant }> = {
  [DriverStatus.ACTIF]: { label: 'Actif', variant: 'success' },
  [DriverStatus.INACTIF]: { label: 'Inactif', variant: 'default' },
  [DriverStatus.EN_MISSION]: { label: 'En mission', variant: 'info' },
  [DriverStatus.EN_CONGE]: { label: 'En conge', variant: 'warning' },
  [DriverStatus.SUSPENDU]: { label: 'Suspendu', variant: 'danger' },
};

const maintenanceStatusMap: Record<MaintenanceOrderStatus, { label: string; variant: BadgeVariant }> = {
  [MaintenanceOrderStatus.PLANIFIE]: { label: 'Planifie', variant: 'default' },
  [MaintenanceOrderStatus.EN_COURS]: { label: 'En cours', variant: 'info' },
  [MaintenanceOrderStatus.TERMINE]: { label: 'Termine', variant: 'success' },
  [MaintenanceOrderStatus.ANNULE]: { label: 'Annule', variant: 'danger' },
};

const priorityMap: Record<MaintenancePriority, { label: string; variant: BadgeVariant }> = {
  [MaintenancePriority.BASSE]: { label: 'Basse', variant: 'default' },
  [MaintenancePriority.NORMALE]: { label: 'Normale', variant: 'info' },
  [MaintenancePriority.HAUTE]: { label: 'Haute', variant: 'warning' },
  [MaintenancePriority.URGENTE]: { label: 'Urgente', variant: 'danger' },
};

const incidentSeverityMap: Record<IncidentSeverity, { label: string; variant: BadgeVariant }> = {
  [IncidentSeverity.MINEUR]: { label: 'Mineur', variant: 'default' },
  [IncidentSeverity.MODERE]: { label: 'Modere', variant: 'warning' },
  [IncidentSeverity.MAJEUR]: { label: 'Majeur', variant: 'danger' },
  [IncidentSeverity.CRITIQUE]: { label: 'Critique', variant: 'danger' },
};

const incidentStatusMap: Record<IncidentStatus, { label: string; variant: BadgeVariant }> = {
  [IncidentStatus.OUVERT]: { label: 'Ouvert', variant: 'warning' },
  [IncidentStatus.EN_COURS]: { label: 'En cours', variant: 'info' },
  [IncidentStatus.RESOLU]: { label: 'Resolu', variant: 'success' },
  [IncidentStatus.CLOS]: { label: 'Clos', variant: 'default' },
};

const alertPriorityMap: Record<AlertPriority, { label: string; variant: BadgeVariant }> = {
  [AlertPriority.BASSE]: { label: 'Basse', variant: 'info' },
  [AlertPriority.MOYENNE]: { label: 'Moyenne', variant: 'warning' },
  [AlertPriority.HAUTE]: { label: 'Haute', variant: 'danger' },
  [AlertPriority.CRITIQUE]: { label: 'Critique', variant: 'danger' },
};

type StatusType =
  | { type: 'vehicle'; status: VehicleStatus }
  | { type: 'mission'; status: MissionStatus }
  | { type: 'driver'; status: DriverStatus }
  | { type: 'maintenance'; status: MaintenanceOrderStatus }
  | { type: 'priority'; status: MaintenancePriority }
  | { type: 'incidentSeverity'; status: IncidentSeverity }
  | { type: 'incidentStatus'; status: IncidentStatus }
  | { type: 'alertPriority'; status: AlertPriority };

export default function StatusBadge(props: StatusType) {
  let config: { label: string; variant: BadgeVariant };
  switch (props.type) {
    case 'vehicle': config = vehicleStatusMap[props.status]; break;
    case 'mission': config = missionStatusMap[props.status]; break;
    case 'driver': config = driverStatusMap[props.status]; break;
    case 'maintenance': config = maintenanceStatusMap[props.status]; break;
    case 'priority': config = priorityMap[props.status]; break;
    case 'incidentSeverity': config = incidentSeverityMap[props.status]; break;
    case 'incidentStatus': config = incidentStatusMap[props.status]; break;
    case 'alertPriority': config = alertPriorityMap[props.status]; break;
  }
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
