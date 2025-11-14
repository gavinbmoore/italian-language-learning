# Testing Guide

## 📋 Overview

This project uses **Vitest** as the testing framework for TypeScript/Node.js backend testing.

## 🚀 Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## 📁 Test Structure

```
server/
├── test/
│   ├── setup.ts                    # Global test configuration
│   ├── infrastructure.test.ts      # Basic infrastructure tests
│   ├── lib/
│   │   ├── comprehensible-input.test.ts
│   │   └── spaced-repetition.test.ts
│   └── ...
├── vitest.config.ts                # Vitest configuration
└── src/
    └── *.test.ts                   # Co-located tests (optional)
```

## ✅ Test Coverage Goals

- **Critical Path**: 80%+ coverage
- **Business Logic**: 90%+ coverage
- **Utility Functions**: 95%+ coverage
- **API Endpoints**: 70%+ coverage (integration tests)

## 🧪 Testing Best Practices

### 1. Test Organization

```typescript
describe('Feature Name', () => {
  describe('Specific Functionality', () => {
    it('should behave in expected way', () => {
      // Arrange
      const input = setupTestData();
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### 2. Async Testing

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

### 3. Mocking

```typescript
import { vi } from 'vitest';

it('should mock external dependencies', () => {
  const mockFn = vi.fn().mockReturnValue('mocked');
  expect(mockFn()).toBe('mocked');
});
```

### 4. Database Testing

```typescript
beforeEach(async () => {
  // Setup test database
  await setupTestDatabase();
});

afterEach(async () => {
  // Cleanup test data
  await cleanupTestDatabase();
});
```

## 🎯 What to Test

### High Priority
- ✅ SRS algorithm calculations
- ✅ Vocabulary tracking logic
- ✅ Comprehensible input analysis
- ✅ Grammar exercise generation
- ✅ Authentication and authorization
- ✅ Data validation

### Medium Priority
- ⚠️ API endpoint responses
- ⚠️ Error handling
- ⚠️ Database queries
- ⚠️ Utility functions

### Low Priority
- ⏸️ UI components (frontend testing)
- ⏸️ Styling and layout
- ⏸️ Configuration files

## 📊 Current Test Status

- **Infrastructure**: ✅ Complete (7/7 tests passing)
- **Comprehensible Input**: ⚠️ In Progress (needs function exports)
- **Spaced Repetition**: ⚠️ In Progress (API mismatch)
- **Grammar System**: ⏸️ Not Started
- **API Endpoints**: ⏸️ Not Started
- **Database Layer**: ⏸️ Not Started

## 🔧 CI/CD Integration

Tests automatically run:
- On every commit (pre-commit hook)
- On pull requests
- Before deployment

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [TDD Guide](https://martinfowler.com/bliki/TestDrivenDevelopment.html)

## 🐛 Debugging Tests

```bash
# Run specific test file
npm test path/to/test.test.ts

# Run tests matching pattern
npm test -- --grep "pattern"

# Show verbose output
npm test -- --reporter=verbose

# Debug with Node inspector
node --inspect-brk node_modules/.bin/vitest run
```

## 📝 Writing New Tests

1. Create test file next to source: `feature.test.ts`
2. Import testing utilities:
   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from 'vitest';
   ```
3. Write descriptive test names:
   ```typescript
   it('should calculate SRS interval correctly for quality 5', () => {
     // Test implementation
   });
   ```
4. Use meaningful assertions:
   ```typescript
   expect(result).toBe(expected);
   expect(array).toContain(item);
   expect(obj).toHaveProperty('key', value);
   ```
5. Clean up after tests:
   ```typescript
   afterEach(() => {
     // Cleanup logic
   });
   ```

## 🎓 Test-Driven Development (TDD)

1. **Red**: Write a failing test
2. **Green**: Write minimal code to pass
3. **Refactor**: Improve code while keeping tests passing

## ⚡ Performance

- Tests should run fast (< 1s per test)
- Use mocks for external dependencies
- Parallelize independent tests
- Skip slow integration tests during development

## 🔐 Security Testing

- ✅ Test authentication bypasses are removed
- ✅ Test SQL injection prevention
- ✅ Test XSS prevention
- ✅ Test rate limiting
- ✅ Test input validation

---

**Last Updated**: 2025-11-13
**Coverage Target**: 80%
**Tests Passing**: 7/7 (100%)

