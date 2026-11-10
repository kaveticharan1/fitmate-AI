import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Share, View } from 'react-native';
import { AppText } from '../components/AppText';
import { Header } from '../components/Header';
import { Mascot } from '../components/Mascot';
import { Banner, Button, Card, CheckRow, ChoiceGroup, Chip, ProgressBar, Screen, TextField, ToggleRow } from '../components/ui';
import { BuddyError } from '../features/buddies/client';
import { useBuddyGroup, useCheer, useCreateGroup, useJoinGroup, useLeaveGroup, useMembership, useSetShare, useShareSettings } from '../features/buddies/hooks';
import type { BuddyMember, CheerKind } from '../features/buddies/service';
import { DEFAULT_SHARE, type ShareSettings } from '../features/buddies/summary';
import { useProfile } from '../features/profile/hooks';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';

const CHEERS: { kind: CheerKind; emoji: string }[] = [
  { kind: 'clap', emoji: '👏' },
  { kind: 'fire', emoji: '🔥' },
  { kind: 'strong', emoji: '💪' },
  { kind: 'water', emoji: '💧' },
  { kind: 'walk', emoji: '🚶' },
];
const EMOJI = Object.fromEntries(CHEERS.map((c) => [c.kind, c.emoji])) as Record<CheerKind, string>;

const errorKey = (e: unknown) => `buddies.errors.${e instanceof BuddyError ? e.kind : 'network'}`;

/** Buddy mode: a small group of friends who share a daily summary they choose. */
export default function Buddies() {
  const { t } = useTranslation();
  const { data: membership, isLoading } = useMembership();
  if (isLoading) return <Screen testID="buddies">{null}</Screen>;
  return (
    <Screen testID="buddies">
      <Header title={t('buddies.title')} />
      {membership ? <GroupView /> : <JoinOrCreate />}
    </Screen>
  );
}

function JoinOrCreate() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [displayName, setDisplayName] = useState(profile?.name ?? '');
  const [groupName, setGroupName] = useState('');
  const [code, setCode] = useState('');
  const [agree, setAgree] = useState(false);
  const [tried, setTried] = useState(false);
  const create = useCreateGroup();
  const join = useJoinGroup();
  const busy = create.isPending || join.isPending;
  const error = create.error ?? join.error;

  const nameOk = displayName.trim().length >= 1 && displayName.trim().length <= 30;
  const groupOk = groupName.trim().length >= 1 && groupName.trim().length <= 40;
  const codeOk = /^[A-Z2-9]{8}$/.test(code.replace(/[\s-]/g, '').toUpperCase());
  const valid = agree && nameOk && (mode === 'create' ? groupOk : codeOk);

  const submit = () => {
    setTried(true);
    if (!valid || busy) return;
    if (mode === 'create') create.mutate({ groupName: groupName.trim(), displayName: displayName.trim() });
    else join.mutate({ code: code.replace(/[\s-]/g, '').toUpperCase(), displayName: displayName.trim() });
  };

  return (
    <>
      <Card tone="accent" testID="buddies-intro">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Mascot size={80} mood="cheer" />
          <View style={{ flex: 1, gap: space.xs }}>
            <AppText variant="heading">{t('buddies.introTitle')}</AppText>
            <AppText variant="label" tone="secondary">
              {t('buddies.introBody')}
            </AppText>
          </View>
        </View>
      </Card>

      <Card>
        <AppText weight="bold">{t('buddies.sharedTitle')}</AppText>
        <AppText variant="label" tone="secondary">
          {t('buddies.sharedList')}
        </AppText>
        <AppText weight="bold">{t('buddies.neverTitle')}</AppText>
        <AppText variant="label" tone="secondary">
          {t('buddies.neverList')}
        </AppText>
        <AppText variant="caption" tone="muted">
          {t('buddies.whereNote')}
        </AppText>
      </Card>

      <ChoiceGroup<'create' | 'join'>
        testID="buddies-mode"
        options={[
          { value: 'create', label: t('buddies.create') },
          { value: 'join', label: t('buddies.join') },
        ]}
        value={mode}
        onChange={setMode}
      />
      <TextField
        testID="buddies-name"
        label={t('buddies.yourName')}
        hint={t('buddies.yourNameHint')}
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={30}
        error={tried && !nameOk ? t('errors.required') : undefined}
      />
      {mode === 'create' ? (
        <TextField
          testID="buddies-group-name"
          label={t('buddies.groupName')}
          placeholder={t('buddies.groupNamePlaceholder')}
          value={groupName}
          onChangeText={setGroupName}
          maxLength={40}
          error={tried && !groupOk ? t('errors.required') : undefined}
        />
      ) : (
        <TextField
          testID="buddies-code"
          label={t('buddies.code')}
          placeholder="ABCD2345"
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          maxLength={10}
          error={tried && !codeOk ? t('buddies.codeInvalid') : undefined}
        />
      )}
      <CheckRow testID="buddies-agree" label={t('buddies.agree')} value={agree} onChange={setAgree} />
      {tried && !agree ? <Banner tone="warning" text={t('buddies.agreeNeeded')} /> : null}
      {error ? <Banner tone="danger" text={t(errorKey(error))} /> : null}
      <Button testID="buddies-submit" label={mode === 'create' ? t('buddies.createButton') : t('buddies.joinButton')} onPress={submit} loading={busy} />
    </>
  );
}

function GroupView() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch, isFetching } = useBuddyGroup(true);
  const { data: share = DEFAULT_SHARE } = useShareSettings();
  const { data: profile } = useProfile();
  const setShare = useSetShare();
  const leave = useLeaveGroup();
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (isLoading) return <AppText tone="secondary">{t('buddies.loading')}</AppText>;
  if (error || !data) {
    return (
      <View style={{ gap: space.md }}>
        <Banner tone="danger" text={t(errorKey(error))} />
        <Button testID="buddies-retry" variant="secondary" label={t('buddies.retry')} onPress={() => refetch()} />
        {error instanceof BuddyError && error.kind === 'not_member' ? (
          <Button testID="buddies-forget" variant="danger" label={t('buddies.leave')} onPress={() => leave.mutate()} />
        ) : null}
      </View>
    );
  }
  const others = data.members.filter((m) => m.id !== data.me);
  const me = data.members.find((m) => m.id === data.me);
  const toggle = (k: keyof ShareSettings) => (v: boolean) => setShare.mutate({ ...share, [k]: v });

  return (
    <>
      <Card tone="accent" testID="buddies-group">
        <AppText variant="heading">{data.group.name}</AppText>
        <AppText variant="label" tone="secondary">
          {t('buddies.members', { count: data.members.length })}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {t('buddies.inviteCode')}
        </AppText>
        <AppText variant="title" selectable testID="buddies-invite-code" style={{ letterSpacing: 3 }}>
          {data.group.code}
        </AppText>
        <Button
          testID="buddies-share-code"
          variant="secondary"
          label={t('buddies.invite')}
          onPress={() => Share.share({ message: t('buddies.inviteMessage', { group: data.group.name, code: data.group.code }) }).catch(() => undefined)}
        />
      </Card>

      {data.cheers.length ? (
        <Card testID="buddies-cheers">
          <AppText weight="bold">{t('buddies.cheersForYou')}</AppText>
          {data.cheers.slice(0, 5).map((c, i) => (
            <AppText key={i} variant="label" tone="secondary">
              {`${EMOJI[c.kind] ?? '👏'}  ${t('buddies.cheerFrom', { name: c.from })} · ${ago(t, c.at)}`}
            </AppText>
          ))}
        </Card>
      ) : null}

      {me ? <MemberCard m={me} mine /> : null}
      {others.length ? (
        others.map((m) => <MemberCard key={m.id} m={m} />)
      ) : (
        <Card testID="buddies-empty">
          <AppText tone="secondary">{t('buddies.noFriendsYet')}</AppText>
        </Card>
      )}
      <Button testID="buddies-refresh" variant="ghost" label={isFetching ? t('buddies.loading') : t('buddies.refresh')} onPress={() => refetch()} />

      <Card testID="buddies-share-settings">
        <AppText weight="bold">{t('buddies.shareTitle')}</AppText>
        <ToggleRow testID="share-steps" label={t('buddies.share.steps')} value={share.steps} onChange={toggle('steps')} />
        <ToggleRow testID="share-workouts" label={t('buddies.share.workouts')} value={share.workouts} onChange={toggle('workouts')} />
        <ToggleRow testID="share-water" label={t('buddies.share.water')} value={share.water} onChange={toggle('water')} />
        <ToggleRow testID="share-streak" label={t('buddies.share.streak')} value={share.streak} onChange={toggle('streak')} />
        {profile?.hasEatingDisorderHistory ? null : (
          <ToggleRow
            testID="share-weight"
            label={t('buddies.share.weightTrend')}
            description={t('buddies.share.weightHint')}
            value={share.weightTrend}
            onChange={toggle('weightTrend')}
          />
        )}
      </Card>

      <Button
        testID="buddies-leave"
        variant="danger"
        label={confirmLeave ? t('buddies.leaveConfirm') : t('buddies.leave')}
        loading={leave.isPending}
        onPress={() => (confirmLeave ? leave.mutate() : setConfirmLeave(true))}
      />
      {leave.error ? <Banner tone="danger" text={t(errorKey(leave.error))} /> : null}
      <AppText variant="caption" tone="muted">
        {t('buddies.leaveNote')}
      </AppText>
    </>
  );
}

function ago(t: TFunction, iso: string | null): string {
  if (!iso) return t('buddies.notSynced');
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 1) return t('buddies.justNow');
  if (min < 60) return t('buddies.minAgo', { count: min });
  const h = Math.round(min / 60);
  if (h < 24) return t('buddies.hoursAgo', { count: h });
  return t('buddies.daysAgo', { count: Math.round(h / 24) });
}

function MemberCard({ m, mine }: { m: BuddyMember; mine?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const cheer = useCheer();
  const [sent, setSent] = useState<CheerKind | null>(null);
  const s = m.summary ?? {};
  const today = new Date();
  const isToday = m.day === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const trend = s.weightTrend ? { down: '↓', steady: '→', up: '↑' }[s.weightTrend] : null;
  return (
    <Card testID={`buddy-${mine ? 'me' : m.id}`} style={mine ? { borderColor: colors.accent } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <AppText weight="bold" tone="accent">
            {m.name.charAt(0).toUpperCase()}
          </AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText weight="bold">{mine ? t('buddies.you', { name: m.name }) : m.name}</AppText>
          <AppText variant="caption" tone="muted">
            {ago(t, m.updatedAt)}
          </AppText>
        </View>
        {isToday && s.loggedToday ? <Chip label={t('buddies.loggedToday')} tone="success" /> : null}
      </View>

      {!m.summary ? (
        <AppText variant="label" tone="secondary">
          {t('buddies.nothingYet')}
        </AppText>
      ) : (
        <View style={{ gap: space.sm }}>
          {isToday && s.steps != null && s.stepGoal ? (
            <View style={{ gap: 4 }}>
              <AppText variant="label">{t('buddies.stat.steps', { steps: s.steps.toLocaleString('en-IN'), goal: s.stepGoal.toLocaleString('en-IN') })}</AppText>
              <ProgressBar value={s.steps / s.stepGoal} color={colors.success} />
            </View>
          ) : null}
          {isToday && s.waterPct != null ? (
            <View style={{ gap: 4 }}>
              <AppText variant="label">{t('buddies.stat.water', { pct: s.waterPct })}</AppText>
              <ProgressBar value={s.waterPct / 100} color={colors.info} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {s.workoutsWeek != null ? <Chip label={t('buddies.stat.workouts', { count: s.workoutsWeek })} tone="accent" /> : null}
            {s.waterDaysWeek != null ? <Chip label={t('buddies.stat.waterDays', { count: s.waterDaysWeek })} tone="info" /> : null}
            {s.streak ? <Chip label={t('buddies.stat.streak', { count: s.streak })} tone="warning" /> : null}
            {trend ? <Chip label={t('buddies.stat.weight', { arrow: trend })} tone="neutral" /> : null}
          </View>
        </View>
      )}

      {!mine ? (
        <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
          {CHEERS.map((c) => (
            <Pressable
              key={c.kind}
              testID={`cheer-${m.id}-${c.kind}`}
              accessibilityRole="button"
              accessibilityLabel={t(`buddies.cheer.${c.kind}`, { name: m.name })}
              disabled={cheer.isPending}
              onPress={() => {
                if (cheer.isPending) return;
                cheer.mutate({ to: m.id, kind: c.kind }, { onSuccess: () => setSent(c.kind) });
              }}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed || sent === c.kind ? colors.accentSoft : colors.surfaceRaised,
              })}
            >
              <AppText>{c.emoji}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
      {sent ? (
        <AppText variant="caption" tone="accent">
          {t('buddies.cheerSent', { name: m.name })}
        </AppText>
      ) : null}
      {cheer.error ? <Banner tone="danger" text={t(errorKey(cheer.error))} /> : null}
    </Card>
  );
}
