import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { FlagsProvider, useFlags } from '../src'; // Adjust the import as per your file structure
import { Cache } from '../src/cache';

jest.mock('./cache');
const mockCache = new Cache() as jest.Mocked<Cache>;

const container = document.createElement('div');

describe('FlagsProvider', () => {
  beforeEach(() => {
    document.body.appendChild(container);
    jest.clearAllMocks();
  });

  afterEach(() => {
    container.innerHTML = '';
    document.body.removeChild(container);
  });

  it('should initialize with default flags', () => {
    act(() => {
      createRoot(container).render(
        <FlagsProvider>
          <DummyComponent />
        </FlagsProvider>
      );
    });

    expect(container.textContent).toContain('dummyFlag');
  });

  it('should toggle a flag', () => {
    act(() => {
      createRoot(container).render(
        <FlagsProvider>
          <DummyComponent />
        </FlagsProvider>
      );
    });

    const button = container.querySelector('button');
    button && act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.textContent).toContain('dummyFlag: true');
  });

  it('should initialize a new flag', () => {
    act(() => {
      createRoot(container).render(
        <FlagsProvider>
          <DummyComponent />
        </FlagsProvider>
      );
    });

    // Your logic to call initialize if required
  });

  it('should not fetch flags without required params', async () => {
    act(() => {
      createRoot(container).render(
        <FlagsProvider>
          <DummyComponent />
        </FlagsProvider>
      );
    });

    expect(mockCache.getCacheEntry).not.toHaveBeenCalled();
  });
});

// Helper component for testing hook within provider
const DummyComponent = () => {
  const { toggle, is } = useFlags();

  return (
    <div>
      <button onClick={() => toggle('dummyFlag')}>Toggle Flag</button>
      <div>{`dummyFlag: ${is('dummyFlag').enabled()}`}</div>
    </div>
  );
};