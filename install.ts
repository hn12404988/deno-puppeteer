import puppeteer from "./mod.ts";
import { PUPPETEER_REVISIONS } from "./vendor/puppeteer-core/puppeteer/revisions.js";

let product = Deno.env.get("PUPPETEER_PRODUCT");
if (product != "chrome" && product != "firefox") {
  if (product != undefined) {
    console.warn(`Unknown product '${product}', falling back to 'chrome'.`);
  }
  product = "chrome";
}
console.log(`Using product: ${product}`);
const fetcher = puppeteer.createBrowserFetcher({ product });
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
