import * as React from 'react';

type Variant = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

export function Badge({
  variant = 'neutral',
  className = '',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return <span className={`badge badge-${variant} ${className}`.trim()} {...props} />;
}
