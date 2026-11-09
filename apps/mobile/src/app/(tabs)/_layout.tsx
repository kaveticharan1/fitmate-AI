import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Five tabs: Home, Food, Coach, Workout, You. Plan and Progress are still
 * screens in this group (reached from Home and Food) but have no tab of their own.
 */
function TabIcon({ color, focused, name, active }: { color: unknown; focused: boolean; name: IconName; active: IconName }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: 56, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.accentSoft : 'transparent' }}>
      <Ionicons name={focused ? active : name} color={color as string} size={22} />
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 68, paddingTop: 6, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="home-outline" active="home" /> }} />
      <Tabs.Screen name="food" options={{ title: t('tabs.food'), tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="restaurant-outline" active="restaurant" /> }} />
      <Tabs.Screen name="coach" options={{ title: t('tabs.coach'), tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="sparkles-outline" active="sparkles" /> }} />
      <Tabs.Screen name="workout" options={{ title: t('tabs.workout'), tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="barbell-outline" active="barbell" /> }} />
      <Tabs.Screen name="you" options={{ title: t('profile.title'), tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="person-circle-outline" active="person-circle" /> }} />
      <Tabs.Screen name="plan" options={{ href: null, title: t('tabs.plan') }} />
      <Tabs.Screen name="progress" options={{ href: null, title: t('tabs.progress') }} />
    </Tabs>
  );
}
