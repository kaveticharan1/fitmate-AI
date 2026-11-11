import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button, Card } from '../../components/ui';
import { space } from '../../theme/tokens';
import { useUpdateCheck } from './hooks';
import { canSelfUpdate, toMb } from './updates';

/** Shows on Home only when a newer FitMate is out (and the phone can update in-app). */
export function UpdateBanner() {
  return canSelfUpdate() ? <UpdateBannerInner /> : null;
}

function UpdateBannerInner() {
  const { t } = useTranslation();
  const { data } = useUpdateCheck();
  if (!data?.available) return null;
  const mb = toMb(data.latest.bytes);
  return (
    <Card tone="accent" testID="update-banner">
      <View style={{ gap: space.xs }}>
        <AppText weight="bold">{t('update.bannerTitle', { version: data.latest.version })}</AppText>
        <AppText variant="label" tone="secondary">
          {mb ? t('update.bannerBodySize', { mb }) : t('update.bannerBody')}
        </AppText>
      </View>
      <Button testID="update-banner-go" label={t('update.downloadInstall')} onPress={() => router.push({ pathname: '/update', params: { start: '1' } })} />
    </Card>
  );
}
