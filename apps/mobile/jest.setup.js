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
