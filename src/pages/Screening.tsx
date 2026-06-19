import { useEffect, useState } from 'react';
import { useStore } from '@/store';
import * as api from '@/lib/api';
import BloodTypeBadge from '@/components/BloodTypeBadge';

type TestKey = 'hbsag' | 'hcv' | 'hiv' | 'syphilis';

const tests: { key: TestKey; label: string }[] = [
  { key: 'hbsag', label: 'HBsAg' },
  { key: 'hcv', label: 'HCV' },
  { key: 'hiv', label: 'HIV' },
  { key: 'syphilis', label: '梅毒' },
];

function ScreeningFormModal({
  slot,
  onClose,
  onSaved,
}: {
  slot: api.Slot;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [results, setResults] = useState<Record<TestKey, string>>({
    hbsag: 'negative',
    hcv: 'negative',
    hiv: 'negative',
    syphilis: 'negative',
  });
  const [altValue, setAltValue] = useState(0);
  const [screener, setScreener] = useState('');
  const [saving, setSaving] = useState(false);

  const failed = Object.values(results).some((v) => v === 'positive') || altValue > 40;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.createScreening({
        appointment_id: slot.id,
        donor_id: slot.donor_id!,
        hbsag: results.hbsag,
        hcv: results.hcv,
        hiv: results.hiv,
        syphilis: results.syphilis,
        alt_value: altValue,
        result: failed ? 'failed' : 'passed',
        screener,
      });
      onSaved();
      onClose();
    } catch (e) {
      alert('保存失败: ' + (e as Error).message);
    }
    setSaving(false);
  };

  const toggle = (key: TestKey) => setResults((r) => ({ ...r, [key]: r[key] === 'positive' ? 'negative' : 'positive' }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="font-serif font-bold text-stone-800">录入筛查结果</h3>
        </div>
        <div className="modal-body">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-stone-600">献血者:</span>
            <span className="font-medium text-stone-800">{slot.donor_name}</span>
            <BloodTypeBadge type={slot.blood_type || ''} />
          </div>

          {tests.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-stone-700">{label}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => results[key] === 'positive' && toggle(key)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    results[key] === 'negative' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-400'
                  }`}
                >
                  阴性
                </button>
                <button
                  onClick={() => results[key] === 'negative' && toggle(key)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    results[key] === 'positive' ? 'bg-red-100 text-red-700' : 'bg-stone-100 text-stone-400'
                  }`}
                >
                  阳性
                </button>
              </div>
            </div>
          ))}

          <div>
            <label className="form-label">ALT 值 (U/L)</label>
            <input
              type="number"
              className="form-input"
              value={altValue}
              onChange={(e) => setAltValue(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="form-label">检验员</label>
            <input className="form-input" value={screener} onChange={(e) => setScreener(e.target.value)} />
          </div>

          {failed && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
              检测结果不合格：{Object.entries(results).filter(([, v]) => v === 'positive').map(([k]) => tests.find((t) => t.key === k)?.label).join('、')}{altValue > 40 ? (Object.values(results).some((v) => v === 'positive') ? '、' : '') + 'ALT>' + altValue : ''}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !screener}>
            {saving ? '保存中...' : '提交结果'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Screening() {
  const { slots, screenings, fetchSlots, fetchScreenings } = useStore();
  const [tab, setTab] = useState<'pending' | 'completed'>('pending');
  const [formSlot, setFormSlot] = useState<api.Slot | null>(null);

  useEffect(() => {
    fetchSlots();
    fetchScreenings();
  }, [fetchSlots, fetchScreenings]);

  const screenedSlotIds = new Set(screenings.map((s) => s.appointment_id));

  const pendingSlots = slots.filter((s) => s.status === 'booked' && !screenedSlotIds.has(s.id));

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-stone-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'pending' ? 'bg-white text-blood-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          待筛查
        </button>
        <button
          onClick={() => setTab('completed')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'completed' ? 'bg-white text-blood-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          已筛查
        </button>
      </div>

      {tab === 'pending' && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-serif font-bold text-stone-800">待筛查列表</h2>
            <span className="text-xs text-amber-600 font-semibold">{pendingSlots.length} 人</span>
          </div>
          <div className="card-body space-y-3">
            {pendingSlots.length === 0 && (
              <p className="text-sm text-stone-400 text-center py-8">暂无待筛查献血者</p>
            )}
            {pendingSlots.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3 px-4 bg-stone-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <BloodTypeBadge type={s.blood_type || ''} />
                  <div>
                    <p className="text-sm font-medium text-stone-700">{s.donor_name || '未指定'}</p>
                    <p className="text-xs text-stone-400">{s.date} {s.time_start}-{s.time_end}</p>
                  </div>
                </div>
                <button className="btn-primary btn-sm" onClick={() => setFormSlot(s)}>
                  录入结果
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'completed' && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-serif font-bold text-stone-800">筛查记录</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="px-4 py-3 text-left font-medium text-stone-500">献血者</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-500">血型</th>
                  <th className="px-4 py-3 text-center font-medium text-stone-500">HBsAg</th>
                  <th className="px-4 py-3 text-center font-medium text-stone-500">HCV</th>
                  <th className="px-4 py-3 text-center font-medium text-stone-500">HIV</th>
                  <th className="px-4 py-3 text-center font-medium text-stone-500">梅毒</th>
                  <th className="px-4 py-3 text-center font-medium text-stone-500">ALT</th>
                  <th className="px-4 py-3 text-center font-medium text-stone-500">结果</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-500">检验员</th>
                  <th className="px-4 py-3 text-left font-medium text-stone-500">时间</th>
                </tr>
              </thead>
              <tbody>
                {screenings.map((s, i) => {
                  const isFailed = s.result === 'failed';
                  return (
                    <tr key={s.id} className={`border-b border-stone-50 ${i % 2 === 1 ? 'table-row-even' : ''} border-l-4 ${isFailed ? 'border-l-red-500' : 'border-l-emerald-500'}`}>
                      <td className="px-4 py-3 font-medium text-stone-700">{s.donor_name}</td>
                      <td className="px-4 py-3"><BloodTypeBadge type={s.blood_type || ''} /></td>
                      <td className={`px-4 py-3 text-center ${s.hbsag === 'positive' ? 'text-red-600 font-bold' : 'text-emerald-600'}`}>{s.hbsag === 'positive' ? '+' : '-'}</td>
                      <td className={`px-4 py-3 text-center ${s.hcv === 'positive' ? 'text-red-600 font-bold' : 'text-emerald-600'}`}>{s.hcv === 'positive' ? '+' : '-'}</td>
                      <td className={`px-4 py-3 text-center ${s.hiv === 'positive' ? 'text-red-600 font-bold' : 'text-emerald-600'}`}>{s.hiv === 'positive' ? '+' : '-'}</td>
                      <td className={`px-4 py-3 text-center ${s.syphilis === 'positive' ? 'text-red-600 font-bold' : 'text-emerald-600'}`}>{s.syphilis === 'positive' ? '+' : '-'}</td>
                      <td className="px-4 py-3 text-center text-stone-700">{s.alt_value}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${isFailed ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {isFailed ? '不合格' : '合格'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-600">{s.screener}</td>
                      <td className="px-4 py-3 text-stone-400 text-xs">{s.screened_at}</td>
                    </tr>
                  );
                })}
                {screenings.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-stone-400">暂无筛查记录</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {formSlot && (
        <ScreeningFormModal slot={formSlot} onClose={() => setFormSlot(null)} onSaved={() => { fetchScreenings(); fetchSlots(); }} />
      )}
    </div>
  );
}
