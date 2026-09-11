export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="cc" style={{ padding: 32 }}>
      <h3>{title}</h3>
      <p style={{ fontSize: '.82rem', color: 'var(--tm)', marginTop: 8 }}>
        Module en cours de portage vers React — les données sont déjà disponibles via l’API.
      </p>
    </div>
  );
}
