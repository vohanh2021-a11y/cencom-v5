'use client';
import * as React from 'react';

type Variant = 'primary' | 'accent' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const v = { primary: 'btn-primary', accent: 'btn-accent', ghost: 'btn-ghost', danger: 'btn-danger' }[variant];
  const s = { sm: 'btn-sm', md: '', lg: 'btn-lg' }[size];
  return <button className={`btn ${v} ${s} ${className}`.trim()} {...props} />;
}
