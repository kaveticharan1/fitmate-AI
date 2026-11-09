import { Ionicons } from '@expo/vector-icons';
import { HELPLINES, plainText } from '@fitmate/coach';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, TextInput, View } from 'react-native';
import { AppText } from '../components/AppText';
import { Header } from '../components/Header';
import { Banner, Button, Card, Screen } from '../components/ui';
import type { CoachMessage } from '../db/coachRepo';
import { coachErrorKey } from '../features/coach/errors';
import { useAiStatus, useCoachMessages, useReadAloud, useSendMessage, useSetReadAloud } from '../features/coach/hooks';
import { speakReply, stopSpeaking, useVoiceInput, type VoiceLang } from '../features/coach/voice';
import { useProfile } from '../features/profile/hooks';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, TOUCH } from '../theme/tokens';

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
  const [draft, setDraft] = useState('');
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const lang: VoiceLang = profile?.aiLanguage === 'te' ? 'te' : 'en';
  const voice = useVoiceInput(lang, (text) => setDraft((d) => (d.trim() ? `${d.trim()} ${text}` : text)));

  useEffect(() => () => stopSpeaking(), []);

  if (status && !status.connected) {
    return (
      <Screen testID="coach">
        <Header title={t('coach.title')} />
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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Header title={t('coach.title')} />
        </View>
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
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ gap: space.md, paddingBottom: space.md }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        <AppText variant="caption" tone="muted" center>
          {t('coach.disclaimer')}
        </AppText>
        {messages.length === 0 ? (
          <View style={{ gap: space.sm }} testID="suggestions">
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
          <AppText tone="secondary" testID="typing">
            {t('coach.typing')}
          </AppText>
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
          backgroundColor: mine ? colors.accentSoft : colors.surface,
          borderRadius: radius.lg,
          padding: space.md,
          gap: space.xs,
        }}
      >
        <AppText selectable>{mine ? m.text : plainText(m.text)}</AppText>
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
