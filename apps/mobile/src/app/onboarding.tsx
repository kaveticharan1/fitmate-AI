import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EMPTY_PROFILE, ProfileWizard } from '../features/profile/ProfileWizard';
import { useSaveProfile } from '../features/profile/hooks';
import { useSession } from '../security/SessionProvider';

export default function Onboarding() {
  const { t, i18n } = useTranslation();
  const save = useSaveProfile();
  const { refreshProfile } = useSession();
  return (
    <ProfileWizard
      initial={{ ...EMPTY_PROFILE, aiLanguage: i18n.language === 'te' ? 'te' : 'en' }}
      submitLabel={t('onboarding.finish')}
      onSubmit={async (p) => {
        await save.mutateAsync(p);
        refreshProfile();
        router.replace('/');
      }}
    />
  );
}
