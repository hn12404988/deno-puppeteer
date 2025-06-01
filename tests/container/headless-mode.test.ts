import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.93.0/testing/asserts.ts";
import puppeteer, { Browser, Page } from "../../mod.ts";

/**
 * Headless Mode Tests
 * These tests verify core Puppeteer functionality works in headless mode
 */

function browserTest(
  name: string,
  fn: (browser: Browser) => void | Promise<void>,
) {
  Deno.test(name, async () => {
    let browser: Browser | undefined = undefined;
    try {
      browser = await puppeteer.launch({
        product: "firefox",
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-web-security"
        ]
      });
      await fn(browser);
    } catch (error) {
      throw new Error(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.warn(`Warning: Error closing browser: ${closeError instanceof Error ? closeError.message : String(closeError)}`);
        }
      }
    }
  });
}

browserTest("Page navigation to external sites", async (browser) => {
  const page = await browser.newPage();
  
  // Test navigation to a simple data URL first
  await page.goto("data:text/html,<h1>Test Page</h1><p>Hello World</p>");
  
  const title = await page.evaluate("document.querySelector('h1')?.textContent");
  assertEquals(title, "Test Page", "Should navigate to data URL successfully");
  
  console.log("✓ Data URL navigation successful");
  
  // Test navigation to example.com (if network is available)
  try {
    await page.goto("https://example.com", { waitUntil: "domcontentloaded", timeout: 10000 });
    
    const exampleTitle = await page.title();
    assert(exampleTitle.includes("Example"), "Should load example.com successfully");
    
    console.log("✓ External site navigation successful");
  } catch (error) {
    console.warn(`⚠ External site navigation failed (network may not be available): ${error instanceof Error ? error.message : String(error)}`);
    // This is not a critical failure in a container environment
  }
});

browserTest("Screenshot generation (PNG/JPEG)", async (browser) => {
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
  
  // Verify PNG header
  const pngHeader = Array.from(pngScreenshot.slice(0, 8));
  const expectedPngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
  assertEquals(pngHeader, expectedPngHeader, "Should have valid PNG header");
  
  console.log(`✓ PNG screenshot generated: ${pngScreenshot.length} bytes`);
  
  // Test JPEG screenshot
  const jpegScreenshot = await page.screenshot({ 
    type: "jpeg",
    quality: 80,
    fullPage: true
  });
  
  assert(jpegScreenshot instanceof Uint8Array, "JPEG screenshot should be a Uint8Array");
  assert(jpegScreenshot.length > 0, "JPEG screenshot should not be empty");
  
  // Verify JPEG header
  const jpegHeader = Array.from(jpegScreenshot.slice(0, 3));
  const expectedJpegHeader = [255, 216, 255];
  assertEquals(jpegHeader, expectedJpegHeader, "Should have valid JPEG header");
  
  console.log(`✓ JPEG screenshot generated: ${jpegScreenshot.length} bytes`);
});

browserTest("Basic DOM interaction", async (browser) => {
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
        <div id="result"></div>
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

browserTest("JavaScript execution", async (browser) => {
  const page = await browser.newPage();
  
  await page.goto("data:text/html,<html><body><div id='test'></div></body></html>");
  
  // Test simple JavaScript execution
  const result = await page.evaluate("2 + 2");
  assertEquals(result, 4, "Should execute simple math");
  
  // Test DOM manipulation via JavaScript
  await page.evaluate(`
    document.getElementById('test').innerHTML = '<p>JavaScript executed successfully</p>';
  `);
  
  const content = await page.evaluate("document.getElementById('test')?.innerHTML") as string;
  assert(content?.includes("JavaScript executed successfully"), "Should execute DOM manipulation");
  
  // Test complex JavaScript with return value
  const complexResult = await page.evaluate(`
    const arr = [1, 2, 3, 4, 5];
    const sum = arr.reduce((a, b) => a + b, 0);
    const doubled = arr.map(x => x * 2);
    return { sum, doubled, length: arr.length };
  `) as { sum: number; doubled: number[]; length: number };
  
  assertEquals(complexResult.sum, 15, "Should calculate sum correctly");
  assertEquals(complexResult.doubled, [2, 4, 6, 8, 10], "Should double array correctly");
  assertEquals(complexResult.length, 5, "Should return correct array length");
  
  console.log("✓ JavaScript execution tests passed");
});

browserTest("Page content extraction", async (browser) => {
  const page = await browser.newPage();
  
  const testHTML = `
    <html>
      <head>
        <title>Content Extraction Test</title>
        <meta name="description" content="Test page for content extraction">
      </head>
      <body>
        <header>
          <h1>Main Title</h1>
          <nav>
            <a href="#section1">Section 1</a>
            <a href="#section2">Section 2</a>
          </nav>
        </header>
        <main>
          <section id="section1">
            <h2>Section 1 Title</h2>
            <p class="content">This is section 1 content.</p>
          </section>
          <section id="section2">
            <h2>Section 2 Title</h2>
            <p class="content">This is section 2 content.</p>
          </section>
        </main>
        <footer>
          <p>&copy; 2024 Test Page</p>
        </footer>
      </body>
    </html>
  `;
  
  await page.goto(`data:text/html,${encodeURIComponent(testHTML)}`);
  
  // Test title extraction
  const title = await page.title();
  assertEquals(title, "Content Extraction Test", "Should extract page title");
  
  // Test meta description extraction
  const description = await page.evaluate("document.querySelector('meta[name=\"description\"]')?.getAttribute('content')");
  assertEquals(description, "Test page for content extraction", "Should extract meta description");
  
  // Test multiple element extraction
  const sectionTitles = await page.evaluate(`
    Array.from(document.querySelectorAll('h2')).map(h2 => h2.textContent)
  `);
  assertEquals(sectionTitles, ["Section 1 Title", "Section 2 Title"], "Should extract all section titles");
  
  // Test content extraction with class selector
  const contentParagraphs = await page.evaluate(`
    Array.from(document.querySelectorAll('.content')).map(p => p.textContent)
  `) as string[];
  assertEquals(contentParagraphs.length, 2, "Should find 2 content paragraphs");
  assert(contentParagraphs[0]?.includes("section 1"), "Should extract section 1 content");
  assert(contentParagraphs[1]?.includes("section 2"), "Should extract section 2 content");
  
  // Test link extraction
  const links = await page.evaluate(`
    Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.textContent,
      href: a.getAttribute('href')
    }))
  `) as Array<{ text: string; href: string }>;
  assertEquals(links.length, 2, "Should find 2 links");
  assertEquals(links[0].text, "Section 1", "Should extract first link text");
  assertEquals(links[0].href, "#section1", "Should extract first link href");
  
  console.log("✓ Content extraction tests passed");
});

browserTest("Form interaction", async (browser) => {
  const page = await browser.newPage();
  
  const formHTML = `
    <html>
      <body>
        <form id="testForm">
          <input type="text" id="name" name="name" placeholder="Name">
          <input type="email" id="email" name="email" placeholder="Email">
          <select id="country" name="country">
            <option value="">Select Country</option>
            <option value="us">United States</option>
            <option value="uk">United Kingdom</option>
            <option value="ca">Canada</option>
          </select>
          <textarea id="message" name="message" placeholder="Message"></textarea>
          <input type="checkbox" id="subscribe" name="subscribe" value="yes">
          <label for="subscribe">Subscribe to newsletter</label>
          <input type="radio" id="male" name="gender" value="male">
          <label for="male">Male</label>
          <input type="radio" id="female" name="gender" value="female">
          <label for="female">Female</label>
          <button type="submit" id="submitBtn">Submit</button>
        </form>
        <div id="result"></div>
        <script>
          document.getElementById('testForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());
            document.getElementById('result').textContent = JSON.stringify(data);
          });
        </script>
      </body>
    </html>
  `;
  
  await page.goto(`data:text/html,${encodeURIComponent(formHTML)}`);
  
  // Fill out the form
  await page.type("#name", "John Doe");
  await page.type("#email", "john@example.com");
  await page.select("#country", "us");
  await page.type("#message", "This is a test message");
  await page.click("#subscribe");
  await page.click("#male");
  
  // Verify form values
  const nameValue = await page.evaluate("document.getElementById('name')?.value");
  assertEquals(nameValue, "John Doe", "Name field should be filled");
  
  const emailValue = await page.evaluate("document.getElementById('email')?.value");
  assertEquals(emailValue, "john@example.com", "Email field should be filled");
  
  const countryValue = await page.evaluate("document.getElementById('country')?.value");
  assertEquals(countryValue, "us", "Country should be selected");
  
  const messageValue = await page.evaluate("document.getElementById('message')?.value");
  assertEquals(messageValue, "This is a test message", "Message should be filled");
  
  const subscribeChecked = await page.evaluate("document.getElementById('subscribe')?.checked");
  assertEquals(subscribeChecked, true, "Subscribe checkbox should be checked");
  
  const genderValue = await page.evaluate("document.querySelector('input[name=\"gender\"]:checked')?.value");
  assertEquals(genderValue, "male", "Gender radio button should be selected");
  
  // Submit the form
  await page.click("#submitBtn");
  
  // Wait for form submission to process
  await page.waitForTimeout(100);
  
  // Check the result
  const result = await page.evaluate("document.getElementById('result')?.textContent") as string;
  assert(result, "Form submission should produce a result");
  
  const resultData = JSON.parse(result);
  assertEquals(resultData.name, "John Doe", "Submitted data should include name");
  assertEquals(resultData.email, "john@example.com", "Submitted data should include email");
  assertEquals(resultData.country, "us", "Submitted data should include country");
  assertEquals(resultData.subscribe, "yes", "Submitted data should include subscription");
  assertEquals(resultData.gender, "male", "Submitted data should include gender");
  
  console.log("✓ Form interaction tests passed");
});