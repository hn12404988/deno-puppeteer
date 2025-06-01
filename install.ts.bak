import puppeteer from "./mod.ts";
import { PUPPETEER_REVISIONS } from "./vendor/puppeteer-core/puppeteer/revisions.js";

// Parse command line arguments
const args = Deno.args;

// Show usage if help is requested
if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: deno run --allow-all install.ts [product] [arch]");
  console.log("");
  console.log("Arguments:");
  console.log("  product  Browser product: 'chrome' or 'firefox' (default: chrome)");
  console.log("  arch     Architecture: 'x86_64' or 'arm64' (default: x86_64)");
  console.log("");
  console.log("Examples:");
  console.log("  deno run --allow-all install.ts chrome x86_64");
  console.log("  deno run --allow-all install.ts firefox arm64");
  console.log("");
  console.log("Note: Chrome does not support arm64 on Linux");
  Deno.exit(0);
}

let product = args[0] || Deno.env.get("PUPPETEER_PRODUCT");
let arch = args[1] || "x86_64"; // Default to x86_64 if not specified

// Validate product
if (product != "chrome" && product != "firefox") {
  if (product != undefined) {
    console.warn(`Unknown product '${product}', falling back to 'chrome'.`);
  }
  product = "chrome";
}

// Validate architecture
if (arch != "x86_64" && arch != "arm64") {
  console.warn(`Unknown architecture '${arch}', falling back to 'x86_64'.`);
  arch = "x86_64";
}

// Validate chrome + arm64 combination
if (product === "chrome" && arch === "arm64") {
  throw new Error("Chrome does not support arm64 on Linux. Please use Firefox or x86_64 architecture.");
}

console.log(`Using product: ${product}, architecture: ${arch}`);
const fetcher = puppeteer.createBrowserFetcher({ product, platform: getPlatform(arch) });

function getPlatform(arch: string): "linux" | "linux-arm64" | "mac" | "win32" | "win64" {
  const os = Deno.build.os;
  if (os === "linux") {
    return arch === "arm64" ? "linux-arm64" : "linux";
  } else if (os === "darwin") {
    return "mac";
  } else if (os === "windows") {
    return Deno.build.arch === "x86_64" ? "win64" : "win32";
  }
  throw new Error(`Unsupported platform: ${os}`);
}
let revision;
if (product == "chrome") {
  revision = Deno.env.get("PUPPETEER_CHROMIUM_REVISION") ||
    PUPPETEER_REVISIONS.chromium;
} else if (product == "firefox") {
  puppeteer._preferredRevision = PUPPETEER_REVISIONS.firefox;
  const req = await fetch(
    "https://product-details.mozilla.org/1.0/firefox_versions.json",
  );
  const versions = await req.json();
  revision = versions.FIREFOX_NIGHTLY;
  if (!versions.FIREFOX_NIGHTLY) {
    throw new Error("Firefox version not found");
  }
}

const revisionInfo = fetcher.revisionInfo(revision);
if (revisionInfo.local) {
  console.log(`Already downloaded at ${revisionInfo.executablePath}`);
} else {
  console.log(
    `Downloading ${revisionInfo.product} ${revisionInfo.revision} from ${revisionInfo.url}`,
  );
  const newRevisionInfo = await fetcher.download(
    revisionInfo.revision,
    (current, total) => {
      if (current === 0) {
        console.log("Starting download...");
      } else if (current === total) {
        console.log("Download complete.");
      } else {
        console.log(
          `Downloading... ${((current / total) * 100).toFixed(2)}%`,
        );
      }
    },
  );
  console.log(
    `Downloaded ${newRevisionInfo.product} ${newRevisionInfo.revision} to ${newRevisionInfo.executablePath} from ${newRevisionInfo.url}`,
  );
}
