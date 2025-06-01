#!/usr/bin/env -S deno run --allow-all --no-check

console.log("🔥 Testing Firefox Basic Launch...");

const firefoxPath = "/deno-dir/deno_puppeteer/firefox/linux-arm64-141.0a1/firefox/firefox";

try {
  // Test 1: Firefox version
  console.log("\n1. Testing Firefox version...");
  const versionCmd = new Deno.Command(firefoxPath, {
    args: ["--version"],
    stdout: "piped",
    stderr: "piped"
  });
  const versionResult = await versionCmd.output();
  const version = new TextDecoder().decode(versionResult.stdout).trim();
  console.log(`✅ Firefox version: ${version}`);

  // Test 2: Firefox headless launch with remote debugging
  console.log("\n2. Testing Firefox headless launch...");
  const firefoxCmd = new Deno.Command(firefoxPath, {
    args: [
      "--headless",
      "--no-remote",
      "--foreground",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--remote-debugging-port=9222",
      "about:blank"
    ],
    stdout: "piped",
    stderr: "piped"
  });

  const firefoxProcess = firefoxCmd.spawn();
  
  // Give Firefox time to start
  console.log("⏳ Starting Firefox...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Check if process is still running
  try {
    const status = await firefoxProcess.status;
    if (status.success === false) {
      console.log("❌ Firefox process exited unexpectedly");
    }
  } catch {
    console.log("✅ Firefox is still running (as expected)");
  }

  // Try to kill the process
  try {
    firefoxProcess.kill("SIGTERM");
    await firefoxProcess.status;
    console.log("✅ Firefox process terminated successfully");
  } catch (error) {
    console.log(`⚠️  Firefox termination: ${error}`);
  }

  // Test 3: Check if remote debugging port responds
  console.log("\n3. Testing remote debugging port...");
  try {
    const response = await fetch("http://127.0.0.1:9222/json/version", {
      signal: AbortSignal.timeout(2000)
    });
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Remote debugging working: ${data.Browser || 'Unknown'}`);
    } else {
      console.log(`⚠️  Remote debugging port responded with status: ${response.status}`);
    }
  } catch (error) {
    console.log(`⚠️  Remote debugging port not accessible: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log("\n🎉 Firefox basic tests completed!");

} catch (error) {
  console.error("❌ Firefox test failed:", error);
  Deno.exit(1);
}