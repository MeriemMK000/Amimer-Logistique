import { statusInfo } from '@/lib/fleet/format';

export default function StatusBadge({ status }: { status: string | null | undefined }) {
  const { label, cls } = statusInfo(status);
  return <span className={`bg ${cls}`}>{label}</span>;
}
