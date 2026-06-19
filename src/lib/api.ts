const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `请求失败: ${res.status}`);
  }
  const json = await res.json();
  if (json.success && json.data !== undefined) {
    return json.data as T;
  }
  return json as T;
}

function del<T>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

function post<T>(path: string, body?: unknown) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

function put<T>(path: string, body?: unknown) {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

export interface Donor {
  id: string;
  name: string;
  blood_type: string;
  phone: string;
  gender: string;
  birth_date: string;
  donation_count: number;
  created_at?: string;
}

export interface Slot {
  id: string;
  donor_id: string | null;
  donor_name?: string;
  blood_type?: string;
  date: string;
  time_start: string;
  time_end: string;
  status: 'available' | 'booked' | 'completed' | 'cancelled';
  created_at?: string;
}

export interface Screening {
  id: string;
  appointment_id: string;
  donor_id: string;
  donor_name?: string;
  blood_type?: string;
  hbsag: string;
  hcv: string;
  hiv: string;
  syphilis: string;
  alt_value: number;
  result: 'passed' | 'failed';
  screener: string;
  screened_at: string;
}

export interface InventoryItem {
  id: string;
  screening_id?: string;
  donor_id: string;
  donor_name?: string;
  blood_type: string;
  collection_time: string;
  expiry_time: string;
  volume_ml: number;
  status: 'available' | 'distributed' | 'expired' | 'discarded';
  blood_type_locked: number;
  created_at?: string;
}

export interface HospitalRequest {
  id: string;
  hospital_name: string;
  distance_km: number;
  blood_type: string;
  quantity: number;
  urgency: 'critical' | 'urgent' | 'routine';
  status: 'pending' | 'fulfilled' | 'cancelled';
  created_at: string;
}

export interface Distribution {
  id: string;
  inventory_id: string;
  request_id: string;
  hospital_name: string;
  distributed_at: string;
  operator: string;
}

export interface DashboardStats {
  today_collection: number;
  available_inventory: number;
  pending_requests: number;
  expiring_soon: number;
}

export interface DashboardTodos {
  pending_screenings: Array<{ slot_id: string; donor_id: string; donor_name: string; blood_type: string; date: string; time_start: string; time_end: string }>;
  expiring_inventory: Array<{ id: string; donor_name: string; blood_type: string; expiry_time: string; hours_left: number }>;
  pending_requests: Array<{ id: string; hospital_name: string; blood_type: string; quantity: number; urgency: string; distance_km: number }>;
}

export const fetchDonors = () => request<Donor[]>('/donors');
export const createDonor = (d: Partial<Donor>) => post<Donor>('/donors', d);
export const updateDonor = (id: string, d: Partial<Donor>) => put<Donor>(`/donors/${id}`, d);
export const deleteDonor = (id: string) => del<{ ok: boolean }>(`/donors/${id}`);
export const getDonor = (id: string) => request<Donor>(`/donors/${id}`);

export const fetchSlots = (month?: string) => request<Slot[]>(month ? `/slots?month=${month}` : '/slots');
export const createSlot = (s: Partial<Slot>) => post<Slot>('/slots', s);
export const updateSlot = (id: string, s: Partial<Slot>) => put<Slot>(`/slots/${id}`, s);
export const deleteSlot = (id: string) => del<{ ok: boolean }>(`/slots/${id}`);

export const fetchScreenings = () => request<Screening[]>('/screenings');
export const createScreening = (s: Partial<Screening>) => post<Screening>('/screenings', s);

export const fetchInventory = () => request<InventoryItem[]>('/inventory');
export const updateInventory = (id: string, d: Partial<InventoryItem>) => put<InventoryItem>(`/inventory/${id}`, d);

export const fetchHospitalRequests = () => request<HospitalRequest[]>('/hospital-requests');
export const createHospitalRequest = (r: Partial<HospitalRequest>) => post<HospitalRequest>('/hospital-requests', r);
export const updateHospitalRequest = (id: string, r: Partial<HospitalRequest>) => put<HospitalRequest>(`/hospital-requests/${id}`, r);

export const fetchDistributions = () => request<Distribution[]>('/distributions');
export const createDistribution = (d: Partial<Distribution>) => post<Distribution>('/distributions', d);

export const fetchDashboardStats = () => request<DashboardStats>('/dashboard/stats');
export const fetchDashboardTodos = () => request<DashboardTodos>('/dashboard/todos');
