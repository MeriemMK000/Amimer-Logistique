// Reproduit v8 `_kpi(label,val,sub,cls)` — <div class="rap-kpi {cls}">
export default function KpiTile({ label, value, sub, cls = 'kpi-b' }: {
  label: string; value: React.ReactNode; sub?: string; cls?: string;
}) {
  return (
    <div className={`rap-kpi ${cls}`}>
      <div className="rap-kpi-label">{label}</div>
      <div className="rap-kpi-val">{value}</div>
      {sub && <div className="rap-kpi-sub">{sub}</div>}
    </div>
  );
}
