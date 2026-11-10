import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Gradient } from '../../components/glow';
import { Mascot } from '../../components/Mascot';
import { Button, Chip } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';
import { useAiStatus } from '../coach/hooks';

/** Home hero: the coach mascot, whether the coach is active, and today's adaptive plan. */
export function AgentCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: ai } = useAiStatus();
  const on = !!ai?.connected;
  return (
    <View
      testID="agent-card"
      style={{ borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassBorder, padding: space.lg, gap: space.md }}
    >
      <Gradient from={colors.accentSoft} to={colors.surface} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Mascot size={92} mood={on ? 'happy' : 'thinking'} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Chip label={on ? t('agentCard.active') : t('agentCard.off')} tone={on ? 'success' : 'neutral'} testID="agent-status" />
          <AppText variant="heading">{t('agentCard.title')}</AppText>
          <AppText variant="label" tone="secondary">
            {on ? t('agentCard.bodyOn') : t('agentCard.bodyOff')}
          </AppText>
        </View>
      </View>
      <Button testID="open-today" label={t('agentCard.viewPlan')} onPress={() => router.push('/today')} />
      {!on ? <Button testID="agent-setup" variant="secondary" label={t('coach.setupButton')} onPress={() => router.push('/settings/ai')} /> : null}
    </View>
  );
}
