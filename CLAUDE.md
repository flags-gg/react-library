# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `@flags-gg/react-library`, a React library for feature flag management that integrates with the Flags.gg service. It provides React components and hooks to manage feature flags dynamically in React applications.

## Essential Commands

### Development
```bash
# Install dependencies (uses pnpm)
pnpm install

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Run tests (currently runs lint + typecheck)
pnpm test

# Build the library
pnpm build
```

### Testing a Specific Component
```bash
# Jest is configured, but no specific test files exist yet
# When writing tests, place them in __tests__ directory
# Test files should follow the pattern: ComponentName.test.tsx
```

## Architecture Overview

### Core Components

1. **FlagsProvider** (`src/index.tsx`)
   - Main context provider that wraps React applications
   - Manages global feature flag state
   - Handles API communication with Flags.gg
   - Implements caching and periodic fetching
   - Provides local override capabilities via Jotai

2. **useFlags Hook**
   - Primary interface for consuming flags
   - Methods: `is(flagName)` returns object with `enabled()`, `disabled()`, `initialize()`
   - `toggle(flagName)` for development overrides

3. **SecretMenu** (`src/secretmenu.tsx`)
   - Debug UI activated by secret key sequence
   - Allows runtime flag toggling
   - Includes pagination and reset functionality

### Supporting Systems

- **Cache** (`src/cache.ts`): In-memory caching with TTL support
- **Types** (`src/types.ts`): TypeScript interfaces for all data structures
- **State Management**: Uses Jotai for persistent local overrides

### Build Configuration

- **Bundler**: Bunchee (outputs both ESM and CommonJS)
- **TypeScript**: Strict mode enabled with separate build config
- **Entry Points**: Properly configured for both module systems in package.json

## Key Development Patterns

1. **API Integration**
   - Headers: X-PROJECT-ID, X-AGENT-ID, X-ENVIRONMENT-ID
   - Configurable fetch intervals from server response
   - Automatic retry and error handling

2. **Performance Optimizations**
   - In-memory caching to reduce API calls
   - Memoized flag transformations
   - Abort controllers for cleanup

3. **State Management**
   - React Context for global distribution
   - Jotai atoms for persistent overrides
   - Local storage key: "flagsgg:overrides"

## Important Notes

- Always run `pnpm lint` and `pnpm typecheck` before committing
- The library supports React 18 and 19 as peer dependencies
- Local flag overrides persist across sessions via localStorage
- The secret menu is activated by a customizable key sequence
- Cache TTL is configurable (default: 5 minutes)