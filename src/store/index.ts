import { create } from 'zustand';
import * as api from '@/lib/api';

interface AppState {
  activePage: string;
  sidebarCollapsed: boolean;
  userRole: string;

  donors: api.Donor[];
  slots: api.Slot[];
  screenings: api.Screening[];
  inventory: api.InventoryItem[];
  hospitalRequests: api.HospitalRequest[];
  distributions: api.Distribution[];
  dashboardStats: api.DashboardStats | null;
  dashboardTodos: api.DashboardTodos | null;

  setActivePage: (page: string) => void;
  toggleSidebar: () => void;
  setUserRole: (role: string) => void;

  fetchDonors: () => Promise<void>;
  fetchSlots: (month?: string) => Promise<void>;
  fetchScreenings: () => Promise<void>;
  fetchInventory: () => Promise<void>;
  fetchHospitalRequests: () => Promise<void>;
  fetchDistributions: () => Promise<void>;
  fetchDashboardStats: () => Promise<void>;
  fetchDashboardTodos: () => Promise<void>;
}

export const useStore = create<AppState>((set) => ({
  activePage: 'dashboard',
  sidebarCollapsed: false,
  userRole: '招募人员',

  donors: [],
  slots: [],
  screenings: [],
  inventory: [],
  hospitalRequests: [],
  distributions: [],
  dashboardStats: null,
  dashboardTodos: null,

  setActivePage: (page) => set({ activePage: page }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setUserRole: (role) => set({ userRole: role }),

  fetchDonors: async () => {
    const donors = await api.fetchDonors();
    set({ donors });
  },
  fetchSlots: async (month) => {
    const slots = await api.fetchSlots(month);
    set({ slots });
  },
  fetchScreenings: async () => {
    const screenings = await api.fetchScreenings();
    set({ screenings });
  },
  fetchInventory: async () => {
    const inventory = await api.fetchInventory();
    set({ inventory });
  },
  fetchHospitalRequests: async () => {
    const hospitalRequests = await api.fetchHospitalRequests();
    set({ hospitalRequests });
  },
  fetchDistributions: async () => {
    const distributions = await api.fetchDistributions();
    set({ distributions });
  },
  fetchDashboardStats: async () => {
    const dashboardStats = await api.fetchDashboardStats();
    set({ dashboardStats });
  },
  fetchDashboardTodos: async () => {
    const dashboardTodos = await api.fetchDashboardTodos();
    set({ dashboardTodos });
  },
}));
