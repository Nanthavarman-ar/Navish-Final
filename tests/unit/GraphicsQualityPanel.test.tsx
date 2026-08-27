import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import GraphicsQualityPanel, { QualityLevel } from '../../components/GraphicsQualityPanel';

const Wrapper: React.FC<{ initial?: QualityLevel }> = ({ initial = 'auto' }) => {
  const [value, setValue] = React.useState<QualityLevel>(initial);
  return (
    <GraphicsQualityPanel
      value={value}
      onChange={setValue}
      recommended="high"
      gpuName="Mock GPU 3000"
      capabilities={{ mobile: false, cpuCores: 8, ram: 16384 }}
    />
  );
};

describe('GraphicsQualityPanel', () => {
  it('renders all five quality options', () => {
    render(<Wrapper />);
    expect(screen.getByText('Auto')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Ultra')).toBeInTheDocument();
  });

  it('shows the recommended tier hint on Auto and marks Auto pressed by default', () => {
    render(<Wrapper />);
    expect(screen.getByText('recommends high')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Auto/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches selection and highlights the newly picked tier when clicked', () => {
    render(<Wrapper />);
    const lowButton = screen.getByRole('button', { name: /Low/ });
    expect(lowButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(lowButton);

    expect(lowButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Auto/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows GPU name and device info', () => {
    render(<Wrapper />);
    expect(screen.getByText(/Mock GPU 3000/)).toBeInTheDocument();
    expect(screen.getByText(/Desktop device/)).toBeInTheDocument();
    expect(screen.getByText(/8 cores/)).toBeInTheDocument();
    expect(screen.getByText(/16GB RAM/)).toBeInTheDocument();
  });
});
