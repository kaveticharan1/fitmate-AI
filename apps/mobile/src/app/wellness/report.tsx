import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Card, Screen } from '../../components/ui';
import { useFaceInsights, usePhotos } from '../../features/face/hooks';
import { AREAS, TIMES } from '../../features/face/logic';
import { useRoutineDone, useRoutineSteps } from '../../features/skin/hooks';
import { addDays, localDate } from '../../lib/time';
import { space } from '../../theme/tokens';

/** Most common value in a list, or null. */
function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  for (const [k, n] of counts) if (!best || n > counts.get(best)!) best = k;
  return best;
}

export default function WellnessReport() {
  const { t } = useTranslation();
  const { data: face } = useFaceInsights();
  const { data: photos = [] } = usePhotos();
  const { data: done = [] } = useRoutineDone();
  const { data: steps = [] } = useRoutineSteps();
  const start = addDays(localDate(), -6);
  const week = (face?.checkins ?? []).filter((c) => c.day >= start);
  const area = mostCommon(week.flatMap((c) => c.areas).filter((a) => (AREAS as readonly string[]).includes(a)));
  const time = mostCommon(week.map((c) => c.timeOfDay ?? '').filter((x) => (TIMES as readonly string[]).includes(x)));
  const weekPhotos = photos.filter((p) => p.takenOn >= start);
  const row = (label: string, value: string, testID?: string) => (
    <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }} testID={testID}>
      <AppText tone="secondary" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText weight="bold" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </AppText>
    </View>
  );
  const none = t('report.noData');

  return (
    <Screen testID="wellness-report">
      <Header title={t('wellness.reportTitle')} />
      <Card>
        <AppText variant="heading">{t('wellness.reportFace')}</AppText>
        {row(t('wellness.checkins'), `${week.length} / 7`, 'report-checkins')}
        {row(t('wellness.avgPuff'), face?.avg7 != null ? `${face.avg7} / 3` : none, 'report-avg')}
        {row(t('wellness.lastWeek'), face?.avgPrev7 != null ? `${face.avgPrev7} / 3` : none)}
        {row(t('wellness.commonArea'), area ? t(`face.area.${area}`) : none)}
        {row(t('wellness.commonTime'), time ? t(`face.time.${time}`) : none)}
        {row(t('wellness.photos'), String(weekPhotos.length))}
      </Card>
      <Card>
        <AppText variant="heading">{t('wellness.patterns')}</AppText>
        {face?.associations.length ? (
          face.associations.map((a) => <AppText key={a.factor}>{`• ${t(`wellness.assoc.${a.factor}`, { withAvg: a.withAvg, withoutAvg: a.withoutAvg, days: a.withDays })}`}</AppText>)
        ) : (
          <AppText tone="secondary">{t('wellness.noPatterns')}</AppText>
        )}
      </Card>
      <Card>
        <AppText variant="heading">{t('wellness.reportSkin')}</AppText>
        {steps.length ? (
          <>
            {row(t('skin.slot.am'), `${done.filter((d) => d.slot === 'am').length} / 7`, 'report-am')}
            {row(t('skin.slot.pm'), `${done.filter((d) => d.slot === 'pm').length} / 7`, 'report-pm')}
          </>
        ) : (
          <AppText tone="secondary">{t('skin.noRoutine')}</AppText>
        )}
      </Card>
      <AppText variant="caption" tone="muted">
        {t('wellness.reportNote')}
      </AppText>
    </Screen>
  );
}
