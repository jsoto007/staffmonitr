import { useQuery } from '@tanstack/react-query';

import { fetchStaffMatrixRoles } from '../services/staffMatrix';
import type { StaffMatrixRole } from '../types';

// Staff Matrix roles are the canonical job titles across the app; use this hook to stay in sync.
export const useStaffMatrixRoles = (accountId?: string) => {
  const query = useQuery<StaffMatrixRole[]>(
    ['staffMatrixRoles', accountId],
    () => fetchStaffMatrixRoles(accountId ?? ''),
    {
      enabled: Boolean(accountId),
      refetchOnWindowFocus: false,
    },
  );

  return {
    roles: query.data ?? [],
    ...query,
  };
};
