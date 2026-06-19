interface BloodTypeBadgeProps {
  type: string;
  className?: string;
}

const classMap: Record<string, string> = {
  A: 'badge-a',
  B: 'badge-b',
  O: 'badge-o',
  AB: 'badge-ab',
};

export default function BloodTypeBadge({ type, className = '' }: BloodTypeBadgeProps) {
  const prefix = type.replace(/[+-]/g, '');
  const cls = classMap[prefix] || 'badge-a';
  return <span className={`${cls} ${className}`}>{type}</span>;
}
