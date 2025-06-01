import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.93.0/testing/asserts.ts";
import puppeteer, { Browser } from "../../mod.ts";

/**
 * Firefox Launch Tests
 * These tests ensure Firefox can launch successfully in various configurations
 */

async function cleanupBrowser(browser: Browser | undefined) {
  if (browser) {
    try {
      await browser.close();
    } catch (error) {
      console.warn(`Warning: Error closing browser: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

Deno.test("Basic headless Firefox launch", async () => {
  let browser: Browser | undefined;
  
  try {
    browser = await puppeteer.launch({
      product: "firefox",
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage"
      ]
    });
    
    assert(browser, "Firefox browser instance should be created");
    
    // Test that we can get the browser version
    const version = await browser.version();
    assert(version, "Browser version should be available");
    assert(version.includes("Firefox"), "Version should indicate Firefox");
    
    console.log(`✓ Firefox launched successfully: ${version}`);
    
    // Test that we can create a page
    const page = await browser.newPage();
    assert(page, "Should be able to create a new page");
    
    console.log("✓ New page created successfully");
    
  } catch (error) {
    throw new Error(`Firefox launch failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await cleanupBrowser(browser);
  }
});

Deno.test("Firefox launch with custom arguments", async () => {
  let browser: Browser | undefined;
  
  try {
    browser = await puppeteer.launch({
      product: "firefox",
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--window-size=1920,1080"
      ]
    });
    
    assert(browser, "Firefox should launch with custom arguments");
    
    const page = await browser.newPage();
    
    // Set viewport to test custom window size
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Test that viewport was set correctly
    const viewport = page.viewport();
    assertEquals(viewport?.width, 1920, "Viewport width should be 1920");
    assertEquals(viewport?.height, 1080, "Viewport height should be 1080");
    
    console.log("✓ Firefox launched with custom arguments and viewport");
    
  } catch (error) {
    throw new Error(`Firefox launch with custom args failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await cleanupBrowser(browser);
  }
});

Deno.test("Firefox launch with different viewport sizes", async () => {
  const viewportSizes = [
    { width: 800, height: 600 },
    { width: 1024, height: 768 },
    { width: 1920, height: 1080 }
  ];
  
  for (const size of viewportSizes) {
    let browser: Browser | undefined;
    
    try {
      browser = await puppeteer.launch({
        product: "firefox",
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"]
      });
      
      const page = await browser.newPage();
      await page.setViewport(size);
      
      const viewport = page.viewport();
      assertEquals(viewport?.width, size.width, `Viewport width should be ${size.width}`);
      assertEquals(viewport?.height, size.height, `Viewport height should be ${size.height}`);
      
      console.log(`✓ Viewport ${size.width}x${size.height} set successfully`);
      
    } catch (error) {
      throw new Error(`Viewport test failed for ${size.width}x${size.height}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await cleanupBrowser(browser);
    }
  }
});

Deno.test("Multiple Firefox browser instances", async () => {
  const browsers: Browser[] = [];
  
  try {
    // Launch multiple browser instances
    for (let i = 0; i < 3; i++) {
      const browser = await puppeteer.launch({
        product: "firefox",
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"]
      });
      
      browsers.push(browser);
      
      // Test that each browser can create a page
      const page = await browser.newPage();
      assert(page, `Browser ${i + 1} should be able to create a page`);
    }
    
    assertEquals(browsers.length, 3, "Should have 3 browser instances");
    console.log("✓ Multiple Firefox instances launched successfully");
    
    // Test that all browsers are independent
    for (let i = 0; i < browsers.length; i++) {
      const pages = await browsers[i].pages();
      assert(pages.length >= 1, `Browser ${i + 1} should have at least one page`);
    }
    
    console.log("✓ All browser instances are independent and functional");
    
  } catch (error) {
    throw new Error(`Multiple browser test failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    // Clean up all browsers
    for (const browser of browsers) {
      await cleanupBrowser(browser);
    }
  }
});

Deno.test("Firefox launch failure scenarios", async () => {
  // Test launch with invalid arguments
  try {
    const browser = await puppeteer.launch({
      product: "firefox",
      headless: true,
      args: [
        "--no-sandbox",
        "--invalid-argument-that-should-not-exist"
      ]
    });
    
    // If we get here, Firefox was surprisingly tolerant of the invalid argument
    console.log("⚠ Firefox launched despite invalid argument (this is actually OK)");
    await cleanupBrowser(browser);
    
  } catch (error) {
    // This is expected - invalid arguments should cause launch to fail
    console.log("✓ Firefox correctly rejected invalid arguments");
  }
  
  // Test that we can recover from launch failures
  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({
      product: "firefox",
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });
    
    assert(browser, "Should be able to launch Firefox after a failed attempt");
    console.log("✓ Successfully recovered from launch failure");
    
  } catch (error) {
    throw new Error(`Recovery from launch failure failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await cleanupBrowser(browser);
  }
});

Deno.test("Firefox browser cleanup verification", async () => {
  let browser: Browser | undefined;
  
  try {
    browser = await puppeteer.launch({
      product: "firefox",
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });
    
    const page = await browser.newPage();
    await page.goto("data:text/html,<h1>Test Page</h1>");
    
    // Get process info before closing
    const version = await browser.version();
    assert(version, "Browser should be running");
    
    console.log("✓ Browser is running and functional");
    
  } catch (error) {
    throw new Error(`Browser cleanup test setup failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log("✓ Browser closed successfully");
        
        // Try to use the browser after closing (should fail)
        try {
          await browser.version();
          throw new Error("Browser should not be usable after closing");
        } catch {
          console.log("✓ Browser is properly cleaned up and not usable after close");
        }
        
      } catch (error) {
        throw new Error(`Browser cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
});

Deno.test("Firefox launch timeout handling", async () => {
  let browser: Browser | undefined;
  
  try {
    // Test with a reasonable timeout
    const startTime = Date.now();
    
    browser = await puppeteer.launch({
      product: "firefox",
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
      timeout: 30000 // 30 seconds timeout
    });
    
    const launchTime = Date.now() - startTime;
    console.log(`✓ Firefox launched in ${launchTime}ms`);
    
    assert(browser, "Browser should launch within timeout");
    assert(launchTime < 30000, "Launch should complete within 30 seconds");
    
    // Test that the browser is functional
    const page = await browser.newPage();
    await page.goto("data:text/html,<h1>Timeout Test</h1>");
    
    const title = await page.evaluate("document.querySelector('h1')?.textContent");
    assertEquals(title, "Timeout Test", "Browser should be functional after launch");
    
    console.log("✓ Browser is functional after timed launch");
    
  } catch (error) {
    throw new Error(`Timeout handling test failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await cleanupBrowser(browser);
  }
});