import { Ionicons } from '@expo/vector-icons';
import { HELPLINES, plainText, type StoredAction } from '@fitmate/coach';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Gradient } from '../../components/glow';
import { Mascot } from '../../components/Mascot';
import { Banner, Button, Card, Screen } from '../../components/ui';
import type { CoachMessage } from '../../db/coachRepo';
import { coachErrorKey } from '../../features/coach/errors';
import { useActionSummary } from '../../features/coach/useActionSummary';
import { useActionDecision, useAiStatus, useCoachMessages, useReadAloud, useSendMessage, useSetReadAloud } from '../../features/coach/hooks';
import { pruneChat } from '../../features/coach/service';
import { speakReply, stopSpeaking, useVoiceInput, type VoiceLang } from '../../features/coach/voice';
import { useProfile } from '../../features/profile/hooks';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space, TOUCH } from '../../theme/tokens';

const SUGGESTIONS = ['dinner', 'workout', 'craving', 'plateau'] as const;

export default function CoachScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: status } = useAiStatus();
  const { data: messages = [] } = useCoachMessages();
  const { data: profile } = useProfile();
  const { data: readAloud = false } = useReadAloud();
  const setReadAloud = useSetReadAloud();
  const send = useSendMessage();
  const { prefill, listen, n } = useLocalSearchParams<{ prefill?: string; listen?: string; n?: string }>();
  const [draft, setDraft] = useState(prefill ?? '');
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const lang: VoiceLang = profile?.aiLanguage === 'te' ? 'te' : 'en';
  const voice = useVoiceInput(lang, (text) => setDraft((d) => (d.trim() ? `${d.trim()} ${text}` : text)));

  useEffect(() => () => stopSpeaking(), []);
  // The Coach tab stays mounted, so apply each new request (prefill or "start listening").
  const [seenN, setSeenN] = useState(n);
  if (n !== seenN) {
    setSeenN(n);
    if (prefill) setDraft(prefill);
  }
  const startVoice = voice.start;
  useEffect(() => {
    if (listen === '1' && status?.connected) startVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, status?.connected]);
  useEffect(() => {
    try {
      pruneChat();
    } catch {
      /* best effort */
    }
  }, []);

  if (status && !status.connected) {
    return (
      <Screen testID="coach">
        <CoachHeader online={false} />
        <View style={{ alignItems: 'center' }}>
          <Mascot size={140} mood="happy" />
        </View>
        <Card testID="coach-setup">
          <AppText variant="heading">{t('coach.setupTitle')}</AppText>
          <AppText tone="secondary">{t('coach.setupBody')}</AppText>
          <Button testID="coach-setup-button" label={t('coach.setupButton')} onPress={() => router.push('/settings/ai')} />
        </Card>
      </Screen>
    );
  }

  const last = messages.at(-1);
  const awaitingReply = last?.role === 'user' && !send.isPending;

  const submit = (text: string) => {
    const v = text.trim();
    if (!v || send.isPending) return;
    if (voice.listening) voice.stop();
    setDraft('');
    send.mutate({ text: v }, { onSuccess: (reply) => readAloud && speakReply(reply.text, lang) });
  };
  const retry = () => send.mutate({ retry: true }, { onSuccess: (reply) => readAloud && speakReply(reply.text, lang) });

  const composer = (
    <View style={{ gap: space.sm }}>
      {voice.listening ? (
        <AppText variant="caption" tone="accent" testID="listening">
          {voice.partial || t('coach.listening')}
        </AppText>
      ) : null}
      {voice.error ? <AppText variant="caption" tone="warning" testID="voice-error">{t(`coach.voiceErrors.${voice.error}`)}</AppText> : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
        <Pressable
          testID="mic"
          accessibilityRole="button"
          accessibilityLabel={voice.listening ? t('coach.stopListening') : t('coach.speak')}
          onPress={voice.listening ? voice.stop : voice.start}
          style={{ width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: voice.listening ? colors.accent : colors.surfaceRaised }}
        >
          <Ionicons name={voice.listening ? 'stop' : 'mic-outline'} size={22} color={voice.listening ? colors.onAccent : colors.text} />
        </Pressable>
        <TextInput
          testID="coach-input"
          accessibilityLabel={t('coach.inputLabel')}
          placeholder={t('coach.placeholder')}
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={1000}
          style={{ flex: 1, minHeight: TOUCH, maxHeight: 120, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 16, paddingHorizontal: space.md, paddingVertical: space.sm }}
        />
        <Pressable
          testID="send"
          accessibilityRole="button"
          accessibilityLabel={t('coach.send')}
          accessibilityState={{ disabled: !draft.trim() || send.isPending }}
          onPress={() => submit(draft)}
          style={{ width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, opacity: !draft.trim() || send.isPending ? 0.5 : 1 }}
        >
          <Ionicons name="send" size={20} color={colors.onAccent} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <Screen testID="coach" scroll={false} footer={composer}>
      <CoachHeader
        online
        right={
          <Pressable
            testID="read-aloud"
            accessibilityRole="switch"
            accessibilityState={{ checked: readAloud }}
            accessibilityLabel={t('coach.readAloud')}
            onPress={() => {
              if (readAloud) stopSpeaking();
              setReadAloud.mutate(!readAloud);
            }}
            style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={readAloud ? 'volume-high' : 'volume-mute-outline'} size={24} color={readAloud ? colors.accent : colors.textMuted} />
          </Pressable>
        }
      />

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ gap: space.md, paddingBottom: space.md }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        <AppText variant="caption" tone="muted" center>
          {t('coach.disclaimer')}
        </AppText>
        {messages.length === 0 ? (
          <View style={{ gap: space.sm }} testID="suggestions">
            <View style={{ alignItems: 'center' }}>
              <Mascot size={120} mood="cheer" />
            </View>
            <AppText tone="secondary">{t('coach.emptyIntro')}</AppText>
            {SUGGESTIONS.map((s) => (
              <Button key={s} testID={`suggest-${s}`} variant="secondary" label={t(`coach.suggest.${s}`)} onPress={() => submit(t(`coach.suggest.${s}`))} />
            ))}
          </View>
        ) : null}
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} onSpeak={() => speakReply(m.text, lang)} />
        ))}
        {send.isPending ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Mascot size={36} mood="thinking" />
            <AppText tone="secondary" testID="typing">
              {t('coach.typing')}
            </AppText>
          </View>
        ) : null}
        {send.isError || awaitingReply ? (
          <View style={{ gap: space.sm }} testID="send-error">
            <Banner tone="danger" text={t(send.isError ? coachErrorKey(send.error) : 'coach.errors.unanswered')} />
            <Button testID="retry" variant="secondary" label={t('coach.retry')} onPress={retry} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function CoachHeader({ online, right }: { online: boolean; right?: React.ReactNode }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm }}>
      <Mascot size={52} mood={online ? 'happy' : 'thinking'} />
      <View style={{ flex: 1 }}>
        <AppText variant="heading">{t('coach.title')}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: online ? colors.success : colors.textMuted }} />
          <AppText variant="caption" tone="secondary" testID="coach-status">
            {online ? t('coach.online') : t('coach.offline')}
          </AppText>
        </View>
      </View>
      {right}
      <Pressable
        testID="coach-settings"
        accessibilityRole="button"
        accessibilityLabel={t('coach.settingsTitle')}
        onPress={() => router.push('/settings/ai')}
        style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

function MessageBubble({ m, onSpeak }: { m: CoachMessage; onSpeak: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const mine = m.role === 'user';
  return (
    <View style={{ gap: space.sm }}>
      <View
        testID={`msg-${m.role}`}
        style={{
          alignSelf: mine ? 'flex-end' : 'flex-start',
          maxWidth: '88%',
          backgroundColor: mine ? colors.gradFrom : colors.glass,
          borderWidth: mine ? 0 : 1,
          borderColor: colors.glassBorder,
          borderRadius: radius.lg,
          borderBottomRightRadius: mine ? 6 : radius.lg,
          borderTopLeftRadius: mine ? radius.lg : 6,
          padding: space.md,
          gap: space.xs,
          overflow: 'hidden',
        }}
      >
        {mine ? <Gradient from={colors.gradFrom} to={colors.gradTo} /> : null}
        <AppText selectable style={mine ? { color: colors.onAccent } : undefined}>{mine ? m.text : plainText(m.text)}</AppText>
        {!mine && m.actions.length ? (
          <View style={{ gap: space.sm }} testID="action-list">
            {m.actions.length > 1 ? (
              <AppText variant="label" tone="secondary">
                {t('agent.changesTitle')}
              </AppText>
            ) : null}
            {m.actions.map((a, i) => (
              <ActionCard key={i} messageId={m.id} index={i} stored={a} />
            ))}
            {m.actions.filter((a) => a.status === 'proposed').length > 1 ? <ApplyAll m={m} /> : null}
          </View>
        ) : null}
        {!mine ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('coach.listen')} onPress={onSpeak} hitSlop={12} style={{ alignSelf: 'flex-end' }}>
            <Ionicons name="volume-medium-outline" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {m.flags.includes('crisis') ? (
        <Card tone="warning" testID="crisis-card">
          <AppText weight="bold">{t('coach.crisisTitle')}</AppText>
          <AppText>{t('coach.crisisBody')}</AppText>
          <Button testID="call-telemanas" label={t('coach.callTeleManas')} onPress={() => Linking.openURL(`tel:${HELPLINES.mentalHealth.number}`)} />
        </Card>
      ) : null}
      {m.flags.includes('emergency') ? (
        <Card tone="danger" testID="emergency-card">
          <AppText weight="bold">{t('coach.emergencyTitle')}</AppText>
          <AppText>{t('coach.emergencyBody')}</AppText>
          <Button testID="call-112" variant="danger" label={t('coach.call112')} onPress={() => Linking.openURL(`tel:${HELPLINES.emergency.number}`)} />
        </Card>
      ) : null}
    </View>
  );
}

/** One tap to confirm every change the coach proposed in this reply. */
function ApplyAll({ m }: { m: CoachMessage }) {
  const { t } = useTranslation();
  const decide = useActionDecision();
  const [busy, setBusy] = useState(false);
  const apply = async () => {
    if (busy) return;
    setBusy(true);
    try {
      for (const [index, a] of m.actions.entries()) {
        if (a.status !== 'proposed') continue;
        try {
          await decide.mutateAsync({ messageId: m.id, index, action: a.action, confirm: true });
        } catch {
          /* that action is marked failed; carry on with the rest */
        }
      }
    } finally {
      setBusy(false);
    }
  };
  return <Button testID="apply-all" label={t('agent.applyAll')} loading={busy} onPress={apply} />;
}

function ActionCard({ messageId, index, stored }: { messageId: string; index: number; stored: StoredAction }) {
  const { t } = useTranslation();
  const summary = useActionSummary();
  const decide = useActionDecision();
  const lines = summary(stored.action);
  const status = decide.isPending ? 'working' : stored.status;
  return (
    <Card tone="accent" testID={`action-${messageId}-${index}`}>
      {lines.map((l, i) => (
        <AppText key={i} weight={i === 0 ? 'bold' : undefined}>
          {l}
        </AppText>
      ))}
      {status === 'proposed' ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button testID={`action-dismiss-${index}`} variant="secondary" label={t('agent.dismiss')} onPress={() => decide.mutate({ messageId, index, action: stored.action, confirm: false })} />
          </View>
          <View style={{ flex: 1 }}>
            <Button testID={`action-confirm-${index}`} label={t('agent.confirm')} onPress={() => decide.mutate({ messageId, index, action: stored.action, confirm: true })} />
          </View>
        </View>
      ) : (
        <AppText variant="label" tone={status === 'done' ? 'accent' : status === 'failed' ? 'danger' : 'secondary'} testID={`action-status-${index}`}>
          {t(`agent.status.${status}`)}
        </AppText>
      )}
      {decide.data?.skipped.length ? <AppText variant="caption" tone="warning">{t('agent.skipped', { items: decide.data.skipped.join(', ') })}</AppText> : null}
    </Card>
  );
}
