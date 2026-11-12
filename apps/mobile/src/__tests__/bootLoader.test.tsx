import { render, screen } from '@testing-library/react-native';
import { BootLoader } from '../components/BootLoader';

describe('Opening animation', () => {
  it('shows the jogging FitMate loader with an accessible label', async () => {
    await render(<BootLoader />);
    expect(screen.getByTestId('boot-loader')).toBeTruthy();
    expect(screen.getByLabelText('Loading FitMate')).toBeTruthy();
    expect(screen.getByText('FitMate')).toBeTruthy();
  });

  it('stops its animation when it goes away', async () => {
    const r = await render(<BootLoader />);
    await r.unmount();
    expect(screen.queryByTestId('boot-loader')).toBeNull();
  });
});
