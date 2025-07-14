import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorBoundary, withErrorBoundary } from '../src/ErrorBoundary';

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

// Component to test error boundary with state changes
const BuggyCounter: React.FC = () => {
  const [count, setCount] = useState(0);
  
  if (count === 3) {
    throw new Error('Count reached 3!');
  }
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
};

describe('ErrorBoundary', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Suppress console.error for these tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Basic functionality', () => {
    it('should render children when there is no error', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should catch errors and display default fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong with the feature flags')).toBeInTheDocument();
      expect(screen.getByText('The application will continue with default behavior.')).toBeInTheDocument();
    });

    it('should display custom fallback when provided', () => {
      render(
        <ErrorBoundary fallback={<div>Custom error message</div>}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong with the feature flags')).not.toBeInTheDocument();
    });

    it('should not render anything when isolate is true and no fallback provided', () => {
      const { container } = render(
        <ErrorBoundary isolate>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render custom fallback even when isolate is true', () => {
      render(
        <ErrorBoundary isolate fallback={<div>Isolated error</div>}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Isolated error')).toBeInTheDocument();
    });
  });

  describe('Error details in development', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should show error details in development mode', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const details = screen.getByText('Error details');
      expect(details).toBeInTheDocument();
      
      // Open details
      fireEvent.click(details);
      expect(screen.getByText(/Error: Test error/)).toBeInTheDocument();
    });
  });

  describe('Error callback', () => {
    it('should call onError when an error is caught', () => {
      const onError = jest.fn();
      
      render(
        <ErrorBoundary onError={onError}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test error'
        }),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      );
    });

    it('should log error to console when onError is not provided', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Flags.gg ErrorBoundary caught an error:',
        expect.objectContaining({ message: 'Test error' }),
        expect.objectContaining({ componentStack: expect.any(String) })
      );
    });
  });

  describe('Reset functionality', () => {
    it('should reset error state when resetKeys change', () => {
      const { rerender } = render(
        <ErrorBoundary resetKeys={['key1']}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong with the feature flags')).toBeInTheDocument();

      // Change resetKeys to trigger reset
      rerender(
        <ErrorBoundary resetKeys={['key2']}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong with the feature flags')).not.toBeInTheDocument();
    });

    it('should not reset when resetKeys remain the same', () => {
      const { rerender } = render(
        <ErrorBoundary resetKeys={['key1']}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong with the feature flags')).toBeInTheDocument();

      // Same resetKeys, error should persist
      rerender(
        <ErrorBoundary resetKeys={['key1']}>
          <div>This won't show because error persists</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong with the feature flags')).toBeInTheDocument();
      expect(screen.queryByText('This won\'t show because error persists')).not.toBeInTheDocument();
    });
  });

  describe('Error during lifecycle', () => {
    it('should catch errors that occur after initial render', () => {
      render(
        <ErrorBoundary>
          <BuggyCounter />
        </ErrorBoundary>
      );

      expect(screen.getByText('Count: 0')).toBeInTheDocument();

      // Click button 3 times to trigger error
      const button = screen.getByText('Increment');
      fireEvent.click(button); // Count: 1
      fireEvent.click(button); // Count: 2
      fireEvent.click(button); // Count: 3 - triggers error

      expect(screen.getByText('Something went wrong with the feature flags')).toBeInTheDocument();
      expect(screen.queryByText('Count: 3')).not.toBeInTheDocument();
    });
  });

  describe('withErrorBoundary HOC', () => {
    it('should wrap component with error boundary', () => {
      const TestComponent: React.FC = () => <div>Test component</div>;
      const WrappedComponent = withErrorBoundary(TestComponent);

      render(<WrappedComponent />);
      expect(screen.getByText('Test component')).toBeInTheDocument();
    });

    it('should pass props to wrapped component', () => {
      interface Props {
        message: string;
      }
      const TestComponent: React.FC<Props> = ({ message }) => <div>{message}</div>;
      const WrappedComponent = withErrorBoundary(TestComponent);

      render(<WrappedComponent message="Hello world" />);
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('should use error boundary props when component throws', () => {
      const onError = jest.fn();
      const WrappedComponent = withErrorBoundary(ThrowError, {
        fallback: <div>HOC error fallback</div>,
        onError
      });

      render(<WrappedComponent />);
      
      expect(screen.getByText('HOC error fallback')).toBeInTheDocument();
      expect(onError).toHaveBeenCalled();
    });

    it('should preserve component display name', () => {
      const TestComponent: React.FC = () => <div>Test</div>;
      TestComponent.displayName = 'CustomName';
      
      const WrappedComponent = withErrorBoundary(TestComponent);
      expect(WrappedComponent.displayName).toBe('withErrorBoundary(CustomName)');
    });

    it('should use component name when displayName is not set', () => {
      const TestComponent: React.FC = () => <div>Test</div>;
      const WrappedComponent = withErrorBoundary(TestComponent);
      expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
    });
  });

  describe('Multiple error boundaries', () => {
    it('should allow nested error boundaries', () => {
      render(
        <ErrorBoundary fallback={<div>Outer error</div>}>
          <div>
            <ErrorBoundary fallback={<div>Inner error</div>}>
              <ThrowError />
            </ErrorBoundary>
            <div>Sibling content</div>
          </div>
        </ErrorBoundary>
      );

      // Inner boundary should catch the error
      expect(screen.getByText('Inner error')).toBeInTheDocument();
      expect(screen.getByText('Sibling content')).toBeInTheDocument();
      expect(screen.queryByText('Outer error')).not.toBeInTheDocument();
    });

    it('should propagate error to parent boundary if child boundary throws', () => {
      const ThrowingBoundary = () => {
        throw new Error('Boundary error');
      };

      render(
        <ErrorBoundary fallback={<div>Parent caught error</div>}>
          <ErrorBoundary fallback={<ThrowingBoundary />}>
            <ThrowError />
          </ErrorBoundary>
        </ErrorBoundary>
      );

      expect(screen.getByText('Parent caught error')).toBeInTheDocument();
    });
  });
});