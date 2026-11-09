import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space, TOUCH } from '../../theme/tokens';
import { mealForTime, openCoach } from './open';

/** Home: one tap to ask the coach, photograph a meal, or speak. */
export function AskCoachBar() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const round = { width: TOUCH + 4, height: TOUCH + 4, borderRadius: (TOUCH + 4) / 2, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.surfaceRaised };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }} testID="ask-coach-bar">
      <Pressable
        testID="ask-coach"
        accessibilityRole="button"
        accessibilityLabel={t('home.askCoach')}
        onPress={() => openCoach()}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          height: TOUCH + 4,
          paddingHorizontal: space.md,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
        })}
      >
        <Ionicons name="sparkles-outline" size={20} color={colors.accent} />
        <AppText tone="muted" numberOfLines={1} style={{ flex: 1 }}>
          {t('home.askCoach')}
        </AppText>
      </Pressable>
      <Pressable
        testID="ask-photo"
        accessibilityRole="button"
        accessibilityLabel={t('home.photoMeal')}
        onPress={() => router.push({ pathname: '/food/photo', params: { meal: mealForTime() } })}
        style={round}
      >
        <Ionicons name="camera-outline" size={22} color={colors.text} />
      </Pressable>
      <Pressable testID="ask-voice" accessibilityRole="button" accessibilityLabel={t('home.speakCoach')} onPress={() => openCoach({ listen: true })} style={round}>
        <Ionicons name="mic-outline" size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}
