# Firefox Container Testing Plan - Phase 1

## Overview
This document outlines the initial testing strategy for ensuring Firefox runs well in the Deno + Puppeteer Docker container. We'll start with essential tests and expand incrementally.

## Phase 1: Basic Container Tests

### 1. Environment Validation Tests
**File**: `tests/container/environment.test.ts`

**Purpose**: Verify the container environment is properly configured for Firefox

**Test Cases**:
- Firefox binary exists and is executable
- Required system libraries are present
- Font configuration is working
- User permissions are correct
- Deno environment is properly set up

### 2. Firefox Launch Tests
**File**: `tests/container/firefox-launch.test.ts`

**Purpose**: Ensure Firefox can launch successfully in various configurations

**Test Cases**:
- Basic headless launch
- Launch with custom arguments
- Launch with different viewport sizes
- Multiple browser instances
- Proper cleanup after launch failure

### 3. Headless Mode Tests
**File**: `tests/container/headless-mode.test.ts`

**Purpose**: Verify core Puppeteer functionality works in headless mode

**Test Cases**:
- Page navigation to external sites
- Screenshot generation (PNG/JPEG)
- Basic DOM interaction
- JavaScript execution
- Page content extraction
- Form interaction

## Enhanced Makefile Commands

### Basic Commands
```makefile
# Build the Docker image
build:
	docker build --rm -t deno2-puppeteer:arm64 .

# Run basic container tests
test-basic:
	docker run --rm -v $(PWD):/workspace deno2-puppeteer:arm64 \
		deno test --allow-all /workspace/tests/container/

# Run environment validation tests
test-env:
	docker run --rm -v $(PWD):/workspace deno2-puppeteer:arm64 \
		deno test --allow-all /workspace/tests/container/environment.test.ts

# Run Firefox launch tests
test-firefox:
	docker run --rm -v $(PWD):/workspace deno2-puppeteer:arm64 \
		deno test --allow-all /workspace/tests/container/firefox-launch.test.ts

# Run headless mode tests
test-headless:
	docker run --rm -v $(PWD):/workspace deno2-puppeteer:arm64 \
		deno test --allow-all /workspace/tests/container/headless-mode.test.ts

# Build and run all basic tests
build-and-test: build test-basic

# Interactive test with logs
test-interactive:
	docker run --rm -it -v $(PWD):/workspace deno2-puppeteer:arm64 \
		deno test --allow-all --verbose /workspace/tests/container/
```

## Test Implementation Strategy

### Directory Structure
```
tests/
├── container/
│   ├── environment.test.ts
│   ├── firefox-launch.test.ts
│   └── headless-mode.test.ts
├── fixtures/
│   └── test-pages/
└── utils/
    └── test-helpers.ts
```

### Key Testing Features
1. **Container-specific validation**: Verify all dependencies are available
2. **Firefox launch reliability**: Test various launch configurations
3. **Headless functionality**: Core Puppeteer operations in container
4. **Proper cleanup**: Ensure no resource leaks
5. **Error handling**: Test failure scenarios

### Success Criteria
- All tests pass consistently in the container environment
- Firefox launches reliably in headless mode
- Screenshots and DOM operations work correctly
- No memory leaks or hanging processes
- Clear error messages for any failures

## Next Steps (Future Phases)
- Font rendering tests
- Memory usage monitoring
- Performance benchmarks
- Stress testing with multiple instances
- Network connectivity tests