import { useEffect, useMemo } from 'react';
import { Droplets, Package, Clock, AlertTriangle, Calendar, TestTube, Warehouse, Truck } from 'lucide-react';
import { useStore } from '@/store';
import BloodTypeBadge from '@/components/BloodTypeBadge';
import StatusBadge from '@/components/StatusBadge';

export default function Dashboard() {
  const {
    dashboardStats,
    dashboardTodos,
    slots,
    screenings,
    inventory,
    distributions,
    fetchDashboardStats,
    fetchDashboardTodos,
    fetchSlots,
    fetchScreenings,
    fetchInventory,
    fetchDistributions,
  } = useStore();

  useEffect(() => {
    fetchDashboardStats();
    fetchDashboardTodos();
    fetchSlots();
    fetchScreenings();
    fetchInventory();
    fetchDistributions();
  }, [fetchDashboardStats, fetchDashboardTodos, fetchSlots, fetchScreenings, fetchInventory, fetchDistributions]);

  const stats = dashboardStats || { today_collection: 0, available_inventory: 0, pending_requests: 0, expiring_soon: 0 };
  const todos = dashboardTodos || { pending_screenings: [], expiring_inventory: [], pending_requests: [] };

  const pipelineSteps = useMemo(() => {
    const bookedCount = slots.filter((s) => s.status === 'booked').length;
    const screenedCount = screenings.length;
    const passedCount = screenings.filter((s) => s.result === 'passed').length;
    const availableCount = inventory.filter((i) => i.status === 'available').length;
    const distributedCount = distributions.length;

    return [
      { label: '已预约', count: bookedCount, icon: Calendar, color: 'bg-amber-500' },
      { label: '已筛查', count: screenedCount, icon: TestTube, color: 'bg-blue-500' },
      { label: '合格入库', count: passedCount, icon: TestTube, color: 'bg-emerald-500' },
      { label: '可用库存', count: availableCount, icon: Warehouse, color: 'bg-cyan-500' },
      { label: '已发放', count: distributedCount, icon: Truck, color: 'bg-blood-600' },
    ];
  }, [slots, screenings, inventory, distributions]);

  const statCards = [
    { label: '今日采集', value: stats.today_collection, icon: Droplets, gradient: 'from-blood-700 to-blood-500' },
    { label: '可用库存', value: stats.available_inventory, icon: Package, gradient: 'from-blue-600 to-blue-400' },
    { label: '待处理需求', value: stats.pending_requests, icon: Clock, gradient: 'from-amber-600 to-amber-400' },
    { label: '即将过期', value: stats.expiring_soon, icon: AlertTriangle, gradient: 'from-red-600 to-red-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="stat-card">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-stone-500">{s.label}</p>
                <p className="text-3xl font-bold text-stone-800 font-serif">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="font-serif font-bold text-stone-800">供应全流程</h2>
          <p className="text-xs text-stone-400">采集 → 筛查 → 入库 → 发放 闭环追踪</p>
        </div>
        <div className="card-body">
          <div className="flex items-center justify-between">
            {pipelineSteps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-14 h-14 rounded-2xl ${step.color} flex items-center justify-center shadow-lg mb-2`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <p className="text-2xl font-bold text-stone-800 font-serif">{step.count}</p>
                    <span className="text-xs text-stone-500 font-medium mt-0.5">{step.label}</span>
                  </div>
                  {i < pipelineSteps.length - 1 && (
                    <div className="flex-1 mx-2 border-t-2 border-dashed border-stone-200" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <div className="card-header">
            <h3 className="font-bold text-stone-700">待筛查献血者</h3>
            <span className="text-xs text-blood-600 font-semibold">{todos.pending_screenings.length} 人</span>
          </div>
          <div className="card-body space-y-3 max-h-64 overflow-y-auto">
            {todos.pending_screenings.length === 0 && (
              <p className="text-sm text-stone-400">暂无待筛查献血者</p>
            )}
            {todos.pending_screenings.map((item) => (
              <div key={item.slot_id} className="flex items-center justify-between py-2 px-3 bg-stone-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <BloodTypeBadge type={item.blood_type} />
                  <span className="text-sm font-medium text-stone-700">{item.donor_name}</span>
                </div>
                <span className="text-xs text-stone-400">{item.date} {item.time_start}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-bold text-stone-700">即将过期库存</h3>
            <span className="text-xs text-amber-600 font-semibold">{todos.expiring_inventory.length} 袋</span>
          </div>
          <div className="card-body space-y-3 max-h-64 overflow-y-auto">
            {todos.expiring_inventory.length === 0 && (
              <p className="text-sm text-stone-400">暂无即将过期库存</p>
            )}
            {todos.expiring_inventory.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-stone-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <BloodTypeBadge type={item.blood_type} />
                  <span className="text-sm font-medium text-stone-700">{item.donor_name}</span>
                </div>
                <span className={`text-xs font-semibold ${item.hours_left < 24 ? 'expiry-red' : 'expiry-amber'}`}>
                  剩余 {item.hours_left}h
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-bold text-stone-700">待处理需求</h3>
            <span className="text-xs text-amber-600 font-semibold">{todos.pending_requests.length} 条</span>
          </div>
          <div className="card-body space-y-3 max-h-64 overflow-y-auto">
            {todos.pending_requests.length === 0 && (
              <p className="text-sm text-stone-400">暂无待处理需求</p>
            )}
            {todos.pending_requests.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-stone-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <BloodTypeBadge type={item.blood_type} />
                  <span className="text-sm font-medium text-stone-700">{item.hospital_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">×{item.quantity}</span>
                  <StatusBadge status={item.urgency} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
