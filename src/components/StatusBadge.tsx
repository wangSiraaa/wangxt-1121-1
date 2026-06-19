interface StatusBadgeProps {
  status: string;
  className?: string;
}

const colorMap: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700',
  booked: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-stone-100 text-stone-500',
  no_show: 'bg-orange-100 text-orange-700',
  passed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  distributed: 'bg-blue-100 text-blue-700',
  expired: 'bg-amber-100 text-amber-700',
  discarded: 'bg-red-100 text-red-700',
  retest_failed: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
  fulfilled: 'bg-emerald-100 text-emerald-700',
  critical: 'bg-red-100 text-red-700',
  urgent: 'bg-amber-100 text-amber-700',
  routine: 'bg-blue-100 text-blue-700',
};

const labelMap: Record<string, string> = {
  available: '可用',
  booked: '已预约',
  completed: '已完成',
  cancelled: '已取消',
  no_show: '爽约',
  passed: '合格',
  failed: '不合格',
  distributed: '已发放',
  expired: '已过期',
  discarded: '已废弃',
  retest_failed: '复检不合格',
  pending: '待处理',
  fulfilled: '已满足',
  critical: '紧急',
  urgent: '较急',
  routine: '常规',
};

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const cls = colorMap[status] || 'bg-stone-100 text-stone-600';
  const label = labelMap[status] || status;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${cls} ${className}`}>
      {label}
    </span>
  );
}
