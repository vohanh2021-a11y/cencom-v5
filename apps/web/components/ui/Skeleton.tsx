import * as React from 'react';

type Variant = 'text' | 'card' | 'table' | 'circle';

export function Skeleton({ variant = 'text', className = '' }: { variant?: Variant; className?: string }) {
  const v = { text: 'sk-text', card: 'sk-card', table: 'sk-table', circle: 'sk-circle' }[variant];
  return <div className={`sk ${v} ${className}`.trim()} />;
}
