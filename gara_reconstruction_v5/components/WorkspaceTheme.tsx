'use client';

/* W4.4 —_port v4 apps/web/components/WorkspaceTheme.tsx (verbatim).
 * Áp dụng theme workspace (data-ws) + chế độ view-only lên <body> để CSS isolate. */

import * as React from 'react';
import { useWorkspace } from './WorkspaceContext';

/** Áp dụng theme workspace (data-ws) + chế độ view-only lên <body> để CSS isolate. */
export default function WorkspaceTheme() {
  const { ws, editMode } = useWorkspace();

  React.useEffect(() => {
    document.body.setAttribute('data-ws', ws);
    if (!editMode) document.body.classList.add('view-only');
    else document.body.classList.remove('view-only');
  }, [ws, editMode]);

  return null;
}
