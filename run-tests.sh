#!/bin/bash

# Firefox Container Test Runner
# This script provides an easy way to run the Firefox container tests

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
VERBOSE=false
COVERAGE=false
INTERACTIVE=false
TEST_TYPE="all"
BUILD_IMAGE=true

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Firefox Container Test Runner"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --test-type TYPE    Test type: all, env, firefox, headless, smoke (default: all)"
    echo "  -v, --verbose          Enable verbose output"
    echo "  -c, --coverage         Enable coverage reporting"
    echo "  -i, --interactive      Run in interactive mode"
    echo "  -n, --no-build         Skip building the Docker image"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                     # Run all tests"
    echo "  $0 -t env              # Run only environment tests"
    echo "  $0 -v -c               # Run all tests with verbose output and coverage"
    echo "  $0 -i                  # Run tests interactively"
    echo "  $0 -t smoke -n         # Run smoke tests without rebuilding image"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--test-type)
            TEST_TYPE="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -c|--coverage)
            COVERAGE=true
            shift
            ;;
        -i|--interactive)
            INTERACTIVE=true
            shift
            ;;
        -n|--no-build)
            BUILD_IMAGE=false
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate test type
case $TEST_TYPE in
    all|env|firefox|headless|smoke)
        ;;
    *)
        print_error "Invalid test type: $TEST_TYPE"
        print_error "Valid types: all, env, firefox, headless, smoke"
        exit 1
        ;;
esac

print_status "Starting Firefox container tests..."
print_status "Test type: $TEST_TYPE"
print_status "Verbose: $VERBOSE"
print_status "Coverage: $COVERAGE"
print_status "Interactive: $INTERACTIVE"
print_status "Build image: $BUILD_IMAGE"

# Build Docker image if requested
if [ "$BUILD_IMAGE" = true ]; then
    print_status "Building Docker image..."
    if make build; then
        print_success "Docker image built successfully"
    else
        print_error "Failed to build Docker image"
        exit 1
    fi
else
    print_status "Skipping Docker image build"
fi

# Prepare test command based on options
TEST_CMD="deno test --allow-all"

if [ "$VERBOSE" = true ]; then
    TEST_CMD="$TEST_CMD --verbose"
fi

if [ "$COVERAGE" = true ]; then
    TEST_CMD="$TEST_CMD --coverage=coverage"
fi

# Determine test files to run
case $TEST_TYPE in
    all)
        TEST_PATH="/workspace/tests/container/"
        ;;
    env)
        TEST_PATH="/workspace/tests/container/environment.test.ts"
        ;;
    firefox)
        TEST_PATH="/workspace/tests/container/firefox-launch.test.ts"
        ;;
    headless)
        TEST_PATH="/workspace/tests/container/headless-mode.test.ts"
        ;;
    smoke)
        TEST_PATH="/workspace/tests/container/environment.test.ts"
        ;;
esac

TEST_CMD="$TEST_CMD $TEST_PATH"

# Prepare Docker run command
DOCKER_CMD="docker run --rm -v $(pwd):/workspace deno2-puppeteer:arm64"

if [ "$INTERACTIVE" = true ]; then
    DOCKER_CMD="$DOCKER_CMD -it"
fi

DOCKER_CMD="$DOCKER_CMD $TEST_CMD"

print_status "Running tests..."
print_status "Command: $DOCKER_CMD"

# Run the tests
START_TIME=$(date +%s)

if eval "$DOCKER_CMD"; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    print_success "All tests passed! (${DURATION}s)"
    
    # Show coverage report if enabled
    if [ "$COVERAGE" = true ]; then
        print_status "Generating coverage report..."
        docker run --rm -v $(pwd):/workspace deno2-puppeteer:arm64 \
            deno coverage coverage --html
        print_success "Coverage report generated in coverage/ directory"
    fi
    
    exit 0
else
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    print_error "Tests failed! (${DURATION}s)"
    
    print_warning "Troubleshooting tips:"
    print_warning "1. Check if Firefox is properly installed in the container"
    print_warning "2. Verify all required system libraries are present"
    print_warning "3. Ensure sufficient memory is available"
    print_warning "4. Run with -v flag for verbose output"
    print_warning "5. Run with -i flag for interactive debugging"
    
    exit 1
fi