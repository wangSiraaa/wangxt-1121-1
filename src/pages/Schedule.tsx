import { useEffect, useState, useMemo } from 'react';
import { Plus, Trash2, Edit3, ChevronLeft, ChevronRight, AlertTriangle, X } from 'lucide-react';
import { useStore } from '@/store';
import * as api from '@/lib/api';
import BloodTypeBadge from '@/components/BloodTypeBadge';
import StatusBadge from '@/components/StatusBadge';

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

function DonorModal({ donor, onClose, onSaved }: { donor?: api.Donor; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: donor?.name || '',
    blood_type: donor?.blood_type || 'A+',
    phone: donor?.phone || '',
    gender: donor?.gender || 'male',
    birth_date: donor?.birth_date || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.blood_type || !form.phone || !form.gender || !form.birth_date) {
      alert('请填写所有必填字段');
      return;
    }
    setSaving(true);
    try {
      if (donor) await api.updateDonor(donor.id, form);
      else await api.createDonor(form);
      onSaved();
      onClose();
    } catch (e) { alert('保存失败: ' + (e as Error).message); }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-serif font-bold text-stone-800">{donor ? '编辑献血者' : '新增献血者'}</h3>
        </div>
        <div className="modal-body space-y-4">
          <div>
            <label className="form-label">姓名 <span className="text-red-500">*</span></label>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="请输入姓名" />
          </div>
          <div>
            <label className="form-label">性别 <span className="text-red-500">*</span></label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="gender" value="male" checked={form.gender === 'male'} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="w-4 h-4" />
                <span className="text-stone-700">男</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="gender" value="female" checked={form.gender === 'female'} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="w-4 h-4" />
                <span className="text-stone-700">女</span>
              </label>
            </div>
          </div>
          <div>
            <label className="form-label">出生日期 <span className="text-red-500">*</span></label>
            <input type="date" className="form-input" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
          </div>
          <div>
            <label className="form-label">血型 <span className="text-red-500">*</span></label>
            <select className="form-input" value={form.blood_type} onChange={(e) => setForm({ ...form, blood_type: e.target.value })}>
              {bloodTypes.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">联系电话 <span className="text-red-500">*</span></label>
            <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="请输入联系电话" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
        </div>
      </div>
    </div>
  );
}

function SlotModal({ donors, onClose, onSaved }: { donors: api.Donor[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ donor_id: '', date: '', time_start: '08:00', time_end: '10:00' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.createSlot({ ...form, status: 'available' });
      onSaved();
      onClose();
    } catch (e) { alert('创建失败: ' + (e as Error).message); }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-serif font-bold text-stone-800">新增时段</h3>
        </div>
        <div className="modal-body">
          <div>
            <label className="form-label">献血者（可选）</label>
            <select className="form-input" value={form.donor_id} onChange={(e) => setForm({ ...form, donor_id: e.target.value })}>
              <option value="">不指定</option>
              {donors.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.blood_type})</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">日期</label>
            <input type="date" className="form-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">开始时间</label>
              <input type="time" className="form-input" value={form.time_start} onChange={(e) => setForm({ ...form, time_start: e.target.value })} />
            </div>
            <div>
              <label className="form-label">结束时间</label>
              <input type="time" className="form-input" value={form.time_end} onChange={(e) => setForm({ ...form, time_end: e.target.value })} />
            </div>
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

function BookModal({ slot, donors, onClose, onSaved }: { slot: api.Slot; donors: api.Donor[]; onClose: () => void; onSaved: () => void }) {
  const [donorId, setDonorId] = useState(slot.donor_id || '');
  const [saving, setSaving] = useState(false);

  const handleBook = async () => {
    setSaving(true);
    try {
      await api.updateSlot(slot.id, { donor_id: donorId, status: 'booked' });
      onSaved();
      onClose();
    } catch (e) { alert('预约失败: ' + (e as Error).message); }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-serif font-bold text-stone-800">预约登记</h3>
        </div>
        <div className="modal-body">
          <p className="text-sm text-stone-500">时段: {slot.date} {slot.time_start}-{slot.time_end}</p>
          <div>
            <label className="form-label">选择献血者</label>
            <select className="form-input" value={donorId} onChange={(e) => setDonorId(e.target.value)}>
              <option value="">请选择</option>
              {donors.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.blood_type})</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleBook} disabled={saving || !donorId}>{saving ? '预约中...' : '确认预约'}</button>
        </div>
      </div>
    </div>
  );
}

function NoShowModal({ slot, onClose, onSaved }: { slot: api.Slot; onClose: () => void; onSaved: (impact: api.QuotaImpact | null) => void }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [impact, setImpact] = useState<api.QuotaImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(true);

  useEffect(() => {
    api.fetchQuotaImpact(slot.date).then((data) => {
      setImpact(data);
      setLoadingImpact(false);
    }).catch(() => setLoadingImpact(false));
  }, [slot.date]);

  const handleNoShow = async () => {
    if (!reason.trim()) {
      alert('请填写爽约原因');
      return;
    }
    setSaving(true);
    try {
      await api.updateSlot(slot.id, { status: 'no_show', no_show_reason: reason });
      onSaved(impact);
      onClose();
    } catch (e) { alert('操作失败: ' + (e as Error).message); }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-serif font-bold text-stone-800">标记临时爽约</h3>
        </div>
        <div className="modal-body space-y-4">
          <div className="bg-stone-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <BloodTypeBadge type={slot.blood_type || ''} />
              <span className="font-medium text-stone-700">{slot.donor_name}</span>
            </div>
            <p className="text-xs text-stone-400">{slot.date} {slot.time_start}-{slot.time_end}</p>
          </div>

          <div>
            <label className="form-label">爽约原因 <span className="text-red-500">*</span></label>
            <textarea className="form-input min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="请填写爽约原因" />
          </div>

          {loadingImpact && <p className="text-sm text-stone-400">正在评估配额影响...</p>}

          {impact && (
            <div className={`rounded-lg border p-3 ${impact.quota_at_risk ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`w-4 h-4 ${impact.quota_at_risk ? 'text-red-600' : 'text-emerald-600'}`} />
                <span className={`text-sm font-semibold ${impact.quota_at_risk ? 'text-red-700' : 'text-emerald-700'}`}>
                  配额影响评估
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-stone-600">日采集配额: <span className="font-semibold text-stone-800">{impact.daily_quota} 袋</span></div>
                <div className="text-stone-600">有效预约: <span className="font-semibold text-stone-800">{impact.effective_collection} 袋</span></div>
                <div className="text-stone-600">分离产能: <span className="font-semibold text-stone-800">{impact.separation_capacity} 袋</span></div>
                <div className="text-stone-600">分离剩余: <span className={`font-semibold ${impact.separation_remaining <= 0 ? 'text-red-600' : 'text-stone-800'}`}>{impact.separation_remaining} 袋</span></div>
                <div className="text-stone-600">已爽约: <span className="font-semibold text-orange-600">{impact.no_show_slots} 人</span></div>
                <div className="text-stone-600">缺口: <span className={`font-semibold ${impact.quota_deficit > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{impact.quota_deficit > 0 ? `${impact.quota_deficit} 袋` : '无缺口'}</span></div>
              </div>
              {impact.quota_at_risk && (
                <p className="mt-2 text-xs text-red-700 font-medium">
                  ⚠ 标记爽约后当日采集配额存在缺口，将影响后续分离产能安排
                </p>
              )}
              {impact.separation_overloaded && (
                <p className="mt-1 text-xs text-amber-700 font-medium">
                  ⚠ 分离产能已达上限，需协调增加分离资源
                </p>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-danger" onClick={handleNoShow} disabled={saving || !reason.trim()}>
            {saving ? '处理中...' : '确认爽约'}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuotaImpactBanner({ impact, onClose }: { impact: api.QuotaImpact; onClose: () => void }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-800 mb-1">
          配额影响提醒（{impact.date}）
        </p>
        <p className="text-xs text-amber-700">
          采集配额 {impact.daily_quota} 袋，当前有效 {impact.effective_collection} 袋，
          缺口 {impact.quota_deficit} 袋；分离产能 {impact.separation_capacity} 袋，
          剩余 {impact.separation_remaining} 袋。
          {impact.separation_overloaded && ' 分离产能已满！'}
        </p>
      </div>
      <button onClick={onClose} className="text-amber-400 hover:text-amber-600"><X className="w-4 h-4" /></button>
    </div>
  );
}

export default function Schedule() {
  const { donors, slots, fetchDonors, fetchSlots } = useStore();
  const [showDonorModal, setShowDonorModal] = useState(false);
  const [editDonor, setEditDonor] = useState<api.Donor | undefined>();
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [bookSlot, setBookSlot] = useState<api.Slot | null>(null);
  const [noShowSlot, setNoShowSlot] = useState<api.Slot | null>(null);
  const [quotaImpact, setQuotaImpact] = useState<api.QuotaImpact | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => { fetchDonors(); fetchSlots(); }, [fetchDonors, fetchSlots]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const slotsByDate = useMemo(() => {
    const map: Record<string, api.Slot[]> = {};
    slots.forEach((s) => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [slots]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleDeleteDonor = async (id: string) => {
    if (!confirm('确定删除此献血者？')) return;
    try {
      await api.deleteDonor(id);
      fetchDonors();
    } catch (e) {
      alert('删除失败: ' + (e as Error).message);
      fetchDonors();
    }
  };

  const handleNoShowSaved = (impact: api.QuotaImpact | null) => {
    fetchSlots();
    if (impact && impact.quota_at_risk) {
      setQuotaImpact(impact);
    }
  };

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="space-y-6">
      {quotaImpact && <QuotaImpactBanner impact={quotaImpact} onClose={() => setQuotaImpact(null)} />}

      <div className="card">
        <div className="card-header">
          <h2 className="font-serif font-bold text-stone-800">献血者管理</h2>
          <button className="btn-primary btn-sm" onClick={() => { setEditDonor(undefined); setShowDonorModal(true); }}>
            <Plus className="w-4 h-4" /> 新增献血者
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="px-5 py-3 text-left font-medium text-stone-500">姓名</th>
                <th className="px-5 py-3 text-left font-medium text-stone-500">性别</th>
                <th className="px-5 py-3 text-left font-medium text-stone-500">出生日期</th>
                <th className="px-5 py-3 text-left font-medium text-stone-500">血型</th>
                <th className="px-5 py-3 text-left font-medium text-stone-500">电话</th>
                <th className="px-5 py-3 text-left font-medium text-stone-500">献血次数</th>
                <th className="px-5 py-3 text-right font-medium text-stone-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {donors.map((d, i) => (
                <tr key={d.id} className={`border-b border-stone-50 ${i % 2 === 1 ? 'table-row-even' : ''}`}>
                  <td className="px-5 py-3 font-medium text-stone-700">{d.name}</td>
                  <td className="px-5 py-3 text-stone-600">{d.gender === 'male' ? '男' : '女'}</td>
                  <td className="px-5 py-3 text-stone-600">{d.birth_date}</td>
                  <td className="px-5 py-3"><BloodTypeBadge type={d.blood_type} /></td>
                  <td className="px-5 py-3 text-stone-600">{d.phone}</td>
                  <td className="px-5 py-3 text-stone-600">{d.donation_count}</td>
                  <td className="px-5 py-3 text-right">
                    <button className="btn-secondary btn-sm mr-2" onClick={() => { setEditDonor(d); setShowDonorModal(true); }}>
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button className="btn-danger btn-sm" onClick={() => handleDeleteDonor(d.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {donors.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-stone-400">暂无献血者数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <button className="btn-secondary btn-sm" onClick={handlePrevMonth}><ChevronLeft className="w-4 h-4" /></button>
            <h2 className="font-serif font-bold text-stone-800">{year}年{month + 1}月</h2>
            <button className="btn-secondary btn-sm" onClick={handleNextMonth}><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button className="btn-primary btn-sm" onClick={() => setShowSlotModal(true)}>
            <Plus className="w-4 h-4" /> 新增时段
          </button>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-7 gap-px bg-stone-200 rounded-lg overflow-hidden">
            {weekDays.map((d) => (
              <div key={d} className="bg-stone-50 py-2 text-center text-xs font-medium text-stone-500">{d}</div>
            ))}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`e-${i}`} className="bg-white min-h-[80px]" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const daySlots = slotsByDate[dateStr] || [];
              const isToday = dateStr === new Date().toISOString().slice(0, 10);
              return (
                <div key={day} className={`bg-white min-h-[80px] p-1.5 ${isToday ? 'ring-2 ring-blood-500 ring-inset' : ''}`}>
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blood-700' : 'text-stone-500'}`}>{day}</div>
                  {daySlots.slice(0, 3).map((s) => (
                    <div
                      key={s.id}
                      onClick={() => {
                        if (s.status === 'available') setBookSlot(s);
                        else if (s.status === 'booked') setNoShowSlot(s);
                      }}
                      className={`text-xs px-1.5 py-0.5 rounded mb-0.5 truncate cursor-pointer ${
                        s.status === 'available' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' :
                        s.status === 'booked' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' :
                        s.status === 'completed' ? 'bg-blue-50 text-blue-700' :
                        s.status === 'no_show' ? 'bg-orange-50 text-orange-700' :
                        'bg-stone-50 text-stone-400'
                      }`}
                    >
                      {s.time_start} {s.donor_name || '空'}
                    </div>
                  ))}
                  {daySlots.length > 3 && <div className="text-xs text-stone-400 px-1.5">+{daySlots.length - 3} 更多</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showDonorModal && (
        <DonorModal donor={editDonor} onClose={() => setShowDonorModal(false)} onSaved={() => fetchDonors()} />
      )}
      {showSlotModal && (
        <SlotModal donors={donors} onClose={() => setShowSlotModal(false)} onSaved={() => fetchSlots()} />
      )}
      {bookSlot && (
        <BookModal slot={bookSlot} donors={donors} onClose={() => setBookSlot(null)} onSaved={() => fetchSlots()} />
      )}
      {noShowSlot && (
        <NoShowModal slot={noShowSlot} onClose={() => setNoShowSlot(null)} onSaved={handleNoShowSaved} />
      )}
    </div>
  );
}
