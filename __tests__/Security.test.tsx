import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FlagsProvider, useFlags } from '../src';
import { mockServerResponse, setupConsoleSpy } from './test-utils';

const OVERRIDES_KEY = 'flagsgg:overrides:p1::';

const Probe: React.FC = () => {
  const { is } = useFlags();
  return (
    <div>
      <div>B: {is('featureB').enabled() ? 'on' : 'off'}</div>
      <div>Unknown: {is('unknownFlag').enabled() ? 'on' : 'off'}</div>
    </div>
  );
};

// Each call returns the next queued response (the last one repeats)
const queueFetch = (...responses: Array<{ body: unknown; status?: number; headers?: Record<string, string> }>) => {
  global.fetch = jest.fn().mockImplementation(() => {
    const r = responses.length > 1 ? responses.shift()! : responses[0];
    const text = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    const status = r.status ?? 200;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(r.headers ?? {}),
      text: () => Promise.resolve(text),
    });
  });
};

const { secretMenu: _unused, ...responseWithoutMenu } = mockServerResponse;

describe('Security behaviour', () => {
  let consoleSpy: ReturnType<typeof setupConsoleSpy>;

  beforeEach(() => {
    consoleSpy = setupConsoleSpy();
    localStorage.clear();
  });

  afterEach(() => {
    consoleSpy.restore();
    jest.useRealTimers();
  });

  describe('Secret menu overrides', () => {
    it('applies overrides only for server flags while active, and clears them when the server stops sending secretMenu', async () => {
      jest.useFakeTimers();
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify({
        featureB: { enabled: true },
        unknownFlag: { enabled: true },
      }));
      queueFetch({ body: mockServerResponse }, { body: responseWithoutMenu });

      render(<FlagsProvider options={{ projectId: 'p1' }}><Probe /></FlagsProvider>);

      await waitFor(() => expect(screen.getByText('B: on')).toBeInTheDocument());
      expect(screen.getByText('Unknown: off')).toBeInTheDocument();

      act(() => { jest.advanceTimersByTime(60000); });

      await waitFor(() => expect(screen.getByText('B: off')).toBeInTheDocument());
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(localStorage.getItem(OVERRIDES_KEY)).toBeNull();
    });

    it('ignores stored overrides when the server never enabled a secret menu', async () => {
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify({ featureB: { enabled: true } }));
      queueFetch({ body: { ...responseWithoutMenu, secretMenu: { sequence: [], styles: [] } } });

      render(<FlagsProvider options={{ projectId: 'p1' }}><Probe /></FlagsProvider>);

      await waitFor(() => expect(localStorage.getItem(OVERRIDES_KEY)).toBeNull());
      expect(screen.getByText('B: off')).toBeInTheDocument();
    });

    it('namespaces overrides by project/agent/environment', async () => {
      localStorage.setItem('flagsgg:overrides:other::', JSON.stringify({ featureB: { enabled: true } }));
      queueFetch({ body: mockServerResponse });

      render(<FlagsProvider options={{ projectId: 'p1' }}><Probe /></FlagsProvider>);

      await waitFor(() => expect(global.fetch).toHaveBeenCalled());
      await act(async () => {});
      expect(screen.getByText('B: off')).toBeInTheDocument();
    });
  });

  describe('Interval clamping', () => {
    it.each([
      [1, 10000],
      [99999, 3600000],
      ['abc', 60000],
      [-5, 60000],
      [0, 60000],
      [null, 60000],
    ])('intervalAllowed %p -> %pms', async (value, expected) => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      queueFetch({ body: { ...mockServerResponse, intervalAllowed: value } });

      render(<FlagsProvider options={{ projectId: 'p1' }}><Probe /></FlagsProvider>);

      await waitFor(() => expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), expected));
      setIntervalSpy.mockRestore();
    });
  });

  describe('Transport hardening', () => {
    it('rejects non-https flagsURL and falls back to the default', async () => {
      queueFetch({ body: mockServerResponse });

      render(<FlagsProvider options={{ projectId: 'p1', flagsURL: 'http://evil.example/flags' }}><Probe /></FlagsProvider>);

      await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('https://api.flags.gg/flags', expect.any(Object)));
      expect(consoleSpy.spies.warn).toHaveBeenCalled();
    });

    it('allows http for localhost', async () => {
      queueFetch({ body: mockServerResponse });

      render(<FlagsProvider options={{ projectId: 'p1', flagsURL: 'http://localhost:8080/flags' }}><Probe /></FlagsProvider>);

      await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('http://localhost:8080/flags', expect.any(Object)));
    });

    it('rejects responses over 5MB by content-length', async () => {
      queueFetch({ body: mockServerResponse, headers: { 'content-length': String(6 * 1024 * 1024) } });

      render(<FlagsProvider options={{ projectId: 'p1', enableLogs: true }}><Probe /></FlagsProvider>);

      await waitFor(() => expect(consoleSpy.spies.log).toHaveBeenCalledWith(
        'Flags.gg', expect.any(String), 'Error fetching flags:', 'Response too large'
      ));
    });

    it('rejects response bodies over 5MB', async () => {
      queueFetch({ body: 'x'.repeat(5 * 1024 * 1024 + 1) });

      render(<FlagsProvider options={{ projectId: 'p1', enableLogs: true }}><Probe /></FlagsProvider>);

      await waitFor(() => expect(consoleSpy.spies.log).toHaveBeenCalledWith(
        'Flags.gg', expect.any(String), 'Error fetching flags:', 'Response too large'
      ));
    });

    it('truncates error bodies in logs', async () => {
      queueFetch({ body: 'e'.repeat(1000), status: 500 });

      render(<FlagsProvider options={{ projectId: 'p1', enableLogs: true }}><Probe /></FlagsProvider>);

      await waitFor(() => expect(consoleSpy.spies.log).toHaveBeenCalledWith(
        'Flags.gg', expect.any(String), 'Error fetching flags:', `HTTP 500: ${'e'.repeat(200)}`
      ));
    });

    it('logs flag names only, not the payload', async () => {
      queueFetch({ body: mockServerResponse });

      render(<FlagsProvider options={{ projectId: 'p1', enableLogs: true }}><Probe /></FlagsProvider>);

      await waitFor(() => expect(consoleSpy.spies.log).toHaveBeenCalledWith(
        'Flags.gg', expect.any(String), 'Flags fetched: 3', ['featureA', 'featureB', 'featureC']
      ));
      const logged = JSON.stringify(consoleSpy.spies.log.mock.calls);
      expect(logged).not.toContain('ArrowUp');
      expect(logged).not.toContain('test-featureA-id');
    });
  });
});
