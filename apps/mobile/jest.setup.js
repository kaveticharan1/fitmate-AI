/* global jest */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Native date picker: pressing the mock picks the date stored in global.__pickDate.
jest.mock('@react-native-community/datetimepicker', () => {
  const { Pressable } = require('react-native');
  const pick = (onChange) => onChange({ type: 'set' }, global.__pickDate);
  const Picker = ({ onChange }) => require('react').createElement(Pressable, { testID: 'mock-date-picker', onPress: () => pick(onChange) });
  return { __esModule: true, default: Picker, DateTimePickerAndroid: { open: ({ onChange }) => pick(onChange) } };
});

// Health Connect is a native Android module; tests get an "unavailable" stub unless they mock it themselves.
jest.mock('react-native-health-connect', () => ({
  SdkAvailabilityStatus: { SDK_UNAVAILABLE: 1, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2, SDK_AVAILABLE: 3 },
  getSdkStatus: jest.fn(async () => 1),
  initialize: jest.fn(async () => true),
  requestPermission: jest.fn(async () => []),
  getGrantedPermissions: jest.fn(async () => []),
  aggregateGroupByPeriod: jest.fn(async () => []),
  aggregateRecord: jest.fn(async () => ({})),
  readRecords: jest.fn(async () => ({ records: [] })),
  openHealthConnectSettings: jest.fn(),
}));

// Native notifications: a quiet stub; tests that check scheduling mock it themselves.
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
  SchedulableTriggerInputTypes: { DAILY: 'daily', WEEKLY: 'weekly', DATE: 'date' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationCategoryAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
}));

// Background tasks: no-ops in tests.
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn(), isTaskRegisteredAsync: jest.fn(async () => false) }));
jest.mock('expo-background-task', () => ({
  BackgroundTaskStatus: { Restricted: 1, Available: 2 },
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  getStatusAsync: jest.fn(async () => 2),
  registerTaskAsync: jest.fn(async () => undefined),
  unregisterTaskAsync: jest.fn(async () => undefined),
}));
