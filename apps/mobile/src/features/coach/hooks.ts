import type { CoachAction } from '@fitmate/coach';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getSetting, setSetting } from '../../db/repositories';
import { clearMessages, deleteMemory, listMemory, recentMessages, setActionStatus } from '../../db/coachRepo';
import { runAction } from './actionRunner';
import { aiStatus, connectAi, disconnectAi, pruneChat, requestCoachReply, saveUserMessage } from './service';

export const coachKeys = {
  messages: ['coach', 'messages'] as const,
  memory: ['coach', 'memory'] as const,
  status: ['coach', 'status'] as const,
};

export const useCoachMessages = () => useQuery({ queryKey: coachKeys.messages, queryFn: () => recentMessages(100) });
export const useCoachMemory = () => useQuery({ queryKey: coachKeys.memory, queryFn: () => listMemory() });
export const useAiStatus = () => useQuery({ queryKey: coachKeys.status, queryFn: () => aiStatus() });

/** Sends a message (or, with `retry`, asks again for the last unanswered one). */
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { text: string } | { retry: true }) => {
      if ('text' in v) {
        saveUserMessage(v.text);
        await qc.invalidateQueries({ queryKey: coachKeys.messages });
      }
      return requestCoachReply();
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: coachKeys.messages });
      qc.invalidateQueries({ queryKey: coachKeys.memory });
    },
  });
}

export function useClearChat() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async () => clearMessages(), onSuccess: () => qc.invalidateQueries({ queryKey: coachKeys.messages }) });
}

export function useDeleteMemory() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => deleteMemory(id), onSuccess: () => qc.invalidateQueries({ queryKey: coachKeys.memory }) });
}

export function useConnectAi() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (key: string) => connectAi(key), onSuccess: () => qc.invalidateQueries({ queryKey: coachKeys.status }) });
}

export function useDisconnectAi() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => disconnectAi(), onSuccess: () => qc.invalidateQueries({ queryKey: coachKeys.status }) });
}

export const useReadAloud = () => useQuery({ queryKey: ['coach', 'readAloud'], queryFn: () => getSetting<boolean>('coachReadAloud', false) });

export function useSetReadAloud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (on: boolean) => setSetting('coachReadAloud', on),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coach', 'readAloud'] }),
  });
}

/** Runs a proposed action after the user taps Confirm, or marks it dismissed. */
export function useActionDecision() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (v: { messageId: string; index: number; action: CoachAction; confirm: boolean }) => {
      if (!v.confirm) {
        setActionStatus(v.messageId, v.index, 'dismissed');
        return { done: 0, skipped: [] as string[] };
      }
      try {
        const result = await runAction(v.action, {
          title: 'FitMate',
          water: t('reminders.waterBody'),
          medicine: (name) => t('reminders.medicineBody', { name }),
          custom: (label) => t('reminders.customBody', { label }),
        });
        setActionStatus(v.messageId, v.index, result.done > 0 ? 'done' : 'failed');
        return result;
      } catch (e) {
        setActionStatus(v.messageId, v.index, 'failed');
        throw e;
      }
    },
    onSettled: () => {
      for (const key of [coachKeys.messages, ['diary'], ['water'], ['progress'], ['profile'], ['weights'], ['recentFoods']]) qc.invalidateQueries({ queryKey: key });
    },
  });
}

export interface AgentSettings {
  actions: 'confirm' | 'off';
  retentionDays: number;
}

export const useAgentSettings = () =>
  useQuery({
    queryKey: ['coach', 'agentSettings'],
    queryFn: (): AgentSettings => ({
      actions: getSetting<'confirm' | 'off'>('coachActions', 'confirm'),
      retentionDays: getSetting<number>('chatRetentionDays', 90),
    }),
  });

export function useSetAgentSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { key: 'coachActions' | 'chatRetentionDays'; value: unknown }) => {
      setSetting(v.key, v.value);
      if (v.key === 'chatRetentionDays') pruneChat();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coach'] });
    },
  });
}
