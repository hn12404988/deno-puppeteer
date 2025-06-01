import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.93.0/testing/asserts.ts";
import { browserTest, getFirefoxExecutablePath } from "../utils/test-helpers.ts";

/**
 * Simplified Firefox Launch Tests
 * These tests ensure Firefox can launch successfully with the correct executable path
 */

browserTest("Basic headless Firefox launch", async (browser) => {
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
});

browserTest("Firefox page navigation", async (browser) => {
  const page = await browser.newPage();
  
  // Test navigation to a simple data URL
  await page.goto("data:text/html,<h1>Test Page</h1><p>Hello World</p>");
  
  const title = await page.evaluate("document.querySelector('h1')?.textContent");
  assertEquals(title, "Test Page", "Should navigate to data URL successfully");
  
  console.log("✓ Page navigation successful");
});

browserTest("Firefox screenshot generation", async (browser) => {
  const page = await browser.newPage();
  
  // Create a test page with some content
  await page.goto("data:text/html,<html><body style='background:red;width:800px;height:600px;'><h1 style='color:white;text-align:center;padding-top:200px;'>Screenshot Test</h1></body></html>");
  
  // Test PNG screenshot
  const pngScreenshot = await page.screenshot({ 
    type: "png",
    fullPage: true
  });
  
  assert(pngScreenshot instanceof Uint8Array, "PNG screenshot should be a Uint8Array");
  assert(pngScreenshot.length > 0, "PNG screenshot should not be empty");
  
  console.log(`✓ PNG screenshot generated: ${pngScreenshot.length} bytes`);
});

browserTest("Firefox viewport configuration", async (browser) => {
  const page = await browser.newPage();
  
  // Test different viewport sizes
  const viewportSizes = [
    { width: 800, height: 600 },
    { width: 1024, height: 768 },
    { width: 1920, height: 1080 }
  ];
  
  for (const size of viewportSizes) {
    await page.setViewport(size);
    
    const viewport = page.viewport();
    assertEquals(viewport?.width, size.width, `Viewport width should be ${size.width}`);
    assertEquals(viewport?.height, size.height, `Viewport height should be ${size.height}`);
    
    console.log(`✓ Viewport ${size.width}x${size.height} set successfully`);
  }
});

browserTest("Firefox DOM interaction", async (browser) => {
  const page = await browser.newPage();
  
  // Create a test page with interactive elements
  const testHTML = `
    <html>
      <head><title>DOM Test Page</title></head>
      <body>
        <h1 id="title">DOM Test</h1>
        <p id="content">Initial content</p>
        <button id="testBtn" onclick="document.getElementById('content').textContent='Button clicked!'">Click Me</button>
        <input id="testInput" type="text" placeholder="Type here">
      </body>
    </html>
  `;
  
  await page.goto(`data:text/html,${encodeURIComponent(testHTML)}`);
  
  // Test element selection
  const titleElement = await page.$("#title");
  assert(titleElement, "Should find title element");
  
  const titleText = await page.evaluate("document.getElementById('title')?.textContent");
  assertEquals(titleText, "DOM Test", "Should get correct title text");
  
  // Test clicking
  await page.click("#testBtn");
  
  // Wait a moment for the click to process
  await page.waitForTimeout(100);
  
  const updatedContent = await page.evaluate("document.getElementById('content')?.textContent");
  assertEquals(updatedContent, "Button clicked!", "Button click should update content");
  
  // Test typing
  await page.type("#testInput", "Hello from Puppeteer!");
  
  const inputValue = await page.evaluate("document.getElementById('testInput')?.value");
  assertEquals(inputValue, "Hello from Puppeteer!", "Should type text into input");
  
  console.log("✓ DOM interaction tests passed");
});

// Test to verify the executable path is correct
Deno.test("Firefox executable path is correct", async () => {
  const executablePath = getFirefoxExecutablePath();
  
  try {
    const fileInfo = await Deno.stat(executablePath);
    assert(fileInfo.mode && fileInfo.mode & 0o111, "Firefox executable should be executable");
    console.log(`✓ Firefox executable found at: ${executablePath}`);
  } catch (error) {
    throw new Error(`Firefox executable not found at ${executablePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
});