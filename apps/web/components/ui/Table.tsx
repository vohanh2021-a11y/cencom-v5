import * as React from 'react';

export function Table({ className = '', ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={`tbl ${className}`.trim()} {...props} />;
}
