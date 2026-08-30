'use client';

import axios from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  Vehicle,
  Driver,
  Mission,
  MaintenanceOrder,
  MaintenancePlan,
  FuelEntry,
  Incident,
  Alert,
  MissionExpense,
  ExpenseScale,
  VehicleDocument,
  VehicleLease,
  VehicleAssignment,
  MissionZone,
  ConstructorNorm,
  FuelAnalysis,
  ErpExport,
  ErpImport,
  DashboardStats,
  PaginatedResponse,
  ApiResponse,
} from '@/types';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('fleet_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('fleet_token');
        localStorage.removeItem('fleet_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ==================== AUTH ====================
export const authApi = {
  login: (data: LoginRequest) =>
    api.post<LoginResponse>('/auth/login', data),
  register: (data: { email: string; password: string; name: string }) =>
    api.post<LoginResponse>('/auth/register', data),
  me: () => api.get<ApiResponse<LoginResponse['user']>>('/auth/me'),
};

// ==================== VEHICLES ====================
export const vehiclesApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Vehicle>>('/vehicles', { params }),
  getById: (id: string) =>
    api.get<ApiResponse<Vehicle>>(`/vehicles/${id}`),
  create: (data: Partial<Vehicle>) =>
    api.post<ApiResponse<Vehicle>>('/vehicles', data),
  update: (id: string, data: Partial<Vehicle>) =>
    api.put<ApiResponse<Vehicle>>(`/vehicles/${id}`, data),
  delete: (id: string) =>
    api.delete(`/vehicles/${id}`),
};

// ==================== DRIVERS ====================
export const driversApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Driver>>('/drivers', { params }),
  getById: (id: string) =>
    api.get<ApiResponse<Driver>>(`/drivers/${id}`),
  create: (data: Partial<Driver>) =>
    api.post<ApiResponse<Driver>>('/drivers', data),
  update: (id: string, data: Partial<Driver>) =>
    api.put<ApiResponse<Driver>>(`/drivers/${id}`, data),
  delete: (id: string) =>
    api.delete(`/drivers/${id}`),
};

// ==================== MISSIONS ====================
export const missionsApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Mission>>('/missions', { params }),
  getById: (id: string) =>
    api.get<ApiResponse<Mission>>(`/missions/${id}`),
  create: (data: Partial<Mission>) =>
    api.post<ApiResponse<Mission>>('/missions', data),
  update: (id: string, data: Partial<Mission>) =>
    api.put<ApiResponse<Mission>>(`/missions/${id}`, data),
  delete: (id: string) =>
    api.delete(`/missions/${id}`),
};

// ==================== MAINTENANCE ====================
export const maintenanceApi = {
  getOrders: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<MaintenanceOrder>>('/maintenance/orders', { params }),
  getOrderById: (id: string) =>
    api.get<ApiResponse<MaintenanceOrder>>(`/maintenance/orders/${id}`),
  createOrder: (data: Partial<MaintenanceOrder>) =>
    api.post<ApiResponse<MaintenanceOrder>>('/maintenance/orders', data),
  updateOrder: (id: string, data: Partial<MaintenanceOrder>) =>
    api.put<ApiResponse<MaintenanceOrder>>(`/maintenance/orders/${id}`, data),
  getPlans: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<MaintenancePlan>>('/maintenance/plans', { params }),
  createPlan: (data: Partial<MaintenancePlan>) =>
    api.post<ApiResponse<MaintenancePlan>>('/maintenance/plans', data),
};

// ==================== FUEL ====================
export const fuelApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<FuelEntry>>('/fuel', { params }),
  getById: (id: string) =>
    api.get<ApiResponse<FuelEntry>>(`/fuel/${id}`),
  create: (data: Partial<FuelEntry>) =>
    api.post<ApiResponse<FuelEntry>>('/fuel', data),
  getAnalysis: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<FuelAnalysis>>('/fuel/analysis', { params }),
  importCsv: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/fuel/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ==================== INCIDENTS ====================
export const incidentsApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Incident>>('/incidents', { params }),
  getById: (id: string) =>
    api.get<ApiResponse<Incident>>(`/incidents/${id}`),
  create: (data: Partial<Incident>) =>
    api.post<ApiResponse<Incident>>('/incidents', data),
  update: (id: string, data: Partial<Incident>) =>
    api.put<ApiResponse<Incident>>(`/incidents/${id}`, data),
};

// ==================== ALERTS ====================
export const alertsApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<Alert>>('/alerts', { params }),
  markRead: (id: string) =>
    api.put(`/alerts/${id}/read`),
  dismiss: (id: string) =>
    api.put(`/alerts/${id}/dismiss`),
  getUnreadCount: () =>
    api.get<{ count: number }>('/alerts/unread-count'),
};

// ==================== EXPENSES ====================
export const expensesApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get<PaginatedResponse<MissionExpense>>('/expenses', { params }),
  create: (data: Partial<MissionExpense>) =>
    api.post<ApiResponse<MissionExpense>>('/expenses', data),
  getScales: () =>
    api.get<ApiResponse<ExpenseScale[]>>('/expenses/scales'),
  createScale: (data: Partial<ExpenseScale>) =>
    api.post<ApiResponse<ExpenseScale>>('/expenses/scales', data),
};

// ==================== DOCUMENTS ====================
export const documentsApi = {
  getByVehicle: (vehicleId: string) =>
    api.get<ApiResponse<VehicleDocument[]>>(`/vehicles/${vehicleId}/documents`),
  create: (data: Partial<VehicleDocument>) =>
    api.post<ApiResponse<VehicleDocument>>('/documents', data),
};

// ==================== LEASES ====================
export const leasesApi = {
  getByVehicle: (vehicleId: string) =>
    api.get<ApiResponse<VehicleLease[]>>(`/vehicles/${vehicleId}/leases`),
  create: (data: Partial<VehicleLease>) =>
    api.post<ApiResponse<VehicleLease>>('/leases', data),
};

// ==================== ASSIGNMENTS ====================
export const assignmentsApi = {
  getByVehicle: (vehicleId: string) =>
    api.get<ApiResponse<VehicleAssignment[]>>(`/vehicles/${vehicleId}/assignments`),
  create: (data: Partial<VehicleAssignment>) =>
    api.post<ApiResponse<VehicleAssignment>>('/assignments', data),
};

// ==================== ZONES ====================
export const zonesApi = {
  getAll: () =>
    api.get<ApiResponse<MissionZone[]>>('/zones'),
  create: (data: Partial<MissionZone>) =>
    api.post<ApiResponse<MissionZone>>('/zones', data),
  update: (id: string, data: Partial<MissionZone>) =>
    api.put<ApiResponse<MissionZone>>(`/zones/${id}`, data),
};

// ==================== CONSTRUCTOR NORMS ====================
export const normsApi = {
  getAll: () =>
    api.get<ApiResponse<ConstructorNorm[]>>('/norms'),
  create: (data: Partial<ConstructorNorm>) =>
    api.post<ApiResponse<ConstructorNorm>>('/norms', data),
};

// ==================== ERP ====================
export const erpApi = {
  getExports: () =>
    api.get<ApiResponse<ErpExport[]>>('/erp/exports'),
  createExport: (data: Partial<ErpExport>) =>
    api.post<ApiResponse<ErpExport>>('/erp/exports', data),
  getImports: () =>
    api.get<ApiResponse<ErpImport[]>>('/erp/imports'),
  createImport: (file: File, type: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    return api.post('/erp/imports', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ==================== DASHBOARD ====================
export const dashboardApi = {
  getStats: () =>
    api.get<ApiResponse<DashboardStats>>('/dashboard/stats'),
};

export default api;
