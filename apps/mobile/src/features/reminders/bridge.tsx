import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { addMessage, hasMessageWithFlag } from '../../db/coachRepo';
import { getSetting, setSetting } from '../../db/repositories';
import { setupCategories, snooze } from './notifications';

export interface NotificationLogItem {
  at: string;
  title: string;
  body: string;
  action: 'opened' | 'snoozed' | 'received';
}

const LOG_KEY = 'notificationLog';
const LOG_MAX = 50;

export function readNotificationLog(): NotificationLogItem[] {
  return getSetting<NotificationLogItem[]>(LOG_KEY, []);
}

export function logNotification(item: NotificationLogItem) {
  setSetting(LOG_KEY, [item, ...readNotificationLog()].slice(0, LOG_MAX));
}

type Content = { title?: string | null; body?: string | null; data?: Record<string, unknown> };

/**
 * Turns an opened reminder into the start of a coach conversation: the reminder
 * text is added as the coach's message (once), so the user can simply reply.
 */
export function continueInChat(requestId: string, content: Content): boolean {
  const flag = `n:${requestId}`;
  if (hasMessageWithFlag(flag)) return false;
  const text = [content.title, content.body].filter(Boolean).join(' — ');
  if (!text) return false;
  addMessage('coach', text, ['reminder', flag]);
  return true;
}

/**
 * Handles taps on FitMate notifications while the app is unlocked:
 * "Snooze" reschedules in 30 minutes; a normal tap opens the coach chat.
 * Taps that arrive while locked are handled right after unlocking.
 */
export function NotificationBridge() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const handled = useRef(new Set<string>());

  useEffect(() => {
    setupCategories(t('reminders.snooze'));
    const handle = async (r: Notifications.NotificationResponse | null) => {
      if (!r) return;
      const req = r.notification.request;
      const key = `${req.identifier}:${r.notification.date}`;
      if (handled.current.has(key)) return;
      handled.current.add(key);
      const content = req.content as Content;
      const now = new Date().toISOString();
      if (r.actionIdentifier === 'snooze') {
        await snooze(content);
        logNotification({ at: now, title: content.title ?? '', body: content.body ?? '', action: 'snoozed' });
        return;
      }
      logNotification({ at: now, title: content.title ?? '', body: content.body ?? '', action: 'opened' });
      try {
        continueInChat(key, content);
        qc.invalidateQueries({ queryKey: ['coach', 'messages'] });
      } catch {
        /* chat is optional */
      }
      router.push('/coach');
    };
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      handle(r).catch(() => undefined);
    });
    const received = Notifications.addNotificationReceivedListener((n) => {
      const c = n.request.content as Content;
      logNotification({ at: new Date().toISOString(), title: c.title ?? '', body: c.body ?? '', action: 'received' });
    });
    return () => {
      sub.remove();
      received.remove();
    };
  }, [t, qc]);

  return null;
}
