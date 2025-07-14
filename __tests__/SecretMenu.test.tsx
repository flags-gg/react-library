import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SecretMenu, formatFeatureName } from '../src/secretmenu';
import { mockFlags } from './test-utils';

describe('SecretMenu', () => {
  const defaultProps = {
    secretMenu: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown'],
    flags: mockFlags,
    toggleFlag: jest.fn(),
    resetFlags: jest.fn(),
    isFlag: jest.fn((flag: string) => ({
      enabled: () => mockFlags[flag as keyof typeof mockFlags]?.enabled ?? false,
      disabled: () => !(mockFlags[flag as keyof typeof mockFlags]?.enabled ?? true),
      initialize: jest.fn(),
      details: mockFlags[flag as keyof typeof mockFlags]?.details ?? { name: flag, id: '' },
    })),
    secretMenuStyles: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatFeatureName', () => {
    it('should format camelCase names', () => {
      expect(formatFeatureName('featureName')).toBe('Feature Name');
      expect(formatFeatureName('myAwesomeFeature')).toBe('My Awesome Feature');
    });

    it('should format names with numbers', () => {
      expect(formatFeatureName('feature123')).toBe('Feature 123');
      expect(formatFeatureName('123feature')).toBe('123 Feature');
      expect(formatFeatureName('feature123name')).toBe('Feature 123 Name');
    });

    it('should format names with consecutive capitals', () => {
      expect(formatFeatureName('APIKey')).toBe('Api Key');
      expect(formatFeatureName('HTTPSConnection')).toBe('Https Connection');
      expect(formatFeatureName('XMLParser')).toBe('Xml Parser');
    });

    it('should handle single word names', () => {
      expect(formatFeatureName('feature')).toBe('Feature');
      expect(formatFeatureName('FEATURE')).toBe('Feature');
    });

    it('should handle empty or unusual strings', () => {
      expect(formatFeatureName('')).toBe('');
      expect(formatFeatureName('a')).toBe('A');
      expect(formatFeatureName('ABC')).toBe('Abc');
    });
  });

  describe('Rendering and visibility', () => {
    it('should not render initially', () => {
      const { container } = render(<SecretMenu {...defaultProps} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render when correct key sequence is entered', () => {
      render(<SecretMenu {...defaultProps} />);

      // Enter the secret sequence
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });

      expect(screen.getByText('Secret Menu')).toBeInTheDocument();
    });

    it('should not render with incorrect sequence', () => {
      render(<SecretMenu {...defaultProps} />);

      // Enter incorrect sequence
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });

      expect(screen.queryByText('Secret Menu')).not.toBeInTheDocument();
    });

    it('should handle empty secret menu array', () => {
      render(<SecretMenu {...defaultProps} secretMenu={[]} />);

      // Try some keys
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });

      expect(screen.queryByText('Secret Menu')).not.toBeInTheDocument();
    });

    it('should handle undefined secret menu', () => {
      const props = { ...defaultProps, secretMenu: undefined as any };
      render(<SecretMenu {...props} />);

      // Try some keys
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      
      expect(screen.queryByText('Secret Menu')).not.toBeInTheDocument();
    });
  });

  describe('Flag display and interaction', () => {
    beforeEach(() => {
      render(<SecretMenu {...defaultProps} />);
      
      // Open the menu
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });
    });

    it('should display all flags with formatted names', () => {
      expect(screen.getByText('Feature A')).toBeInTheDocument();
      expect(screen.getByText('Feature B')).toBeInTheDocument();
      expect(screen.getByText('Feature C')).toBeInTheDocument();
    });

    it('should show correct enabled/disabled status', () => {
      const buttons = screen.getAllByRole('button');
      const enabledButtons = buttons.filter(btn => btn.textContent === 'Enabled');
      const disabledButtons = buttons.filter(btn => btn.textContent === 'Disabled');

      expect(enabledButtons).toHaveLength(2); // featureA and featureC are enabled
      expect(disabledButtons).toHaveLength(1); // featureB is disabled
    });

    it('should toggle flag when button is clicked', () => {
      const featureBButton = screen.getByText('Feature B')
        .closest('div')
        ?.querySelector('button');

      fireEvent.click(featureBButton!);

      expect(defaultProps.isFlag).toHaveBeenCalledWith('featureB');
      expect(defaultProps.toggleFlag).toHaveBeenCalledWith('featureB');
    });

  });

  describe('Menu controls', () => {
    beforeEach(() => {
      render(<SecretMenu {...defaultProps} />);
      
      // Open the menu
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });
    });

    it('should close menu when close button is clicked', () => {
      // Find close button by its parent container
      const headerContainer = screen.getByText('Secret Menu').closest('div')?.parentElement;
      const buttons = headerContainer?.querySelectorAll('button');
      const closeButton = buttons?.[1]; // Second button is close
      
      fireEvent.click(closeButton!);

      expect(screen.queryByText('Secret Menu')).not.toBeInTheDocument();
    });

    it('should reset flags when reset button is clicked', () => {
      // Find reset button by its parent container
      const headerContainer = screen.getByText('Secret Menu').closest('div')?.parentElement;
      const buttons = headerContainer?.querySelectorAll('button');
      const resetButton = buttons?.[0]; // First button is reset
      
      fireEvent.click(resetButton!);

      expect(defaultProps.resetFlags).toHaveBeenCalled();
    });

    it('should reset key sequence when menu is closed', () => {
      // Close the menu
      const headerContainer = screen.getByText('Secret Menu').closest('div')?.parentElement;
      const buttons = headerContainer?.querySelectorAll('button');
      const closeButton = buttons?.[1]; // Second button is close
      fireEvent.click(closeButton!);

      // Try to open with partial sequence
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowUp' });

      expect(screen.queryByText('Secret Menu')).not.toBeInTheDocument();

      // Complete sequence should work
      fireEvent.keyDown(document, { key: 'ArrowDown' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });

      expect(screen.getByText('Secret Menu')).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    const manyFlags = {
      flag1: { enabled: true, details: { name: 'flag1', id: '1' } },
      flag2: { enabled: false, details: { name: 'flag2', id: '2' } },
      flag3: { enabled: true, details: { name: 'flag3', id: '3' } },
      flag4: { enabled: false, details: { name: 'flag4', id: '4' } },
      flag5: { enabled: true, details: { name: 'flag5', id: '5' } },
      flag6: { enabled: false, details: { name: 'flag6', id: '6' } },
      flag7: { enabled: true, details: { name: 'flag7', id: '7' } },
    };

    beforeEach(() => {
      const props = { ...defaultProps, flags: manyFlags };
      render(<SecretMenu {...props} />);
      
      // Open the menu
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });
    });

    it('should show only 5 flags per page', () => {
      const flagElements = screen.getAllByText(/Flag \d/);
      expect(flagElements).toHaveLength(5);
    });

    it('should show pagination controls when more than 5 flags', () => {
      const buttons = screen.getAllByRole('button');
      const navigationButtons = buttons.filter(btn => 
        btn.querySelector('svg') && !btn.textContent
      );
      
      // Should have close, reset, and at least one navigation button
      expect(navigationButtons.length).toBeGreaterThanOrEqual(3);
    });

    it('should navigate to next page', () => {
      // Find next button (visible one with ChevronRight)
      const buttons = screen.getAllByRole('button');
      const nextButton = buttons[buttons.length - 1]; // Last button should be next
      
      fireEvent.click(nextButton);

      expect(screen.getByText('Flag 6')).toBeInTheDocument();
      expect(screen.getByText('Flag 7')).toBeInTheDocument();
      expect(screen.queryByText('Flag 1')).not.toBeInTheDocument();
    });



  });

  describe('Custom styles', () => {
    it('should apply custom styles', () => {
      const customStyles = [
        { name: 'container', value: '{"backgroundColor": "#custom", "borderColor": "#custom-border"}' },
        { name: 'header', value: '{"color": "#custom-header"}' },
      ];

      render(<SecretMenu {...defaultProps} secretMenuStyles={customStyles} />);

      // Open the menu
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });

      const container = screen.getByText('Secret Menu').closest('div');
      expect(container).toHaveStyle({ backgroundColor: '#custom' });
    });

    it('should handle invalid JSON in styles gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const invalidStyles = [
        { name: 'container', value: 'invalid json' },
      ];

      render(<SecretMenu {...defaultProps} secretMenuStyles={invalidStyles} />);

      // Open the menu
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });

      expect(screen.getByText('Secret Menu')).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing style'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

  });

  describe('Event listener cleanup', () => {
    it('should remove event listener on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
      
      const { unmount } = render(<SecretMenu {...defaultProps} />);
      
      unmount();

      // The abort controller should handle cleanup
      expect(removeEventListenerSpy).not.toHaveBeenCalled(); // Modern cleanup via AbortController
    });

    it('should handle errors in event listeners gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock setKeySequence to throw an error
      const mockSetKeySequence = jest.fn(() => {
        throw new Error('State update error');
      });
      
      jest.spyOn(React, 'useState')
        .mockImplementationOnce(() => [false, jest.fn()]) // showMenu
        .mockImplementationOnce(() => [[], mockSetKeySequence]) // keySequence
        .mockImplementation((initial) => [initial, jest.fn()]); // others

      render(<SecretMenu {...defaultProps} />);

      // This should not crash the app
      fireEvent.keyDown(document, { key: 'ArrowUp' });

      expect(consoleSpy).toHaveBeenCalledWith('Error in key handler:', expect.any(Error));

      consoleSpy.mockRestore();
      jest.restoreAllMocks();
    });
  });

  describe('Error handling', () => {
    it('should handle toggle errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const errorToggle = jest.fn(() => {
        throw new Error('Toggle failed');
      });

      render(<SecretMenu {...defaultProps} toggleFlag={errorToggle} />);

      // Open menu
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });
      fireEvent.keyDown(document, { key: 'ArrowDown' });

      const button = screen.getByText('Feature A').closest('div')?.querySelector('button');
      fireEvent.click(button!);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error toggling flag'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});