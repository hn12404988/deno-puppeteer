# Build the Docker image
build:
	docker build --rm -t deno2-puppeteer:arm64 .

# Run all basic container tests
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

# Run tests with coverage (if needed)
test-coverage:
	docker run --rm -v $(PWD):/workspace deno2-puppeteer:arm64 \
		deno test --allow-all --coverage=coverage /workspace/tests/container/

# Quick smoke test - just environment validation
test-smoke:
	docker run --rm -v $(PWD):/workspace deno2-puppeteer:arm64 \
		deno test --allow-all /workspace/tests/container/environment.test.ts

# Test individual components
test-env-only: test-env
test-firefox-only: test-firefox
test-headless-only: test-headless

# Clean up any test artifacts
clean:
	docker rmi deno2-puppeteer:arm64 2>/dev/null || true

# Help target
help:
	@echo "Available targets:"
	@echo "  build           - Build the Docker image"
	@echo "  test-basic      - Run all basic container tests"
	@echo "  test-env        - Run environment validation tests"
	@echo "  test-firefox    - Run Firefox launch tests"
	@echo "  test-headless   - Run headless mode tests"
	@echo "  build-and-test  - Build image and run all tests"
	@echo "  test-interactive- Run tests with verbose output"
	@echo "  test-coverage   - Run tests with coverage"
	@echo "  test-smoke      - Quick smoke test"
	@echo "  clean           - Remove Docker image"
	@echo "  help            - Show this help message"

.PHONY: build test-basic test-env test-firefox test-headless build-and-test test-interactive test-coverage test-smoke clean help