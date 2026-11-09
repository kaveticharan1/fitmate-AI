import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSetting, setSetting } from '../../db/repositories';
import { clearMessages, deleteMemory, listMemory, recentMessages } from '../../db/coachRepo';
import { aiStatus, connectAi, disconnectAi, requestCoachReply, saveUserMessage } from './service';

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
