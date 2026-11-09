import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { space, TOUCH } from '../theme/tokens';
import { AppText } from './AppText';

export function Header({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginLeft: -space.sm }}>
      <Pressable
        testID="header-back"
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/you'))}
        style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <AppText variant="title" style={{ flex: 1 }}>
        {title}
      </AppText>
    </View>
  );
}
