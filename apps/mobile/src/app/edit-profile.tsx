import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { profileRowToInput, ProfileWizard } from '../features/profile/ProfileWizard';
import { useProfile, useSaveProfile } from '../features/profile/hooks';

export default function EditProfile() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const save = useSaveProfile();
  if (!profile) return null;
  return (
    <ProfileWizard
      initial={profileRowToInput(profile)}
      submitLabel={t('common.save')}
      onCancel={() => router.back()}
      onSubmit={async (p) => {
        await save.mutateAsync(p);
        router.back();
      }}
    />
  );
}
