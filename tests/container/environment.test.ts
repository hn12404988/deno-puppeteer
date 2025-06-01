import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.93.0/testing/asserts.ts";

/**
 * Environment Validation Tests
 * These tests verify that the container environment is properly configured for Firefox
 */

Deno.test("Firefox binary exists and is executable", async () => {
  const firefoxPaths = [
    "/usr/bin/firefox",
    "/usr/local/bin/firefox",
    "/opt/firefox/firefox",
    "/snap/bin/firefox",
    "/deno-dir/deno_puppeteer/firefox/linux-arm64-141.0a1/firefox/firefox"
  ];

  let firefoxFound = false;
  let executablePath = "";

  // Check common Firefox locations
  for (const path of firefoxPaths) {
    try {
      const fileInfo = await Deno.stat(path);
      if (fileInfo.mode && fileInfo.mode & 0o111) {
        firefoxFound = true;
        executablePath = path;
        break;
      }
    } catch {
      // Path doesn't exist, continue
    }
  }

  // Try using 'which' command as fallback
  if (!firefoxFound) {
    try {
      const process = new Deno.Command("which", {
        args: ["firefox"],
        stdout: "piped",
        stderr: "piped"
      });
      const { stdout, success } = await process.output();
      if (success) {
        const path = new TextDecoder().decode(stdout).trim();
        if (path) {
          const fileInfo = await Deno.stat(path);
          if (fileInfo.mode && fileInfo.mode & 0o111) {
            firefoxFound = true;
            executablePath = path;
          }
        }
      }
    } catch {
      // which command failed
    }
  }

  assert(firefoxFound, `Firefox binary not found in any of the expected locations: ${firefoxPaths.join(", ")}`);
  console.log(`✓ Firefox found at: ${executablePath}`);
});

Deno.test("Required system libraries are present", async () => {
  const requiredLibs = [
    "libgtk-3-0",
    "libnss3",
    "libxss1",
    "libxrandr2",
    "libasound2",
    "libpangocairo-1.0-0",
    "libatk1.0-0",
    "libcairo2",
    "libglib2.0-0"
  ];

  const missingLibs: string[] = [];

  for (const lib of requiredLibs) {
    try {
      const dpkgProcess = new Deno.Command("dpkg", {
        args: ["-l", lib],
        stdout: "piped",
        stderr: "piped"
      });
      const { success: dpkgSuccess } = await dpkgProcess.output();
      if (!dpkgSuccess) {
        missingLibs.push(lib);
      }
    } catch {
      missingLibs.push(lib);
    }
  }

  assert(
    missingLibs.length === 0,
    `Missing required libraries: ${missingLibs.join(", ")}`
  );
  console.log(`✓ All ${requiredLibs.length} required libraries are present`);
});

Deno.test("Font configuration is working", async () => {
  try {
    // Test fontconfig
    const process = new Deno.Command("fc-list", {
      args: [],
      stdout: "piped",
      stderr: "piped"
    });
    const { stdout, success } = await process.output();
    
    assert(success, "fc-list command failed");
    
    const output = new TextDecoder().decode(stdout);
    assert(output.length > 0, "No fonts found by fc-list");
    
    // Check for common fonts
    const hasDejaVu = output.includes("DejaVu");
    const hasLiberation = output.includes("Liberation");
    const hasFreeFont = output.includes("FreeSans") || output.includes("FreeSerif");
    
    assert(
      hasDejaVu || hasLiberation || hasFreeFont,
      "No common fonts (DejaVu, Liberation, or FreeFonts) found"
    );
    
    console.log("✓ Font configuration is working");
    console.log(`✓ Found fonts: DejaVu=${hasDejaVu}, Liberation=${hasLiberation}, FreeFonts=${hasFreeFont}`);
  } catch (error) {
    throw new Error(`Font configuration test failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

Deno.test("User permissions are correct", async () => {
  // Test write permissions in current directory
  const testFile = "./test-permissions.tmp";
  
  try {
    await Deno.writeTextFile(testFile, "test");
    await Deno.remove(testFile);
    console.log("✓ Write permissions in current directory: OK");
  } catch (error) {
    throw new Error(`Cannot write to current directory: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test /tmp directory access
  try {
    const tmpTestFile = "/tmp/test-permissions.tmp";
    await Deno.writeTextFile(tmpTestFile, "test");
    await Deno.remove(tmpTestFile);
    console.log("✓ Write permissions in /tmp directory: OK");
  } catch (error) {
    throw new Error(`Cannot write to /tmp directory: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Check if running as expected user
  try {
    const process = new Deno.Command("whoami", {
      stdout: "piped",
      stderr: "piped"
    });
    const { stdout, success } = await process.output();
    
    if (success) {
      const username = new TextDecoder().decode(stdout).trim();
      console.log(`✓ Running as user: ${username}`);
    }
  } catch {
    console.log("✓ Could not determine username, but permissions seem OK");
  }
});

Deno.test("Deno environment is properly set up", async () => {
  // Check Deno version
  const version = Deno.version;
  assert(version.deno, "Deno version not available");
  console.log(`✓ Deno version: ${version.deno}`);
  console.log(`✓ V8 version: ${version.v8}`);
  console.log(`✓ TypeScript version: ${version.typescript}`);

  // Check DENO_DIR environment variable
  const denoDir = Deno.env.get("DENO_DIR");
  if (denoDir) {
    console.log(`✓ DENO_DIR: ${denoDir}`);
    
    // Test if DENO_DIR is accessible
    try {
      const stat = await Deno.stat(denoDir);
      assert(stat.isDirectory, "DENO_DIR is not a directory");
      console.log("✓ DENO_DIR is accessible");
    } catch (error) {
      console.warn(`⚠ DENO_DIR not accessible: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    console.log("✓ DENO_DIR not set (using default)");
  }

  // Test basic Deno permissions
  const permissions = await Deno.permissions.query({ name: "read", path: "." });
  assertEquals(permissions.state, "granted", "Read permissions not granted");
  console.log("✓ Deno permissions are properly configured");
});

Deno.test("System resources are adequate", async () => {
  try {
    // Check available memory
    const meminfo = await Deno.readTextFile("/proc/meminfo");
    const totalMatch = meminfo.match(/MemTotal:\s+(\d+)\s+kB/);
    const availableMatch = meminfo.match(/MemAvailable:\s+(\d+)\s+kB/);
    
    if (totalMatch && availableMatch) {
      const totalMB = Math.round(parseInt(totalMatch[1]) / 1024);
      const availableMB = Math.round(parseInt(availableMatch[1]) / 1024);
      
      console.log(`✓ Total memory: ${totalMB} MB`);
      console.log(`✓ Available memory: ${availableMB} MB`);
      
      // Firefox typically needs at least 512MB to run comfortably
      assert(availableMB >= 256, `Insufficient memory: ${availableMB}MB available, need at least 256MB`);
    }
  } catch (error) {
    console.warn(`⚠ Could not check memory info: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Check disk space in current directory
  try {
    const process = new Deno.Command("df", {
      args: ["-h", "."],
      stdout: "piped",
      stderr: "piped"
    });
    const { stdout, success } = await process.output();
    
    if (success) {
      const output = new TextDecoder().decode(stdout);
      console.log("✓ Disk space info:");
      console.log(output);
    }
  } catch {
    console.warn("⚠ Could not check disk space");
  }
});