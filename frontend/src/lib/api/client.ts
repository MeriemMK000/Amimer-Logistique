import axios from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });

// Le backend enveloppe toutes les reponses dans { data, statusCode, timestamp }.
api.interceptors.response.use((res) => {
  if (res.data && typeof res.data === 'object' && 'data' in res.data && 'statusCode' in res.data) {
    res.data = res.data.data;
  }
  return res;
});

export async function getAll<T>(resource: string): Promise<T[]> {
  const { data } = await api.get<T[]>(`/${resource}`);
  return data ?? [];
}
export async function getOne<T>(resource: string, id: string): Promise<T> {
  const { data } = await api.get<T>(`/${resource}/${id}`);
  return data;
}
export async function createOne<T>(resource: string, body: Partial<T>): Promise<T> {
  const { data } = await api.post<T>(`/${resource}`, body);
  return data;
}
export async function updateOne<T>(resource: string, id: string, body: Partial<T>): Promise<T> {
  const { data } = await api.patch<T>(`/${resource}/${id}`, body);
  return data;
}
export async function removeOne(resource: string, id: string): Promise<void> {
  await api.delete(`/${resource}/${id}`);
}
export interface KmBreakdown {
  base: number; baseDate: string; baseSource: string;
  realizedMissions: number; realizedHome: number; total: number;
  homePerDay?: number; homeWorkingDays?: number;
  readings: { id: string; vehicleCode: string; date: string; km: number; source: string; note: string | null }[];
}
export async function getKmBreakdown(vehicleCode: string): Promise<KmBreakdown> {
  const { data } = await api.get<KmBreakdown>(`/km-readings/compute/${vehicleCode}`);
  return data;
}

export async function getConfig<T = unknown>(key: string): Promise<T> {
  const { data } = await api.get<T>(`/config/${key}`);
  return data;
}
export async function putConfig(key: string, value: unknown): Promise<void> {
  await api.put(`/config/${key}`, { value });
}
