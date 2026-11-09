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
  readRecords: jest.fn(async () => ({ records: [] })),
  openHealthConnectSettings: jest.fn(),
}));
