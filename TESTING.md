# Testing Guide

This project includes comprehensive testing coverage with both unit tests and end-to-end (E2E) tests.

## Test Types

### Unit Tests (Vitest)

- **Framework**: Vitest with jsdom environment
- **Coverage**: 46 tests covering utilities, error handling, and LLM functions
- **Location**: `src/**/*.test.ts`
- **Setup**: `src/test/setup.ts` with mocked browser APIs

### End-to-End Tests (Playwright)

- **Framework**: Playwright with Chromium, Firefox, and WebKit
- **Coverage**: Core user flows, API integration, VRM functionality
- **Location**: `tests/e2e/`
- **Visual Testing**: Screenshots and visual regression tests

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### End-to-End Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with browser UI
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug tests
npm run test:e2e:debug

# View last test report
npm run test:e2e:report
```

### All Tests

```bash
# Run complete test suite
npm run test:all
```

## Test Structure

### Unit Tests

- `src/lib/utils/logger.test.ts` - Logging system tests
- `src/lib/utils/errors.test.ts` - Error handling tests
- `src/lib/utils/sleep.test.ts` - Utility function tests
- `src/lib/llm/generative.test.ts` - LLM integration tests

### E2E Tests

- `tests/e2e/app.spec.ts` - Core application functionality
- `tests/e2e/chat.spec.ts` - Chat interface and interactions
- `tests/e2e/api.spec.ts` - API endpoint testing
- `tests/e2e/vrm.spec.ts` - VRM avatar functionality
- `tests/e2e/visual.spec.ts` - Visual regression testing

## Test Coverage

### Unit Test Coverage (46 tests)

- ✅ Logger functionality with performance monitoring
- ✅ Error handling with retry logic and custom errors
- ✅ LLM integration with emotion detection
- ✅ Utility functions and sleep functionality

### E2E Test Coverage

- ✅ Page loading and title verification
- ✅ 3D scene canvas rendering
- ✅ Chat interface display and interactions
- ✅ VRM model loading and animations
- ✅ API endpoint functionality
- ✅ TTS and lip synchronization
- ✅ Responsive design testing
- ✅ Visual regression testing
- ✅ Error handling in UI

## Test Configuration

### Vitest Config (`vitest.config.ts`)

- **Environment**: jsdom for browser simulation
- **Coverage**: 70% threshold for branches, functions, lines, statements
- **Setup**: Global mocks for WebAudio, crypto, localStorage

### Playwright Config (`playwright.config.ts`)

- **Browsers**: Chromium, Firefox, WebKit
- **Base URL**: http://localhost:5173
- **Screenshots**: On failure
- **Videos**: On failure
- **Traces**: On retry

## Mocked APIs

### Unit Tests

- `fetch` - Mocked globally for API calls
- `AudioContext` - Mocked for TTS functionality
- `crypto.randomUUID` - Consistent test IDs
- `localStorage` - Browser storage simulation
- `console` methods - Clean test output

### E2E Tests

- API endpoints can be mocked using `page.route()`
- Error scenarios tested with failed API responses
- Network requests monitored and validated

## Visual Testing

Visual regression tests capture:

- Homepage appearance
- Chat interface states
- Loading states
- Error states
- Responsive layouts (desktop, tablet, mobile)
- 3D scene consistency

Screenshots stored in `tests/e2e/screenshots/` and compared against baselines.

## Continuous Integration

Tests run automatically on:

- Pre-commit hooks (unit tests + linting)
- GitHub Actions workflows
- Security and quality gates

## Best Practices

1. **Isolation**: Each test is independent
2. **Deterministic**: Tests use mocked time and UUIDs
3. **Fast**: Unit tests complete in under 5 seconds
4. **Comprehensive**: Both happy path and error scenarios
5. **Visual**: Screenshots verify UI appearance
6. **Real-world**: E2E tests simulate actual user interactions
