import * as React from 'react';

/**
 * KpiCard — thẻ chỉ số. Dùng chung cho Home (Glass) và Dashboard (Bold).
 * Style theo theme cha (.theme-home / .theme-dash).
 */
export function KpiCard({
  value,
  label,
  hint,
}: {
  value: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <div className="kpi">
      <div className="v">{value}</div>
      <div className="s">{label}</div>
      {hint ? (
        <div className="s" style={{ opacity: 0.7, fontSize: 11 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
