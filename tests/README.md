# Firefox Container Testing Suite

This directory contains comprehensive tests to ensure Firefox runs well in the Deno + Puppeteer Docker container environment.

## Test Structure

```
tests/
├── container/                 # Container-specific tests
│   ├── environment.test.ts    # Environment validation tests
│   ├── firefox-launch.test.ts # Firefox launch tests
│   └── headless-mode.test.ts  # Headless mode functionality tests
├── fixtures/                  # Test fixtures and sample files
│   └── test-pages/           # Sample HTML pages for testing
└── README.md                 # This file
```

## Test Categories

### 1. Environment Validation Tests (`environment.test.ts`)

These tests verify that the container environment is properly configured:

- ✅ Firefox binary exists and is executable
- ✅ Required system libraries are present
- ✅ Font configuration is working
- ✅ User permissions are correct
- ✅ Deno environment is properly set up
- ✅ System resources are adequate

### 2. Firefox Launch Tests (`firefox-launch.test.ts`)

These tests ensure Firefox can launch successfully in various configurations:

- ✅ Basic headless Firefox launch
- ✅ Firefox launch with custom arguments
- ✅ Firefox launch with different viewport sizes
- ✅ Multiple Firefox browser instances
- ✅ Firefox launch failure scenarios
- ✅ Firefox browser cleanup verification
- ✅ Firefox launch timeout handling

### 3. Headless Mode Tests (`headless-mode.test.ts`)

These tests verify core Puppeteer functionality works in headless mode:

- ✅ Page navigation to external sites
- ✅ Screenshot generation (PNG/JPEG)
- ✅ Basic DOM interaction
- ✅ JavaScript execution
- ✅ Page content extraction
- ✅ Form interaction

## Running Tests

### Prerequisites

1. Build the Docker image:
   ```bash
   make build
   ```

### Running All Tests

```bash
# Run all basic container tests
make test-basic

# Build and test in one command
make build-and-test
```

### Running Specific Test Categories

```bash
# Environment validation only
make test-env

# Firefox launch tests only
make test-firefox

# Headless mode tests only
make test-headless
```

### Interactive Testing

```bash
# Run tests with verbose output and logs
make test-interactive

# Quick smoke test (environment validation only)
make test-smoke
```

### Advanced Testing

```bash
# Run tests with coverage
make test-coverage

# Clean up Docker images
make clean
```

## Test Output

### Successful Test Run Example

```
✓ Firefox found at: /usr/bin/firefox
✓ All 10 required libraries are present
✓ Font configuration is working
✓ Found fonts: DejaVu=true, Liberation=true, FreeFonts=true
✓ Write permissions in current directory: OK
✓ Write permissions in /tmp directory: OK
✓ Running as user: root
✓ Deno version: 2.3.3
✓ V8 version: 12.4.254.20
✓ TypeScript version: 5.4.5
✓ DENO_DIR: /deno-dir/
✓ DENO_DIR is accessible
✓ Deno permissions are properly configured
✓ Total memory: 2048 MB
✓ Available memory: 1536 MB
```

### Common Issues and Solutions

#### 1. Firefox Binary Not Found
```
Error: Firefox binary not found in any of the expected locations
```
**Solution**: Ensure Firefox is properly installed in the Docker image.

#### 2. Missing System Libraries
```
Error: Missing required libraries: libgtk-3-0, libnss3
```
**Solution**: Install missing libraries in the Dockerfile.

#### 3. Font Configuration Issues
```
Error: No common fonts (DejaVu, Liberation, or FreeFonts) found
```
**Solution**: Install font packages and rebuild font cache.

#### 4. Memory Issues
```
Error: Insufficient memory: 128MB available, need at least 256MB
```
**Solution**: Increase container memory allocation.

## Container-Specific Considerations

### Memory Usage
- Firefox typically requires at least 256MB of available memory
- Tests monitor memory usage and will warn if resources are low
- Multiple browser instances will increase memory requirements

### Font Rendering
- Tests verify that font configuration is working properly
- Common fonts (DejaVu, Liberation, FreeFonts) are checked
- Font cache is validated for proper rendering

### Headless Mode
- All tests run in headless mode for container compatibility
- Screenshots are generated to verify rendering works
- DOM interaction is tested to ensure full functionality

### Network Connectivity
- Some tests attempt external network connections
- Network failures are handled gracefully and logged as warnings
- Local data URLs are used as fallbacks

## Extending the Tests

### Adding New Test Cases

1. Create a new test file in the `container/` directory
2. Follow the existing pattern using the `browserTest` helper
3. Add the new test to the Makefile
4. Update this README

### Test Helpers

The tests use several helper patterns:

```typescript
// Browser test wrapper with automatic cleanup
browserTest("test name", async (browser) => {
  // Your test code here
});

// Type assertions for page.evaluate results
const result = await page.evaluate("...") as ExpectedType;

// Error handling with proper typing
} catch (error) {
  throw new Error(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
}
```

## Troubleshooting

### Debug Mode

To run tests with additional debugging:

```bash
# Run with verbose output
make test-interactive

# Run individual test files for focused debugging
docker run --rm -it -v $(PWD):/workspace deno2-puppeteer:arm64 \
  deno test --allow-all --verbose /workspace/tests/container/environment.test.ts
```

### Container Shell Access

To debug issues interactively:

```bash
# Get shell access to the container
docker run --rm -it -v $(PWD):/workspace deno2-puppeteer:arm64 /bin/bash

# Then run tests manually
deno test --allow-all /workspace/tests/container/
```

### Log Analysis

Tests provide detailed logging:
- ✅ Success indicators for passed tests
- ⚠ Warning indicators for non-critical issues
- ❌ Error indicators for test failures

## Performance Benchmarks

The tests include basic performance monitoring:
- Browser launch time measurement
- Memory usage tracking
- Screenshot generation timing
- Page load performance

## Contributing

When adding new tests:

1. Follow the existing naming conventions
2. Include proper error handling and cleanup
3. Add appropriate logging and assertions
4. Update the Makefile and documentation
5. Test in the actual container environment

## License

These tests are part of the deno-puppeteer project and follow the same license terms.