import { useEffect, useState, useMemo } from 'react';
import { Plus, Lock, Truck, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { useStore } from '@/store';
import * as api from '@/lib/api';
import BloodTypeBadge from '@/components/BloodTypeBadge';
import StatusBadge from '@/components/StatusBadge';

const bloodTypeGroups = ['A', 'B', 'O', 'AB'];
const urgencyOptions: Array<{ value: api.HospitalRequest['urgency']; label: string }> = [
  { value: 'critical', label: '紧急' },
  { value: 'urgent', label: '较急' },
  { value: 'routine', label: '常规' },
];
const hospitalLevelOptions: Array<{ value: string; label: string }> = [
  { value: 'tertiary_a', label: '三甲' },
  { value: 'tertiary_b', label: '三乙' },
  { value: 'secondary', label: '二级' },
];

function getExpiryHours(expiryTime: string): number {
  return Math.max(0, Math.round((new Date(expiryTime).getTime() - Date.now()) / 3600000));
}

function getExpiryClass(hours: number): string {
  if (hours > 48) return 'expiry-green';
  if (hours >= 24) return 'expiry-amber';
  return 'expiry-red';
}

function computeAllocationScore(remainingHours: number, distanceKm: number, hospitalLevel: string, transportHours: number): { valid: boolean; score: number; details: string } {
  let minRequiredHours = hospitalLevel === 'tertiary_a' ? 6 : hospitalLevel === 'tertiary_b' ? 8 : 12;
  if (distanceKm > 100) minRequiredHours = Math.max(minRequiredHours, 48);
  else if (distanceKm > 50) minRequiredHours = Math.max(minRequiredHours, 24);
  const safetyBuffer = transportHours * 1.5;
  const effectiveMin = minRequiredHours + safetyBuffer;

  if (remainingHours < effectiveMin) {
    return { valid: false, score: 0, details: `有效期不足: 需≥${effectiveMin.toFixed(1)}h(最低${minRequiredHours}h+运输缓冲${safetyBuffer.toFixed(1)}h), 实际${remainingHours}h` };
  }

  const urgencyScore = hospitalLevel === 'tertiary_a' ? 30 : hospitalLevel === 'tertiary_b' ? 20 : 10;
  const expiryScore = Math.min(40, (remainingHours / 120) * 40);
  const transportScore = Math.max(0, 30 - (transportHours / 12) * 30);
  const total = urgencyScore + expiryScore + transportScore;

  return {
    valid: true,
    score: Math.round(total),
    details: `医院等级${urgencyScore}+有效期${Math.round(expiryScore)}+运输${Math.round(transportScore)} = ${Math.round(total)}分`
  };
}

function EditInventoryModal({ item, onClose, onSaved }: { item: api.InventoryItem; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(item.status);
  const [bloodType, setBloodType] = useState(item.blood_type);
  const [saving, setSaving] = useState(false);
  const locked = !!item.blood_type_locked || item.status === 'distributed' || item.status === 'retest_failed';

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateInventory(item.id, { status, blood_type: bloodType });
      onSaved();
      onClose();
    } catch (e) { alert('保存失败: ' + (e as Error).message); }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-serif font-bold text-stone-800">编辑库存</h3>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="form-label flex items-center gap-1">
              血型
              {locked && <Lock className="w-3.5 h-3.5 text-stone-400" />}
            </label>
            <select className="form-input" value={bloodType} onChange={(e) => setBloodType(e.target.value)} disabled={locked}>
              {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bt) => (
                <option key={bt} value={bt}>{bt}</option>
              ))}
            </select>
            {locked && <p className="text-xs text-stone-400 mt-1">血型已锁定，不可修改</p>}
          </div>
          <div>
            <label className="form-label">状态</label>
            <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value as api.InventoryItem['status'])} disabled={item.status === 'retest_failed'}>
              <option value="available">可用</option>
              <option value="distributed">已发放</option>
              <option value="expired">已过期</option>
              <option value="discarded">已废弃</option>
              {item.status === 'retest_failed' && <option value="retest_failed">复检不合格</option>}
            </select>
            {item.status === 'retest_failed' && (
              <p className="text-xs text-red-500 mt-1">复检不合格血袋不可手动恢复状态</p>
            )}
          </div>
          {item.removal_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700">撤出原因</p>
              <p className="text-xs text-red-600 mt-1">{item.removal_reason}</p>
            </div>
          )}
          {item.batch_no && (
            <div className="bg-stone-50 rounded-lg p-3 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-stone-400" />
              <span className="text-xs text-stone-500">批号: {item.batch_no}</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || item.status === 'retest_failed'}>{saving ? '保存中...' : '保存'}</button>
        </div>
      </div>
    </div>
  );
}

function HospitalRequestModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    hospital_name: '',
    distance_km: 0,
    blood_type: 'A+',
    quantity: 1,
    urgency: 'routine' as api.HospitalRequest['urgency'],
    hospital_level: 'tertiary_a' as string,
    transport_hours: 2,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.createHospitalRequest({ ...form, status: 'pending' });
      onSaved();
      onClose();
    } catch (e) { alert('创建失败: ' + (e as Error).message); }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-serif font-bold text-stone-800">新增医院需求</h3>
        </div>
        <div className="modal-body space-y-4">
          <div><label className="form-label">医院名称</label><input className="form-input" value={form.hospital_name} onChange={(e) => setForm({ ...form, hospital_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label">距离(km)</label><input type="number" className="form-input" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: Number(e.target.value) })} /></div>
            <div><label className="form-label">运输时长(h)</label><input type="number" className="form-input" value={form.transport_hours} onChange={(e) => setForm({ ...form, transport_hours: Number(e.target.value) })} min={0.5} step={0.5} /></div>
          </div>
          <div><label className="form-label">医院等级</label>
            <select className="form-input" value={form.hospital_level} onChange={(e) => setForm({ ...form, hospital_level: e.target.value })}>
              {hospitalLevelOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div><label className="form-label">需求血型</label>
            <select className="form-input" value={form.blood_type} onChange={(e) => setForm({ ...form, blood_type: e.target.value })}>
              {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bt) => <option key={bt} value={bt}>{bt}</option>)}
            </select>
          </div>
          <div><label className="form-label">数量(袋)</label><input type="number" className="form-input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} min={1} /></div>
          <div><label className="form-label">紧急程度</label>
            <select className="form-input" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value as api.HospitalRequest['urgency'] })}>
              {urgencyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? '创建中...' : '创建'}</button>
        </div>
      </div>
    </div>
  );
}

function DistributeConfirmModal({ invItem, req, onClose, onDistributed }: { invItem: api.InventoryItem; req: api.HospitalRequest; onClose: () => void; onDistributed: () => void }) {
  const [saving, setSaving] = useState(false);
  const hours = getExpiryHours(invItem.expiry_time);
  const transportHours = req.transport_hours || Math.max(1, (req.distance_km || 0) / 60);
  const hospitalLevel = req.hospital_level || 'secondary';
  const allocation = computeAllocationScore(hours, req.distance_km || 0, hospitalLevel, transportHours);

  const handleConfirm = async () => {
    if (!allocation.valid) {
      alert('分配校验未通过，无法发放');
      return;
    }
    setSaving(true);
    try {
      await api.createDistribution({ inventory_id: invItem.id, request_id: req.id, operator: '发血岗' });
      onDistributed();
      onClose();
    } catch (e) {
      alert('发放失败: ' + (e as Error).message);
    }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-serif font-bold text-stone-800">确认发放</h3>
        </div>
        <div className="modal-body space-y-4">
          <div className="bg-stone-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-600">血袋信息</span>
              <div className="flex items-center gap-2">
                <BloodTypeBadge type={invItem.blood_type} />
                <span className="text-sm font-medium text-stone-700">{invItem.donor_name}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500">批号</span>
              <span className="text-stone-700 font-mono">{invItem.batch_no || '-'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500">剩余有效期</span>
              <span className={getExpiryClass(hours)}>{hours}h</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500">采集量</span>
              <span className="text-stone-700">{invItem.volume_ml}ml</span>
            </div>
          </div>

          <div className="bg-stone-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-600">发放目标</span>
              <span className="text-sm font-medium text-stone-700">{req.hospital_name}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500">医院等级</span>
              <span className="text-stone-700">{api.hospitalLevelLabel(hospitalLevel)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500">运输距离</span>
              <span className="text-stone-700">{req.distance_km}km</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500">运输时长</span>
              <span className="text-stone-700">{transportHours}h</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500">紧急程度</span>
              <StatusBadge status={req.urgency} />
            </div>
          </div>

          <div className={`rounded-lg border p-3 ${allocation.valid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              {allocation.valid ? (
                <span className="text-sm font-semibold text-emerald-700">分配校验通过</span>
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}
              {!allocation.valid && <span className="text-sm font-semibold text-red-700">分配校验未通过</span>}
            </div>
            {allocation.valid ? (
              <p className="text-xs text-emerald-600">综合匹配评分: {allocation.score}分 ({allocation.details})</p>
            ) : (
              <p className="text-xs text-red-600">{allocation.details}</p>
            )}
          </div>

          {allocation.valid && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">发放后锁定信息</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-blue-500">血型</span>
                  <p className="font-medium text-blue-800 flex items-center gap-1"><Lock className="w-3 h-3" />{invItem.blood_type}</p>
                </div>
                <div>
                  <span className="text-blue-500">批号</span>
                  <p className="font-medium text-blue-800 flex items-center gap-1"><Lock className="w-3 h-3" />{invItem.batch_no || '-'}</p>
                </div>
                <div>
                  <span className="text-blue-500">去向</span>
                  <p className="font-medium text-blue-800 flex items-center gap-1"><Lock className="w-3 h-3" />{req.hospital_name}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          {allocation.valid ? (
            <button className="btn-primary" onClick={handleConfirm} disabled={saving}>{saving ? '发放中...' : '确认发放'}</button>
          ) : (
            <button className="btn-secondary" disabled>校验未通过，无法发放</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Inventory() {
  const { inventory, hospitalRequests, fetchInventory, fetchHospitalRequests, fetchDistributions, distributions } = useStore();
  const [tab, setTab] = useState<'inventory' | 'requests' | 'distribution'>('inventory');
  const [editItem, setEditItem] = useState<api.InventoryItem | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [distributeTarget, setDistributeTarget] = useState<{ inv: api.InventoryItem; req: api.HospitalRequest } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => { fetchInventory(); fetchHospitalRequests(); fetchDistributions(); }, [fetchInventory, fetchHospitalRequests, fetchDistributions]);

  const inventoryByGroup = useMemo(() => {
    const map: Record<string, api.InventoryItem[]> = {};
    bloodTypeGroups.forEach((g) => { map[g] = []; });
    inventory.forEach((item) => {
      const prefix = item.blood_type.replace(/[+-]/g, '');
      if (map[prefix]) map[prefix].push(item);
    });
    return map;
  }, [inventory]);

  const pendingRequests = hospitalRequests.filter((r) => r.status === 'pending');

  const handleDistributeSuccess = () => {
    Promise.all([fetchInventory(), fetchHospitalRequests(), fetchDistributions()]);
    setToast({ type: 'success', msg: '血袋已成功发放，血型/批号/去向已锁定' });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-fadeIn ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex gap-1 bg-stone-100 rounded-lg p-1 w-fit">
        {([['inventory', '库存总览'], ['requests', '医院需求'], ['distribution', '发放执行']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-blood-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button className="btn-primary btn-sm" onClick={() => { /* manual entry */ }}>
              <Plus className="w-4 h-4" /> 入库登记
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bloodTypeGroups.map((group) => {
              const items = inventoryByGroup[group] || [];
              return (
                <div key={group} className="card">
                  <div className="card-header">
                    <h3 className="font-serif font-bold text-stone-800">{group}型血小板</h3>
                    <span className="text-xs text-stone-400">{items.length} 袋</span>
                  </div>
                  <div className="card-body space-y-2 max-h-72 overflow-y-auto">
                    {items.length === 0 && <p className="text-sm text-stone-400 text-center py-4">暂无库存</p>}
                    {items.map((item) => {
                      const hours = getExpiryHours(item.expiry_time);
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer ${
                            item.status === 'retest_failed' ? 'bg-red-50 border border-red-200' : 'bg-stone-50'
                          }`}
                          onClick={() => setEditItem(item)}
                        >
                          <div className="flex items-center gap-2">
                            <BloodTypeBadge type={item.blood_type} />
                            {item.blood_type_locked && <Lock className="w-3 h-3 text-stone-400" />}
                            <div>
                              <p className="text-sm font-medium text-stone-700">{item.donor_name}</p>
                              <p className="text-xs text-stone-400">
                                {item.batch_no && <span className="font-mono">{item.batch_no} · </span>}
                                {item.volume_ml}ml · {item.collection_time?.slice(0, 16)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-semibold ${getExpiryClass(hours)}`}>
                              {hours > 0 ? `剩余 ${hours}h` : '已过期'}
                            </p>
                            <StatusBadge status={item.status} />
                            {item.removal_reason && (
                              <p className="text-xs text-red-500 mt-0.5 truncate max-w-[120px]" title={item.removal_reason}>
                                {item.removal_reason}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'requests' && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-serif font-bold text-stone-800">医院需求</h2>
            <button className="btn-primary btn-sm" onClick={() => setShowRequestModal(true)}>
              <Plus className="w-4 h-4" /> 新增需求
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="px-4 py-3 text-left font-medium text-stone-500">医院</th>
                  <th className="px-4 py-3 text-center font-medium text-stone-500">等级</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-500">距离</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-500">运输时长</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-500">血型</th>
                  <th className="px-4 py-3 text-center font-medium text-stone-500">数量</th>
                  <th className="px-4 py-3 text-center font-medium text-stone-500">紧急程度</th>
                  <th className="px-4 py-3 text-center font-medium text-stone-500">状态</th>
                </tr>
              </thead>
              <tbody>
                {hospitalRequests.map((r, i) => (
                  <tr key={r.id} className={`border-b border-stone-50 ${i % 2 === 1 ? 'table-row-even' : ''}`}>
                    <td className="px-4 py-3 font-medium text-stone-700">{r.hospital_name}</td>
                    <td className="px-4 py-3 text-center"><span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-100 text-blue-700">{api.hospitalLevelLabel(r.hospital_level || 'secondary')}</span></td>
                    <td className="px-4 py-3 text-stone-600">{r.distance_km}km</td>
                    <td className="px-4 py-3 text-stone-600">{r.transport_hours || '-'}h</td>
                    <td className="px-4 py-3"><BloodTypeBadge type={r.blood_type} /></td>
                    <td className="px-4 py-3 text-center text-stone-700">{r.quantity}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={r.urgency} /></td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
                {hospitalRequests.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400">暂无需求记录</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'distribution' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="card-header">
              <h2 className="font-serif font-bold text-stone-800">待处理需求</h2>
              <span className="text-xs text-amber-600 font-semibold">{pendingRequests.length} 条</span>
            </div>
            <div className="card-body space-y-3 max-h-[500px] overflow-y-auto">
              {pendingRequests.length === 0 && <p className="text-sm text-stone-400 text-center py-8">暂无待处理需求</p>}
              {pendingRequests.map((r) => (
                <div key={r.id} className="py-3 px-4 bg-stone-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BloodTypeBadge type={r.blood_type} />
                      <span className="text-sm font-medium text-stone-700">{r.hospital_name}</span>
                    </div>
                    <StatusBadge status={r.urgency} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-stone-400">
                    <span>{api.hospitalLevelLabel(r.hospital_level || 'secondary')}</span>
                    <span>{r.distance_km}km</span>
                    <span>运输{r.transport_hours || '?'}h</span>
                    <span>需求{r.quantity}袋</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="font-serif font-bold text-stone-800">匹配库存</h2>
            </div>
            <div className="card-body space-y-3 max-h-[500px] overflow-y-auto">
              {pendingRequests.length === 0 && <p className="text-sm text-stone-400 text-center py-8">选择左侧需求后匹配库存</p>}
              {pendingRequests.map((req) => {
                const matched = inventory
                  .filter((inv) => inv.blood_type === req.blood_type && inv.status === 'available')
                  .map((inv) => {
                    const hours = getExpiryHours(inv.expiry_time);
                    const transportHours = req.transport_hours || Math.max(1, (req.distance_km || 0) / 60);
                    const hospitalLevel = req.hospital_level || 'secondary';
                    const allocation = computeAllocationScore(hours, req.distance_km || 0, hospitalLevel, transportHours);
                    return { inv, hours, allocation };
                  })
                  .sort((a, b) => b.allocation.score - a.allocation.score);
                if (matched.length === 0) return null;
                return (
                  <div key={req.id} className="mb-4">
                    <p className="text-xs text-stone-400 mb-2">{req.hospital_name} · {req.blood_type}型</p>
                    {matched.map(({ inv, hours, allocation }) => (
                      <div key={inv.id} className={`flex items-center justify-between py-2.5 px-3 rounded-lg mb-2 ${allocation.valid ? 'bg-emerald-50' : 'bg-stone-50 opacity-60'}`}>
                        <div>
                          <p className="text-sm font-medium text-stone-700">{inv.donor_name}</p>
                          <p className={`text-xs ${getExpiryClass(hours)}`}>剩余 {hours}h · {inv.volume_ml}ml</p>
                          <p className="text-xs text-stone-400">
                            {allocation.valid ? `评分: ${allocation.score}分` : allocation.details.slice(0, 30) + '...'}
                          </p>
                        </div>
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => setDistributeTarget({ inv, req })}
                          disabled={!allocation.valid}
                        >
                          <Truck className="w-3.5 h-3.5" /> 发放
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <EditInventoryModal item={editItem} onClose={() => setEditItem(null)} onSaved={() => fetchInventory()} />
      )}
      {showRequestModal && (
        <HospitalRequestModal onClose={() => setShowRequestModal(false)} onSaved={() => fetchHospitalRequests()} />
      )}
      {distributeTarget && (
        <DistributeConfirmModal
          invItem={distributeTarget.inv}
          req={distributeTarget.req}
          onClose={() => setDistributeTarget(null)}
          onDistributed={handleDistributeSuccess}
        />
      )}
    </div>
  );
}
