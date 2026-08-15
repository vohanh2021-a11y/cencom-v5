import * as React from 'react';

export function EmptyState({ icon = '📭', children }: { icon?: string; children?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <div className="ic text-4xl mb-2">{icon}</div>
      {children}
    </div>
  );
}
