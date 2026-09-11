'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';
import { api, createOne, getAll, getConfig, getKmBreakdown, putConfig, removeOne, updateOne, type KmBreakdown } from './client';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type {
  Alert, BusinessUnit, Driver, DpcRequest, EngineFuelEntry, FuelEntry, LeaseContract,
  LeasePointage, MaintenanceOrder, Mission, PurchaseOrder, Supplier, Vehicle,
} from '../types';

export function useCollection<T>(resource: string) {
  return useQuery({ queryKey: [resource], queryFn: () => getAll<T>(resource) });
}

/**
 * Retour DG « la mise à jour des données n'est pas instantanée » : une écriture sur une
 * ressource impacte souvent des vues calculées dans d'autres modules (km, carburant,
 * facturation site, propositions…). On invalide donc aussi ces clés dérivées.
 */
const CASCADE: Record<string, string[]> = {
  vehicles: ['km', 'km-all', 'fuel-control-month', 'fuel-bilan', 'site-billing', 'site-fuel-summary'],
  drivers: ['missions'],
  missions: ['km', 'km-all', 'fuel-control-month', 'notifications', 'alerts', 'site-fuel-summary'],
  'vehicle-assignments': ['fuel-control-month', 'fuel-bilan', 'site-billing', 'site-fuel-summary', 'vehicles', 'fuel-stock-balance'],
  'fuel-entries': ['fuel-control-month', 'fuel-bilan', 'fuel-card-summary', 'fuel-stock-balance', 'site-fuel-summary'],
  'engine-fuel-entries': ['fuel-control-month', 'fuel-bilan', 'site-fuel-summary'],
  'lease-contracts': ['lease-pointage', 'site-billing'],
  'maintenance-orders': ['vehicles', 'alerts', 'purchase-orders', 'maintenance-due', 'maintenance-kpis'],
  'site-pointage': ['site-billing', 'site-external-control', 'fuel-control-month', 'fuel-bilan', 'site-fuel-summary'],
  'external-invoices': ['site-external-control'],
  'external-vehicles': ['site-external-control', 'site-billing'],
};
function invalidateWithCascade(qc: ReturnType<typeof useQueryClient>, resource: string) {
  qc.invalidateQueries({ queryKey: [resource] });
  for (const k of CASCADE[resource] ?? []) qc.invalidateQueries({ queryKey: [k] });
}

export function useCreate<T>(resource: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<T>) => createOne<T>(resource, body),
    onSuccess: () => invalidateWithCascade(qc, resource),
  });
}
export function useUpdate<T>(resource: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<T> }) => updateOne<T>(resource, id, body),
    onSuccess: () => invalidateWithCascade(qc, resource),
  });
}
export function useRemove(resource: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeOne(resource, id),
    onSuccess: () => invalidateWithCascade(qc, resource),
  });
}

/**
 * Suppression avec confirmation obligatoire (regle DG) + gestion de l'erreur 409
 * (element lie a d'autres enregistrements → non supprimable).
 * Retourne `(id, name?) => Promise<void>`.
 */
export function useConfirmedRemove(resource: string, label = 'cet element') {
  const qc = useQueryClient();
  const confirm = useConfirm();
  return async (id: string, name?: string) => {
    const ok = await confirm({
      title: 'Confirmer la suppression',
      message: `Supprimer definitivement ${name ? `« ${name} »` : label} ? Cette action est irreversible.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await removeOne(resource, id);
      invalidateWithCascade(qc, resource);
      toast.success('Element supprime');
    } catch (e) {
      const msg = (e as AxiosError<{ message?: string }>)?.response?.data?.message;
      toast.error(msg || 'Suppression impossible');
    }
  };
}

export const useVehicles = () => useCollection<Vehicle>('vehicles');
export const useDrivers = () => useCollection<Driver>('drivers');
export const useMissions = () => useCollection<Mission>('missions');
export const useMaintenanceOrders = () => useCollection<MaintenanceOrder>('maintenance-orders');
export const useSuppliers = () => useCollection<Supplier>('suppliers');
export const usePurchaseOrders = () => useCollection<PurchaseOrder>('purchase-orders');
export const useFuelEntries = () => useCollection<FuelEntry>('fuel-entries');
export const useEngineFuelEntries = () => useCollection<EngineFuelEntry>('engine-fuel-entries');
export const useDpcRequests = () => useCollection<DpcRequest>('dpc-requests');
export const useLeaseContracts = () => useCollection<LeaseContract>('lease-contracts');
export const useLeasePointage = () => useCollection<LeasePointage>('lease-pointage');
export const useAlerts = () => useCollection<Alert>('alerts');
export const useBusinessUnits = () => useCollection<BusinessUnit>('business-units');

export function useConfig<T = unknown>(key: string) {
  return useQuery({ queryKey: ['config', key], queryFn: () => getConfig<T>(key) });
}
export function useSaveConfig(key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: unknown) => putConfig(key, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config', key] }),
  });
}

// ─── Km / relevés (Phase 1) ───

export function useKmBreakdown(vehicleCode: string | null | undefined) {
  return useQuery({
    queryKey: ['km', vehicleCode],
    queryFn: () => getKmBreakdown(vehicleCode as string),
    enabled: !!vehicleCode,
    // calcul lourd (agrège missions + relevés) : on garde 20 s ; invalidé par CASCADE sur écriture.
    staleTime: 20_000,
  });
}
export function useAllKmBreakdowns(codes: string[]) {
  return useQuery({
    queryKey: ['km-all', codes.join(',')],
    queryFn: async () => {
      const entries = await Promise.all(
        codes.map(async (c) => [c, await getKmBreakdown(c)] as const),
      );
      return Object.fromEntries(entries) as Record<string, KmBreakdown>;
    },
    enabled: codes.length > 0,
    staleTime: 20_000,
  });
}
export function useCreateKmReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { vehicleCode: string; date: string; km: number; note?: string; source?: string }) =>
      api.post('/km-readings', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['km'] });
      qc.invalidateQueries({ queryKey: ['km-all'] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

// ─── Phase 2 : maintenance avancée ───
export function useMaintenancePlans() { return useQuery({ queryKey: ['maintenance-plans'], queryFn: () => getAll('maintenance-plans') }); }
export function useMaintenanceDue() { return useQuery({ queryKey: ['maintenance-due'], queryFn: () => api.get('/maintenance-plans/due').then((r) => r.data as any[]) }); }
export function useMaintenanceKpis(from?: string, to?: string) {
  return useQuery({
    queryKey: ['maintenance-kpis', from, to],
    queryFn: () => api.get('/maintenance-orders/kpis', { params: { from, to } }).then((r) => r.data),
  });
}
export function useMaintenanceFlags() { return useQuery({ queryKey: ['maintenance-flags'], queryFn: () => api.get('/maintenance-orders/flags').then((r) => r.data as any[]) }); }
export function useTires() { return useQuery({ queryKey: ['tires'], queryFn: () => getAll('tires') }); }
export function useTireInventory() { return useQuery({ queryKey: ['tire-inventory'], queryFn: () => api.get('/tires/inventory').then((r) => r.data) }); }
export function useTireMovements(tireId?: string) {
  return useQuery({ queryKey: ['tire-movements', tireId], queryFn: () => api.get('/tires/movements', { params: { tireId } }).then((r) => r.data as any[]) });
}
export function useOtStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ num, status, note }: { num: string; status: string; note?: string }) =>
      api.patch(`/maintenance-orders/${num}/status`, { status, note }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['maintenance-orders'] });
      qc.invalidateQueries({ queryKey: ['maintenance-due'] });   // OT terminé → l'échéance revient
      qc.invalidateQueries({ queryKey: ['maintenance-kpis'] });
    },
  });
}
export function useMoveTire() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.post(`/tires/${id}/move`, body).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tires'] }); qc.invalidateQueries({ queryKey: ['tire-inventory'] }); qc.invalidateQueries({ queryKey: ['tire-movements'] }); },
  });
}
export function useCreateTire() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/tires', body).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tires'] }); qc.invalidateQueries({ queryKey: ['tire-inventory'] }); },
  });
}
/** Montage groupé des pneus à la mise en service d'un véhicule. */
export function useMountTireSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { vehicleCode: string; tires: { position: string; reference: string; serialNumber?: string; brand?: string; dimensions?: string }[] }) =>
      api.post('/tires/mount-set', body).then((r) => r.data as { mounted: number }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tires'] }); qc.invalidateQueries({ queryKey: ['tire-inventory'] }); },
  });
}

// ─── Phase 3 : chauffeurs ───
export function useQualifications() { return useQuery({ queryKey: ['qualifications'], queryFn: () => getAll('qualifications') }); }
export function useEvaluations() { return useQuery({ queryKey: ['evaluations'], queryFn: () => getAll('evaluations') }); }

// ─── Phase 4 : missions / proposition ───
export function useProposal() {
  return useMutation({ mutationFn: (crit: Record<string, unknown>) => api.post('/proposals', crit).then((r) => r.data) });
}
export async function getMissionOrdre(num: string) {
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const { data } = await api.get(`/missions/${num}/ordre`, { params: { base } });
  return data as any;
}
/** Ordre de mission d'une affectation site (retour DG : « affectation site = ordre de mission »). */
export async function getAssignmentOrdre(id: string) {
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const { data } = await api.get(`/vehicle-assignments/${id}/ordre`, { params: { base } });
  return data as any;
}

// ─── Phase 5 : GPS ───
export function useGpsPositions(includePlanned = false) {
  return useQuery({
    queryKey: ['gps-positions', includePlanned],
    queryFn: () => api.get('/gps/positions', { params: { includePlanned } }).then((r) => r.data as any[]),
    refetchInterval: 60_000,
  });
}
export function useNearestVehicle() {
  return useMutation({ mutationFn: (body: { location: string; limit?: number }) => api.post('/gps/nearest', body).then((r) => r.data as any[]) });
}

// ─── Phase 6 : Sites / Engins / Cartes carburant / Affectations / Commerciaux ───
export function useVehicleAssignments() { return useCollection<import('../types').VehicleAssignment>('vehicle-assignments'); }
export function useExternalVehicles() { return useCollection<any>('external-vehicles'); }
export function useExternalInvoices() { return useCollection<any>('external-invoices'); }
export function useSitePointage() { return useCollection<any>('site-pointage'); }
export function useSiteExternalControl(site?: string, month?: string) {
  return useQuery({
    queryKey: ['site-external-control', site, month],
    queryFn: () => api.get('/site-pointage/external-control', { params: { site, month } }).then((r) => r.data as any[]),
  });
}
export function useFuelCards() { return useCollection<any>('fuel-cards'); }
export function useFuelCardMovements() { return useCollection<any>('fuel-card-movements'); }
export function useCommercialReports() { return useCollection<any>('commercial-reports'); }

export function useSiteBilling(site?: string, month?: string) {
  return useQuery({
    queryKey: ['site-billing', site, month],
    queryFn: () => api.get('/site-pointage/billing', { params: { site, month } }).then((r) => r.data as any[]),
  });
}
export function useFuelCardSummary(month?: string) {
  return useQuery({
    queryKey: ['fuel-card-summary', month],
    queryFn: () => api.get('/fuel-cards/summary', { params: { month } }).then((r) => r.data as any[]),
  });
}
export function useCommercialPending(month?: string) {
  return useQuery({
    queryKey: ['commercial-pending', month],
    queryFn: () => api.get('/commercial-reports/pending', { params: { month } }).then((r) => r.data as any[]),
  });
}
export function useImportSitePointage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) => api.post('/site-pointage/import', { csv }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['site-pointage'] }); qc.invalidateQueries({ queryKey: ['site-billing'] }); },
  });
}
/** Simulation d'équilibre flotte / chauffeurs sur N jours (retour DG). */
export function useFleetBalance(days = 14) {
  return useQuery({
    queryKey: ['fleet-balance', days],
    queryFn: () => api.get('/scheduler/fleet-balance', { params: { days } }).then((r) => r.data as {
      horizonDays: number; driversAvailable: number;
      timeline: { date: string; driversAvailable: number; vehiclesAvailable: number; byType: Record<string, number>; surplusDrivers: number; state: string }[];
      outages: { vehicleCode: string; type: string | null; from: string; to: string; reason: string }[];
      summary: { firstSureffectifDay: string | null; firstSouseffectifDay: string | null; maxSurplus: number; maxDeficit: number };
    }),
  });
}

/** Saisie rapide grille pointage site (site × engin × jour) — même principe que le pointage location. */
export function useUpsertSitePointage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: {
      siteCode: string; targetCode: string; date: string; fraction: number;
      immobilized?: boolean; targetType?: string; dayPrice?: number; businessUnit?: string; ca?: string;
      fuelLiters?: number | null; kmStart?: number | null; kmEnd?: number | null;
      hoursStart?: number | null; hoursEnd?: number | null;
    }[]) => api.post('/site-pointage/upsert-many', rows).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-pointage'] }); qc.invalidateQueries({ queryKey: ['site-billing'] });
      qc.invalidateQueries({ queryKey: ['fuel-entries'] }); qc.invalidateQueries({ queryKey: ['fuel-control-month'] });
      qc.invalidateQueries({ queryKey: ['fuel-bilan'] });
    },
  });
}
// ─── Retour DG : stock carburant site + contrôle mensuel km ───
export function useFuelStockOps(site?: string) {
  return useQuery({ queryKey: ['fuel-stock', site], queryFn: () => api.get('/fuel-stock', { params: { site } }).then((r) => r.data as any[]) });
}
export function useFuelStockBalance(site?: string, month?: string) {
  return useQuery({ queryKey: ['fuel-stock-balance', site, month], queryFn: () => api.get('/fuel-stock/balance', { params: { site, month } }).then((r) => r.data as any[]) });
}
export function useCreateFuelStockOp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/fuel-stock', body).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fuel-stock'] }); qc.invalidateQueries({ queryKey: ['fuel-stock-balance'] }); qc.invalidateQueries({ queryKey: ['fuel-entries'] }); qc.invalidateQueries({ queryKey: ['fuel-control-month'] }); qc.invalidateQueries({ queryKey: ['fuel-bilan'] }); },
  });
}
export function useRemoveFuelStockOp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/fuel-stock/${id}`).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fuel-stock'] }); qc.invalidateQueries({ queryKey: ['fuel-stock-balance'] }); qc.invalidateQueries({ queryKey: ['fuel-entries'] }); },
  });
}
export function useFuelControlMonth(month: string) {
  return useQuery({ queryKey: ['fuel-control-month', month], queryFn: () => api.get(`/fuel-control/month/${month}`).then((r) => r.data as any[]), enabled: !!month });
}
/** Retour DG : suivi de conformité des 2 relevés (début / fin de mois) par véhicule. */
export function useReleveSuivi(month: string) {
  return useQuery({ queryKey: ['releve-suivi', month], queryFn: () => api.get(`/fuel-control/releve-suivi/${month}`).then((r) => r.data as any), enabled: !!month });
}
export function useFuelBilan(month: string, site?: string) {
  return useQuery({ queryKey: ['fuel-bilan', month, site], queryFn: () => api.get(`/fuel-control/bilan/${month}`, { params: { site } }).then((r) => r.data), enabled: !!month });
}
/** Retour DG « pour les sites » : consommation cumulée (missions + vie sur site) des véhicules / engins d'un chantier. */
export function useSiteFuelSummary(site?: string, month?: string) {
  return useQuery({
    queryKey: ['site-fuel-summary', site, month],
    queryFn: () => api.get('/fuel-control/site-summary', { params: { site, month } }).then((r) => r.data as any),
    enabled: !!site && !!month,
  });
}
export function useMonthlyKmReadings(month?: string) {
  return useQuery({ queryKey: ['monthly-km', month], queryFn: () => api.get('/fuel-control/readings', { params: { month } }).then((r) => r.data as any[]) });
}
export function useUpsertMonthlyKm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { vehicleCode: string; month: string; kmStart?: number | null; kmEnd?: number | null; hoursStart?: number | null; hoursEnd?: number | null; tankStart?: number | null; tankEnd?: number | null }) =>
      api.post('/fuel-control/readings', body).then((r) => r.data),
    // Retour DG : le relevé de clôture alimente le compteur → conso, km hors mission ET maintenance.
    onSuccess: () => {
      ['fuel-control-month', 'releve-suivi', 'monthly-km', 'fuel-bilan', 'alerts', 'km', 'km-all', 'vehicles', 'maintenance-due', 'maintenance-plans']
        .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });
}

// ─── Bons d'achat carburant régie (retour DG : pré-autorisation + QR) ───
export function useRegiePurchases() { return useCollection<any>('regie-purchases'); }
export function useCreateRegiePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/regie-purchases', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regie-purchases'] }),
  });
}
export function useConsumeRegiePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { actualLiters?: number; actualAmount?: number; actualDate?: string; station?: string } }) =>
      api.patch(`/regie-purchases/${id}/consume`, body).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['regie-purchases'] }); qc.invalidateQueries({ queryKey: ['fuel-entries'] }); qc.invalidateQueries({ queryKey: ['fuel-control-month'] }); },
  });
}
export function useRemoveRegiePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/regie-purchases/${id}`).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['regie-purchases'] }); qc.invalidateQueries({ queryKey: ['fuel-entries'] }); },
  });
}
export function useRegieQr(id: string | null) {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return useQuery({
    queryKey: ['regie-qr', id],
    queryFn: () => api.get(`/regie-purchases/${id}/qr`, { params: { base } }).then((r) => r.data as { ref: string | null; qr: string; verifyUrl: string; purchase: Record<string, unknown> }),
    enabled: !!id,
  });
}

export function useImportFuelCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) => api.post('/fuel-cards/import', { csv }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fuel-card-movements'] }); qc.invalidateQueries({ queryKey: ['fuel-card-summary'] }); },
  });
}
export function useAddCardMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.post(`/fuel-cards/${id}/movements`, body).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fuel-card-movements'] }); qc.invalidateQueries({ queryKey: ['fuel-card-summary'] }); },
  });
}

// ─── Phase 7 : Incidents / Sinistres + Contrôles périodiques ───
export function useIncidents() { return useCollection<any>('incidents'); }
export function useControlRequests() { return useCollection<any>('control-requests'); }
export function useIncidentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      api.patch(`/incidents/${id}/status`, { status, note }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });
}
export function useRespondControl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/control-requests/${id}/respond`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['control-requests'] });
      qc.invalidateQueries({ queryKey: ['evaluations'] });
      qc.invalidateQueries({ queryKey: ['maintenance-orders'] });
    },
  });
}
/** Génère (force) les demandes de contrôle périodique. */
export function useGenerateControls() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/control-requests/generate').then((r) => r.data as { created: number }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['control-requests'] }),
  });
}

// ─── Phase 8 : PEC publique / Amimer Énergie + App chauffeur ───
export function usePecRequests() { return useCollection<any>('pec-requests'); }
export function useAccessTokens() { return useCollection<any>('access-tokens'); }
export function useValidatePec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, workLocation }: { id: string; workLocation?: string }) =>
      api.patch(`/pec-requests/${id}/validate`, { workLocation }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pec-requests'] }),
  });
}
export function usePecToMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/pec-requests/${id}/to-mission`, {}).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pec-requests'] }); qc.invalidateQueries({ queryKey: ['missions'] }); },
  });
}
export function useImportPec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) => api.post('/pec-requests/import', { csv }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pec-requests'] }),
  });
}

// ─── File unique DPC : formulaire public + import plateforme Amimer Énergie (retour DG) ───
export function useImportDpc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) => api.post('/dpc-requests/import', { csv }).then((r) => r.data as { imported: number; codes: string[] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dpc-requests'] }),
  });
}
export function useValidateDpc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.patch(`/dpc-requests/${code}/validate`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dpc-requests'] }),
  });
}

// ─── Regroupement de plusieurs demandes de prise en charge dans une mission (retour DG) ───
export function useGroupableDpc(params: { fromLoc?: string; toLoc?: string; dateStart?: string; excludeCodes?: string[] }) {
  const key = ['dpc-groupable', params.fromLoc, params.toLoc, params.dateStart, (params.excludeCodes ?? []).join(',')];
  return useQuery({
    queryKey: key,
    queryFn: () => api.post('/dpc-requests/groupable', params).then((r) => r.data as any[]),
    enabled: !!params.fromLoc && !!params.toLoc,
  });
}
export function useMissionGroupPreview() {
  return useMutation({
    mutationFn: (body: { dpcCodes: string[]; fromLoc?: string; toLoc?: string }) =>
      api.post('/missions/group-preview', body).then((r) => r.data as {
        ok: boolean; fromLoc: string; toLoc: string; waypoints: string[]; waypointsRet: string[];
        retType: string; dAller: number; dRetour: number; distance: number; bu: string | null; pax: number; tonnage: number;
        fitVehicles: string[];
        costSplit: { dpcCode: string; bu: string | null; structure: string | null; pax: number; segmentKm: number; roundTrip: boolean; sharePct: number }[];
      }),
  });
}

// ─── Location : pointage rapide (fraction de journée) ───
export function useUpsertLeasePointage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: { vehicleCode: string; date: string; fraction: number; immobilized?: boolean; notes?: string }[]) =>
      api.post('/lease-pointage/upsert-many', rows).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lease-pointage'] }),
  });
}

// ─── Retour DG #7 : validation missions / interventions ───
export function useValidateMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (num: string) => api.patch(`/missions/${num}/validate`).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['missions'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });
}
/** Démarrer / terminer une mission (le démarrage émet l'ordre de mission → chauffeur). */
export function useMissionPhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ num, phase }: { num: string; phase: 'start' | 'finish' }) => api.patch(`/missions/${num}/${phase}`).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['missions'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });
}
export const useNotifications = (params?: { audience?: string; missionRef?: string }) =>
  useQuery({
    queryKey: ['notifications', params?.audience ?? '', params?.missionRef ?? ''],
    queryFn: () => api.get('/notifications', { params }).then((r) => r.data as Array<{
      id: string; audience: string; recipientName: string | null; recipientEmail: string | null;
      kind: string; subject: string; body: string; missionRef: string | null; read: boolean;
      emailStatus: string; createdAt: string;
    }>),
  });
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
/** Distance routière précise d'un itinéraire (points = {lat,lon} et/ou noms de lieux). */
export async function geoRoute(points: Array<{ lat: number; lon: number } | string>): Promise<{ km: number; durationMin: number; source: string }> {
  const r = await api.post('/geo/route', { points });
  return r.data;
}
export async function searchPlaces(q: string): Promise<Array<{ id: string; name: string; lat: number; lon: number; kind: string }>> {
  const r = await api.get('/places', { params: { q } });
  return r.data;
}
/** Autocomplete « type carte » : communes + n'importe quelle adresse (Google Maps, repli OSM). */
export async function suggestPlaces(q: string, bias?: { lat?: number; lon?: number }): Promise<Array<{ name: string; label: string; lat: number; lon: number; source: 'local' | 'osm' | 'google'; id?: string }>> {
  const r = await api.get('/geo/suggest', { params: { q, lat: bias?.lat, lon: bias?.lon } });
  return r.data;
}
export async function createPlace(body: { name: string; lat: number; lon: number; kind?: string; source?: string }) {
  const r = await api.post('/places', body);
  return r.data as { id: string; name: string; lat: number; lon: number };
}
export function useHolderValidateOt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ num, by }: { num: string; by?: string }) => api.patch(`/maintenance-orders/${num}/holder-validate`, { by }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance-orders'] }),
  });
}

// ─── Retour DG : clôture missions (fige les frais) ───
export function useCloturerMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ num, frais }: { num: string; frais?: { frais?: number; fraisDetail?: unknown; fraisCat?: string; fraisZone?: string } }) =>
      api.patch(`/missions/${num}/cloturer`, frais ?? {}).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['missions'] }); qc.invalidateQueries({ queryKey: ['alerts'] }); },
  });
}
export function useCloturerTerminees() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fraisByNum?: Record<string, { frais?: number; fraisDetail?: unknown; fraisCat?: string; fraisZone?: string }>) =>
      api.post('/missions/cloturer-terminees', { fraisByNum }).then((r) => r.data as { closed: number; nums: string[] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['missions'] }); qc.invalidateQueries({ queryKey: ['alerts'] }); },
  });
}

// ─── Retour DG #8 : import pleins + immobilisation location ───
export function useImportFuelEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) => api.post('/fuel-entries/import', { csv }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fuel-entries'] }),
  });
}
