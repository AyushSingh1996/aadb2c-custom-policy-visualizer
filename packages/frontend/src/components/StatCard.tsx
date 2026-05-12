export interface StatCardProps {
  label: string;
  value: number;
}

export function StatCard({ label, value }: StatCardProps): JSX.Element {
  return (
    <article className="surface-card stat-card">
      <p className="stat-card__value">{value}</p>
      <div className="stat-card__label">{label}</div>
    </article>
  );
}
