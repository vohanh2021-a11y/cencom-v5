'use client';

import * as React from 'react';

export type SessionUser = {
  id: string;
  name: string;
  role: string;
  username: string;
};

export type SessionValue = {
  user?: SessionUser;
  role?: string;
  perms?: Record<string, string[]>;
};

export const SessionContext = React.createContext<SessionValue>({});

export function useSession(): SessionValue {
  return React.useContext(SessionContext);
}
