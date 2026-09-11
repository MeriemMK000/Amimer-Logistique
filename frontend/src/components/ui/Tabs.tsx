'use client';

interface Props {
  tabs: string[];
  active: number;
  onChange: (i: number) => void;
}

export default function Tabs({ tabs, active, onChange }: Props) {
  return (
    <div className="tabs">
      {tabs.map((t, i) => (
        <button key={t} className={`tab${i === active ? ' act' : ''}`} onClick={() => onChange(i)}>
          {t}
        </button>
      ))}
    </div>
  );
}
