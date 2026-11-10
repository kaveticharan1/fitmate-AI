import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getMembership } from './store';
import { createGroup, fetchGroup, getShareSettings, joinGroup, leaveGroup, pushSummary, sendCheer, setShareSettings, type CheerKind } from './service';
import type { ShareSettings } from './summary';

export const buddyKeys = {
  membership: ['buddy', 'membership'] as const,
  group: ['buddy', 'group'] as const,
  share: ['buddy', 'share'] as const,
};

export const useMembership = () => useQuery({ queryKey: buddyKeys.membership, queryFn: () => getMembership() });

/** The group, refreshed every minute while the screen is open. */
export const useBuddyGroup = (enabled: boolean) =>
  useQuery({ queryKey: buddyKeys.group, queryFn: () => fetchGroup(), enabled, refetchInterval: 60_000, retry: 1 });

export const useShareSettings = () => useQuery({ queryKey: buddyKeys.share, queryFn: () => getShareSettings() });

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['buddy'] });
  };
}

export function useCreateGroup() {
  const done = useInvalidateAll();
  return useMutation({ mutationFn: (v: { groupName: string; displayName: string }) => createGroup(v.groupName, v.displayName), onSuccess: done });
}

export function useJoinGroup() {
  const done = useInvalidateAll();
  return useMutation({ mutationFn: (v: { code: string; displayName: string }) => joinGroup(v.code, v.displayName), onSuccess: done });
}

export function useLeaveGroup() {
  const done = useInvalidateAll();
  return useMutation({ mutationFn: () => leaveGroup(), onSuccess: done });
}

export function useCheer() {
  return useMutation({ mutationFn: (v: { to: string; kind: CheerKind }) => sendCheer(v.to, v.kind) });
}

export function useSetShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: ShareSettings) => {
      setShareSettings(s);
      await pushSummary({ force: true }).catch(() => undefined);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['buddy'] }),
  });
}

/** Home: quietly shares your latest summary (at most every 15 minutes) when you're in a group. */
export function useBuddySync() {
  useEffect(() => {
    pushSummary().catch(() => undefined);
  }, []);
}
