import { useTranslation } from 'react-i18next';
import { Header } from '../../components/Header';
import { Card, ChoiceGroup, Screen } from '../../components/ui';
import { useTheme, type ThemeChoice } from '../../theme/ThemeProvider';

export default function AppearanceScreen() {
  const { t } = useTranslation();
  const { choice, setChoice } = useTheme();
  return (
    <Screen testID="settings-appearance">
      <Header title={t('profile.appearance')} />
      <Card>
        <ChoiceGroup<ThemeChoice>
          testID="theme"
          label={t('appearance.theme')}
          value={choice}
          onChange={setChoice}
          layout="rows"
          options={[
            { value: 'dark', label: t('options.theme.dark') },
            { value: 'light', label: t('options.theme.light') },
            { value: 'system', label: t('options.theme.system') },
          ]}
        />
      </Card>
    </Screen>
  );
}
