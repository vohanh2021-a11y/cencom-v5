import * as React from 'react';

type Variant = 'default' | 'glass' | 'bold';

export function Card({
  variant = 'default',
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  const v = { default: '', glass: 'card-glass', bold: 'card-bold' }[variant];
  return <div className={`card ${v} ${className}`.trim()} {...props} />;
}

export function CardHeader({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card-hd ${className}`.trim()} {...props} />;
}

export function CardBody({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card-bd ${className}`.trim()} {...props} />;
}
