import { BackupFormatError, BackupPasswordError } from '@fitmate/core';
import { backupPasswordSchema } from '@fitmate/validation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { AppText } from '../../components/AppText';
import { Header } from '../../components/Header';
import { Banner, Button, Card, Screen, TextField, useErrorText } from '../../components/ui';
import { exportEncryptedBackup, pickBackupFile, restoreEncryptedBackup } from '../../features/backup/backupService';
import { SnapshotError } from '../../features/backup/snapshot';
import { useSession } from '../../security/SessionProvider';

export default function BackupScreen() {
  const { t } = useTranslation();
  return (
    <Screen testID="settings-backup">
      <Header title={t('profile.backup')} />
      <AppText tone="secondary">{t('backup.intro')}</AppText>
      <CreateBackup />
      <RestoreBackup />
    </Screen>
  );
}

function CreateBackup() {
  const { t } = useTranslation();
  const errText = useErrorText();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; general?: string }>({});
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const r = backupPasswordSchema.safeParse({ password, confirm });
    if (!r.success) {
      const e: typeof errors = {};
      for (const i of r.error.issues) e[i.path[0] as 'password' | 'confirm'] ??= errText(i.message);
      setErrors(e);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      // Let the "Encrypting…" state render before the CPU-heavy key derivation starts.
      await new Promise((res) => setTimeout(res, 50));
      await exportEncryptedBackup(password, t('backup.shareTitle'));
      setPassword('');
      setConfirm('');
    } catch {
      setErrors({ general: t('errors.generic') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <TextField testID="backup-password" label={t('backup.password')} value={password} onChangeText={(v) => { setPassword(v); setErrors({}); }} secureTextEntry autoCapitalize="none" error={errors.password} />
      <TextField testID="backup-confirm" label={t('backup.confirm')} value={confirm} onChangeText={(v) => { setConfirm(v); setErrors({}); }} secureTextEntry autoCapitalize="none" error={errors.confirm} />
      <AppText variant="caption" tone="warning">
        {t('backup.noRecovery')}
      </AppText>
      {errors.general ? <Banner tone="danger" text={errors.general} /> : null}
      <Button testID="backup-create" label={busy ? t('backup.creating') : t('backup.create')} onPress={create} loading={busy} />
    </Card>
  );
}

function RestoreBackup() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { refreshProfile } = useSession();
  const [file, setFile] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ tone: 'accent' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    setMessage(null);
    try {
      const r = await pickBackupFile();
      if (r.kind === 'picked') setFile({ bytes: r.bytes, name: r.name });
    } catch {
      setMessage({ tone: 'danger', text: t('errors.generic') });
    }
  };

  const doRestore = async () => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      await new Promise((res) => setTimeout(res, 50));
      const { rows } = restoreEncryptedBackup(file.bytes, password);
      await qc.invalidateQueries();
      refreshProfile();
      setMessage({ tone: 'accent', text: t('backup.restored', { count: rows }) });
      setFile(null);
      setPassword('');
    } catch (e) {
      const text =
        e instanceof BackupPasswordError
          ? t('backup.wrongPassword')
          : e instanceof BackupFormatError || e instanceof SnapshotError
            ? t('backup.notBackup')
            : t('errors.generic');
      setMessage({ tone: 'danger', text });
    } finally {
      setBusy(false);
    }
  };

  const confirmRestore = () =>
    Alert.alert(t('backup.restoreTitle'), t('backup.restoreBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('backup.restore'), style: 'destructive', onPress: doRestore },
    ]);

  return (
    <Card>
      <AppText variant="heading">{t('backup.restoreTitle')}</AppText>
      <AppText variant="label" tone="secondary">
        {t('backup.restoreBody')}
      </AppText>
      <Button testID="backup-choose" variant="secondary" label={t('backup.choose')} onPress={choose} />
      {file ? (
        <>
          <AppText variant="caption" tone="secondary">
            {t('backup.chosen', { name: file.name })}
          </AppText>
          <TextField label={t('backup.password')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
          <Button testID="backup-restore" label={busy ? t('backup.restoring') : t('backup.restore')} onPress={confirmRestore} loading={busy} disabled={password.length === 0} />
        </>
      ) : null}
      {message ? <Banner tone={message.tone} text={message.text} /> : null}
    </Card>
  );
}
