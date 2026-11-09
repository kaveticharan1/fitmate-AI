import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, ListGroup, ListRow, Screen, ToggleRow } from '../../components/ui';
import { getSetting, setSetting } from '../../db/repositories';
import { useState } from 'react';
import { useAiStatus } from '../../features/coach/hooks';
import { openCoach } from '../../features/coach/open';
import { useFaceInsights } from '../../features/face/hooks';
import { PUFFINESS } from '../../features/face/logic';
import { useRoutineDone, useRoutineSteps, useSkinProfile } from '../../features/skin/hooks';
import { addDays, localDate } from '../../lib/time';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/tokens';

export default function WellnessHome() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: face } = useFaceInsights();
  const { data: skin } = useSkinProfile();
  const { data: steps = [] } = useRoutineSteps();
  const { data: done = [] } = useRoutineDone();
  const { data: ai } = useAiStatus();
  const [share, setShare] = useState(() => getSetting<boolean>('wellnessShareWithCoach', true));
  const today = localDate();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));

  return (
    <Screen testID="wellness">
      <Header title={t('wellness.title')} />
      <AppText tone="secondary">{t('wellness.intro')}</AppText>

      {face?.escalation === 'emergency' ? (
        <Card tone="danger" testID="wellness-emergency">
          <AppText weight="bold">{t('face.emergencyTitle')}</AppText>
          <AppText>{t('face.emergencyBody')}</AppText>
          <Button variant="danger" label={t('coach.call112')} onPress={() => Linking.openURL('tel:112')} />
        </Card>
      ) : face?.escalation === 'doctor' ? (
        <Banner tone="warning" text={t('face.doctorNote')} />
      ) : null}

      <Card testID="today-face">
        <AppText variant="heading">{t('wellness.today')}</AppText>
        {face?.today ? (
          <AppText testID="today-puffiness">{t('wellness.todayRating', { level: t(`face.level.${PUFFINESS[face.today.puffiness]}`) })}</AppText>
        ) : (
          <AppText tone="secondary">{t('wellness.noCheckin')}</AppText>
        )}
        <Button testID="open-checkin" label={face?.today ? t('wellness.editCheckin') : t('wellness.checkIn')} onPress={() => router.push('/wellness/checkin')} />
      </Card>

      <Card testID="puffiness-trend">
        <AppText variant="heading">{t('wellness.trend')}</AppText>
        {face && face.checkins.length ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 70, gap: 3 }}>
              {days.map((d) => {
                const c = face.checkins.find((x) => x.day === d);
                return (
                  <View
                    key={d}
                    accessibilityLabel={`${d}: ${c ? t(`face.level.${PUFFINESS[c.puffiness]}`) : t('wellness.noData')}`}
                    style={{ flex: 1, height: c ? 8 + c.puffiness * 20 : 4, borderRadius: radius.sm, backgroundColor: c ? colors.accent : colors.border, opacity: c ? 1 : 0.5 }}
                  />
                );
              })}
            </View>
            {face.avg7 != null ? (
              <AppText testID="avg-week">
                {face.avgPrev7 != null ? t('wellness.avgCompare', { now: face.avg7, prev: face.avgPrev7 }) : t('wellness.avg', { now: face.avg7 })}
              </AppText>
            ) : null}
            <AppText variant="caption" tone="muted">
              {t('wellness.scaleNote')}
            </AppText>
          </>
        ) : (
          <AppText tone="secondary">{t('wellness.noTrend')}</AppText>
        )}
      </Card>

      <Card testID="patterns">
        <AppText variant="heading">{t('wellness.patterns')}</AppText>
        {face?.associations.length ? (
          face.associations.map((a) => (
            <AppText key={a.factor} testID={`pattern-${a.factor}`}>
              {`• ${t(`wellness.assoc.${a.factor}`, { withAvg: a.withAvg, withoutAvg: a.withoutAvg, days: a.withDays })}`}
            </AppText>
          ))
        ) : (
          <AppText tone="secondary">{t('wellness.noPatterns')}</AppText>
        )}
        <AppText variant="caption" tone="muted">
          {t('wellness.patternNote')}
        </AppText>
      </Card>

      <Card testID="skin-summary">
        <AppText variant="heading">{t('wellness.skin')}</AppText>
        {skin ? (
          <>
            <AppText>{t('wellness.skinType', { type: t(`skin.types.${skin.skinType}`) })}</AppText>
            {skin.concerns.length ? <AppText tone="secondary">{skin.concerns.map((c) => t(`skin.concern.${c}`)).join(', ')}</AppText> : null}
            {steps.length ? (
              <AppText tone="secondary">
                {t('wellness.routineToday', {
                  am: done.some((d) => d.day === today && d.slot === 'am') ? '✓' : '—',
                  pm: done.some((d) => d.day === today && d.slot === 'pm') ? '✓' : '—',
                })}
              </AppText>
            ) : null}
          </>
        ) : (
          <AppText tone="secondary">{t('wellness.noSkin')}</AppText>
        )}
      </Card>

      <ListGroup>
        <ListRow testID="go-photos" label={t('face.photosTitle')} value={face?.photoCount ? String(face.photoCount) : undefined} onPress={() => router.push('/wellness/photos')} />
        <ListRow testID="go-skin-profile" label={t('skin.profileTitle')} onPress={() => router.push('/wellness/skin-profile')} />
        <ListRow testID="go-routine" label={t('skin.routineTitle')} onPress={() => router.push('/wellness/routine')} />
        <ListRow testID="go-ingredients" label={t('skin.ingredientsTitle')} onPress={() => router.push('/wellness/ingredients')} />
        <ListRow testID="go-report" label={t('wellness.reportTitle')} onPress={() => router.push('/wellness/report')} />
      </ListGroup>
      {ai?.connected ? (
        <ToggleRow
          testID="wellness-share"
          label={t('wellness.share')}
          value={share}
          onChange={(v) => {
            setSetting('wellnessShareWithCoach', v);
            setShare(v);
          }}
        />
      ) : null}
      {ai?.connected ? (
        <Button testID="wellness-coach" variant="secondary" label={t('wellness.askCoach')} onPress={() => openCoach({ prefill: t('wellness.askCoachPrompt') })} />
      ) : null}
      <AppText variant="caption" tone="muted">
        {t('wellness.disclaimer')}
      </AppText>
    </Screen>
  );
}
