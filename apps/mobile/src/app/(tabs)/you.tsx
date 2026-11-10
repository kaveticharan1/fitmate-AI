import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button, ChoiceGroup, ListGroup, ListRow, Screen } from '../../components/ui';
import { useProfile } from '../../features/profile/hooks';
import { setAppLanguage, type AppLanguage } from '../../i18n';
import { useSession } from '../../security/SessionProvider';
import { space } from '../../theme/tokens';

export default function You() {
  const { t, i18n } = useTranslation();
  const { data: profile } = useProfile();
  const { lock } = useSession();
  return (
    <Screen testID="you">
      <View style={{ gap: space.xs, paddingTop: space.sm }}>
        <AppText variant="title">{profile?.name ?? t('profile.title')}</AppText>
        {profile ? (
          <AppText tone="secondary">
            {t(`options.goal.${profile.goal}`)} · {t(`options.coach.${profile.coachPersonality}`)}
          </AppText>
        ) : null}
      </View>

      <ListGroup>
        <ListRow testID="row-edit" label={t('profile.edit')} onPress={() => router.push('/edit-profile')} />
        <ListRow testID="row-ai" label={t('coach.settingsTitle')} onPress={() => router.push('/settings/ai')} />
        <ListRow testID="row-buddies" label={t('buddies.title')} onPress={() => router.push('/buddies')} />
        <ListRow testID="row-wellness" label={t('wellness.title')} onPress={() => router.push('/wellness')} />
        <ListRow testID="row-health" label={t('health.title')} onPress={() => router.push('/settings/health')} />
        <ListRow testID="row-reminders" label={t('reminders.title')} onPress={() => router.push('/settings/reminders')} />
        <ListRow testID="row-security" label={t('profile.security')} onPress={() => router.push('/settings/security')} />
        <ListRow testID="row-backup" label={t('profile.backup')} onPress={() => router.push('/settings/backup')} />
        <ListRow testID="row-privacy" label={t('profile.privacy')} onPress={() => router.push('/settings/privacy')} />
        <ListRow testID="row-appearance" label={t('profile.appearance')} onPress={() => router.push('/settings/appearance')} />
      </ListGroup>

      <ChoiceGroup<AppLanguage>
        label={t('profile.language')}
        value={i18n.language as AppLanguage}
        onChange={(l) => setAppLanguage(l)}
        options={[
          { value: 'en', label: t('options.language.en') },
          { value: 'te', label: t('options.language.te') },
        ]}
      />

      <Button testID="lock-now" variant="secondary" label={t('profile.lockNow')} onPress={lock} />

      <AppText variant="caption" tone="muted" center>
        {t('profile.aboutApp')} · {t('common.version', { version: Constants.expoConfig?.version ?? '0.1.0' })}
      </AppText>
    </Screen>
  );
}
