import { assert } from "https://deno.land/std@0.93.0/testing/asserts.ts";
import puppeteer, { Browser } from "../../mod.ts";

/**
 * Helper function to create a browser test wrapper with correct Firefox path
 */
export function browserTest(
  name: string,
  fn: (browser: Browser) => void | Promise<void>,
  options: { product?: "chrome" | "firefox"; headless?: boolean } = {}
) {
  Deno.test(name, async () => {
    let browser: Browser | undefined = undefined;
    try {
      browser = await puppeteer.launch({
        product: options.product || "firefox",
        headless: options.headless !== false,
        executablePath: "/deno-dir/deno_puppeteer/firefox/linux-arm64-141.0a1/firefox/firefox",
        args: [
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor"
        ]
      });
      await fn(browser);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  });
}

/**
 * Check if a file exists and is executable
 */
export async function isExecutable(path: string): Promise<boolean> {
  try {
    const fileInfo = await Deno.stat(path);
    return !!(fileInfo.mode && fileInfo.mode & 0o111);
  } catch {
    return false;
  }
}

/**
 * Find Firefox binary in common locations
 */
export async function findFirefoxBinary(): Promise<string | null> {
  const commonPaths = [
    "/usr/bin/firefox",
    "/usr/local/bin/firefox",
    "/opt/firefox/firefox",
    "/snap/bin/firefox",
    "/deno-dir/deno_puppeteer/firefox/linux-arm64-141.0a1/firefox/firefox"
  ];

  for (const path of commonPaths) {
    if (await isExecutable(path)) {
      return path;
    }
  }

  // Try to find via which command
  try {
    const process = new Deno.Command("which", {
      args: ["firefox"],
      stdout: "piped",
      stderr: "piped"
    });
    const { stdout } = await process.output();
    const path = new TextDecoder().decode(stdout).trim();
    if (path && await isExecutable(path)) {
      return path;
    }
  } catch {
    // which command failed
  }

  return null;
}

/**
 * Get the correct Firefox executable path for the container
 */
export function getFirefoxExecutablePath(): string {
  return "/deno-dir/deno_puppeteer/firefox/linux-arm64-141.0a1/firefox/firefox";
}