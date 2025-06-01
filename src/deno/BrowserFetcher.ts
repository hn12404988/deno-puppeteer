/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Product } from "../../vendor/puppeteer-core/puppeteer/common/Product.js";
import { debug } from "../../vendor/puppeteer-core/puppeteer/common/Debug.js";
import { assert } from "../../vendor/puppeteer-core/puppeteer/util/assert.js";
import {
  copyDir,
  exists,
  existsSync,
  pathJoin,
  pathResolve,
  sprintf,
} from "../../vendor/puppeteer-core/vendor/std.ts";
import { readZip } from "../../vendor/puppeteer-core/vendor/zip/mod.ts";
import { cachedir } from "../../vendor/puppeteer-core/vendor/cache.ts";

const debugFetcher = debug(`puppeteer:fetcher`);

const downloadURLs = {
  chrome: {
    linux: "%s/chromium-browser-snapshots/Linux_x64/%d/%s.zip",
    "linux-arm64": "%s/chromium-browser-snapshots/Linux_arm64/%d/%s.zip", // Not supported, but needed for type compatibility
    mac: "%s/chromium-browser-snapshots/Mac/%d/%s.zip",
    win32: "%s/chromium-browser-snapshots/Win/%d/%s.zip",
    win64: "%s/chromium-browser-snapshots/Win_x64/%d/%s.zip",
  },
  firefox: {
    linux: "%s/firefox-%s.en-US.%s-x86_64.tar.bz2",
    "linux-arm64": "%s/firefox-%s.en-US.%s-aarch64.tar.bz2", // Placeholder URL for Firefox arm64
    mac: "%s/firefox-%s.en-US.%s.dmg",
    win32: "%s/firefox-%s.en-US.%s.zip",
    win64: "%s/firefox-%s.en-US.%s.zip",
  },
} as const;

const browserConfig = {
  chrome: {
    host: "https://storage.googleapis.com",
    destination: "chromium",
  },
  firefox: {
    host:
      "https://archive.mozilla.org/pub/firefox/nightly/latest-mozilla-central",
    destination: "firefox",
  },
} as const;

/**
 * Supported platforms.
 * @public
 */
export type Platform = "linux" | "linux-arm64" | "mac" | "win32" | "win64";

function archiveName(
  product: Product,
  platform: Platform,
  revision: string
): string {
  if (product === "chrome") {
    if (platform === "linux") return "chrome-linux";
    if (platform === "linux-arm64") return "chrome-linux"; // Same archive name for arm64
    if (platform === "mac") return "chrome-mac";
    if (platform === "win32" || platform === "win64") {
      // Windows archive name changed at r591479.
      return parseInt(revision, 10) > 591479 ? "chrome-win" : "chrome-win32";
    }
  } else if (product === "firefox") {
    return platform;
  }
  throw new Error(`Unknown product: ${product}`);
}

/**
 * @internal
 */
function downloadURL(
  product: Product,
  platform: Platform,
  host: string,
  revision: string
): string {
  // Special case for Firefox - uses different domain and URL format
  if (product === "firefox" && platform === "linux-arm64") {
    return "https://download.mozilla.org/?product=firefox-nightly-latest-ssl&os=linux64-aarch64&lang=en-US&_gl=1*se5055*_ga*NDg5MjU3NzYxLjE3MzQ2OTg0MTQ.*_ga_MQ7767QQQW*czE3NDg3NzM0MTUkbzIkZzEkdDE3NDg3NzM4NDQkajQ3JGwwJGgw";
  }
  
  if (product === "firefox" && platform === "linux") {
    return "https://download.mozilla.org/?product=firefox-nightly-latest-ssl&os=linux64&lang=en-US&_gl=1*1lx0kac*_ga*NDg5MjU3NzYxLjE3MzQ2OTg0MTQ.*_ga_MQ7767QQQW*czE3NDg3NzM0MTUkbzIkZzEkdDE3NDg3NzM4NDQkajQ3JGwwJGgw";
  }
  
  const url = sprintf(
    downloadURLs[product][platform],
    host,
    revision,
    archiveName(product, platform, revision)
  );
  return url;
}

/**
 * @internal
 */
async function handleArm64(): Promise<void> {
  const stats = await Deno.stat("/usr/bin/chromium-browser");
  if (stats === undefined) {
    console.error(`The chromium binary is not available for arm64: `);
    console.error(`If you are on Ubuntu, you can install with: `);
    console.error(`\n apt-get install chromium-browser\n`);
    throw new Error();
  }
}

/**
 * @public
 */
export interface BrowserFetcherOptions {
  platform?: Platform;
  product?: string;
  path?: string;
  host?: string;
}

/**
 * @public
 */
export interface BrowserFetcherRevisionInfo {
  folderPath: string;
  executablePath: string;
  url: string;
  local: boolean;
  revision: string;
  product: string;
}
/**
 * BrowserFetcher can download and manage different versions of Chromium and Firefox.
 *
 * @remarks
 * BrowserFetcher operates on revision strings that specify a precise version of Chromium, e.g. `"533271"`. Revision strings can be obtained from {@link http://omahaproxy.appspot.com/ | omahaproxy.appspot.com}.
 * In the Firefox case, BrowserFetcher downloads Firefox Nightly and
 * operates on version numbers such as `"75"`.
 *
 * @example
 * An example of using BrowserFetcher to download a specific version of Chromium
 * and running Puppeteer against it:
 *
 * ```js
 * const browserFetcher = puppeteer.createBrowserFetcher();
 * const revisionInfo = await browserFetcher.download('533271');
 * const browser = await puppeteer.launch({executablePath: revisionInfo.executablePath})
 * ```
 *
 * **NOTE** BrowserFetcher is not designed to work concurrently with other
 * instances of BrowserFetcher that share the same downloads directory.
 *
 * @public
 */

export class BrowserFetcher {
  private _product: Product;
  private _downloadsFolder: string;
  private _downloadHost: string;
  private _platform!: Platform;

  /**
   * @internal
   */
  constructor(options: BrowserFetcherOptions = {}) {
    this._product = (options.product || "chrome").toLowerCase() as Product;
    assert(
      this._product === "chrome" || this._product === "firefox",
      `Unknown product: "${options.product}"`
    );

    this._downloadsFolder =
      options.path ||
      pathJoin(
        cachedir(),
        "deno_puppeteer",
        browserConfig[this._product].destination
      );
    this._downloadHost = options.host || browserConfig[this._product].host;
    this.setPlatform(options.platform);
    assert(
      downloadURLs[this._product][this._platform],
      "Unsupported platform: " + this._platform
    );
  }

  private setPlatform(platformFromOptions?: Platform): void {
    if (platformFromOptions) {
      this._platform = platformFromOptions;
      return;
    }

    const platform = Deno.build.os;
    if (platform === "darwin") this._platform = "mac";
    else if (platform === "linux") this._platform = "linux";
    else if (platform === "windows") {
      this._platform = Deno.build.arch === "x86_64" ? "win64" : "win32";
    } else assert(this._platform, "Unsupported platform: " + Deno.build.os);
  }

  /**
   * @returns Returns the current `Platform`.
   */
  platform(): Platform {
    return this._platform;
  }

  /**
   * @returns Returns the current `Product`.
   */
  product(): Product {
    return this._product;
  }

  /**
   * @returns The download host being used.
   */
  host(): string {
    return this._downloadHost;
  }

  /**
   * Initiates a HEAD request to check if the revision is available.
   * @remarks
   * This method is affected by the current `product`.
   * @param revision - The revision to check availability for.
   * @returns A promise that resolves to `true` if the revision could be downloaded
   * from the host.
   */
  async canDownload(revision: string): Promise<boolean> {
    const url = downloadURL(
      this._product,
      this._platform,
      this._downloadHost,
      revision
    );
    const req = await fetch(url, { method: "head" });
    return req.status == 200;
  }

  /**
   * Initiates a GET request to download the revision from the host.
   * @remarks
   * This method is affected by the current `product`.
   * @param revision - The revision to download.
   * @param progressCallback - A function that will be called with two arguments:
   * How many bytes have been downloaded and the total number of bytes of the download.
   * @returns A promise with revision information when the revision is downloaded
   * and extracted.
   */
  async download(
    revision: string,
    progressCallback: (x: number, y: number) => void = (): void => {}
  ): Promise<BrowserFetcherRevisionInfo> {
    const url = downloadURL(
      this._product,
      this._platform,
      this._downloadHost,
      revision
    );
    
    let fileName: string;
    let actualFileName: string | null = null;
    
    if (this._product === "firefox" && (this._platform === "linux" || this._platform === "linux-arm64")) {
      // For Firefox Linux downloads, we need to detect the actual filename from the response
      const arch = this._platform === "linux-arm64" ? "aarch64" : "x86_64";
      fileName = `firefox-${revision}.en-US.linux-${arch}.tar.bz2`;
      
      // Get the actual filename from the response headers
      const response = await fetch(url, { method: "HEAD" });
      const contentDisposition = response.headers.get("content-disposition");
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          actualFileName = match[1].replace(/['"]/g, '');
        }
      }
      
      // If we got an actual filename, use it
      if (actualFileName) {
        fileName = actualFileName;
      }
    } else {
      fileName = url.split("/").pop()!;
    }
    const archivePath = pathJoin(this._downloadsFolder, fileName);
    const outputPath = this._getFolderPath(revision);
    if (await exists(outputPath)) return this.revisionInfo(revision);
    if (!(await exists(this._downloadsFolder))) {
      await Deno.mkdir(this._downloadsFolder, { recursive: true });
    }
    if ((Deno.build.arch as string) === "arm64" && this._product === "chrome") {
      // handleArm64();
      // return;
      console.error("Chrome arm64 downloads not supported on Linux.");
      console.error(
        "Use PUPPETEER_EXECUTABLE_PATH to specify an executable path or use Firefox."
      );
      throw new Error();
    }
    try {
      await downloadFile(url, archivePath, progressCallback);
      
      // For Firefox Linux downloads, detect the actual file type and rename if necessary
      if (this._product === "firefox" && (this._platform === "linux" || this._platform === "linux-arm64")) {
        const actualArchivePath = await detectAndRenameArchive(archivePath);
        await install(actualArchivePath, outputPath);
      } else {
        await install(archivePath, outputPath);
      }
    } finally {
      if (await exists(archivePath)) {
        await Deno.remove(archivePath, { recursive: true });
      }
    }
    const revisionInfo = this.revisionInfo(revision);
    if (revisionInfo && Deno.build.os !== "windows") {
      await Deno.chmod(revisionInfo.executablePath, 0o755);
      if (Deno.build.os === "darwin" && this._product === "chrome") {
        await macOSMakeChromiumHelpersExecutable(revisionInfo.executablePath);
      }
    }
    return revisionInfo;
  }

  /**
   * @remarks
   * This method is affected by the current `product`.
   * @returns A promise with a list of all revision strings (for the current `product`)
   * available locally on disk.
   */
  async localRevisions(): Promise<string[]> {
    if (!(await exists(this._downloadsFolder))) return [];
    const fileNames = [];
    for await (const file of Deno.readDir(this._downloadsFolder)) {
      fileNames.push(file.name);
    }
    return fileNames
      .map((fileName) => parseName(this._product, fileName))
      .filter((entry) => entry && entry.platform === this._platform)
      .map((entry) => entry!.revision);
  }

  /**
   * @remarks
   * This method is affected by the current `product`.
   * @param revision - A revision to remove for the current `product`.
   * @returns A promise that resolves when the revision has been removes or
   * throws if the revision has not been downloaded.
   */
  async remove(revision: string): Promise<void> {
    const folderPath = this._getFolderPath(revision);
    assert(
      await exists(folderPath),
      `Failed to remove: revision ${revision} is not downloaded`
    );
    await Deno.remove(folderPath, { recursive: true });
  }

  /**
   * @param revision - The revision to get info for.
   * @returns The revision info for the given revision.
   */
  revisionInfo(revision: string): BrowserFetcherRevisionInfo {
    const folderPath = this._getFolderPath(revision);
    let executablePath = "";
    if (this._product === "chrome") {
      if (this._platform === "mac") {
        executablePath = pathJoin(
          folderPath,
          archiveName(this._product, this._platform, revision),
          "Chromium.app",
          "Contents",
          "MacOS",
          "Chromium"
        );
      } else if (this._platform === "linux" || this._platform === "linux-arm64") {
        executablePath = pathJoin(
          folderPath,
          archiveName(this._product, this._platform, revision),
          "chrome"
        );
      } else if (this._platform === "win32" || this._platform === "win64") {
        executablePath = pathJoin(
          folderPath,
          archiveName(this._product, this._platform, revision),
          "chrome.exe"
        );
      } else throw new Error("Unsupported platform: " + this._platform);
    } else if (this._product === "firefox") {
      if (this._platform === "mac") {
        executablePath = pathJoin(
          folderPath,
          "Firefox Nightly.app",
          "Contents",
          "MacOS",
          "firefox"
        );
      } else if (this._platform === "linux" || this._platform === "linux-arm64") {
        executablePath = pathJoin(folderPath, "firefox", "firefox");
      } else if (this._platform === "win32" || this._platform === "win64") {
        executablePath = pathJoin(folderPath, "firefox", "firefox.exe");
      } else throw new Error("Unsupported platform: " + this._platform);
    } else {
      throw new Error("Unsupported product: " + this._product);
    }
    const url = downloadURL(
      this._product,
      this._platform,
      this._downloadHost,
      revision
    );
    const local = existsSync(folderPath);
    debugFetcher({
      revision,
      executablePath,
      folderPath,
      local,
      url,
      product: this._product,
    });
    return {
      revision,
      executablePath,
      folderPath,
      local,
      url,
      product: this._product,
    };
  }

  /**
   * @internal
   */
  _getFolderPath(revision: string): string {
    return pathJoin(this._downloadsFolder, this._platform + "-" + revision);
  }
}

function parseName(
  product: Product,
  name: string
): { product: string; platform: string; revision: string } | null {
  const splits = name.split("-");
  let platform: string;
  let revision: string;
  
  if (splits.length === 2) {
    // Standard case: platform-revision
    [platform, revision] = splits;
  } else if (splits.length === 3 && splits[0] === "linux" && splits[1] === "arm64") {
    // Special case: linux-arm64-revision
    platform = "linux-arm64";
    revision = splits[2];
  } else {
    return null;
  }
  
  if (!downloadURLs[product]?.[platform as Platform]) return null;
  return { product, platform, revision };
}

/**
 * @internal
 */
async function downloadFile(
  url: string,
  destinationPath: string,
  progressCallback: (x: number, y: number) => void
): Promise<void> {
  debugFetcher(`Downloading binary from ${url}`);

  const response = await fetch(url, { method: "GET" });

  if (response.status !== 200) {
    const error = new Error(
      `Download failed: server returned code ${response.status}. URL: ${url}`
    );

    // consume response data to free up memory
    await response.arrayBuffer();
    throw error;
  }

  const totalBytes = parseInt(response.headers.get("content-length") ?? "", 10);
  let downloadedBytes = 0;

  const file = await Deno.create(destinationPath);

  // @ts-ignore because in lib.dom ReadableStream is not an async iterator yet
  for await (const chunk of response.body!) {
    downloadedBytes += chunk.length;
    progressCallback?.(downloadedBytes, totalBytes);
    await file.write(chunk);
  }
}

function install(archivePath: string, folderPath: string): Promise<unknown> {
  debugFetcher(`Installing ${archivePath} to ${folderPath}`);
  if (archivePath.endsWith(".zip")) return extractZip(archivePath, folderPath);
  else if (archivePath.endsWith(".tar.bz2")) {
    return extractTarBz2(archivePath, folderPath);
  } else if (archivePath.endsWith(".tar.gz")) {
    return extractTarGz(archivePath, folderPath);
  } else if (archivePath.endsWith(".tar.xz")) {
    return extractTarXz(archivePath, folderPath);
  } else if (archivePath.endsWith(".dmg")) {
    return Deno.mkdir(folderPath, { recursive: true }).then(() =>
      installDMG(archivePath, folderPath)
    );
  } else throw new Error(`Unsupported archive format: ${archivePath}`);
}

async function extractZip(zipPath: string, folderPath: string): Promise<void> {
  const z = await readZip(zipPath);
  await z.unzip(folderPath);
}

/**
 * @internal
 */
async function extractTarBz2(tarPath: string, folderPath: string): Promise<void> {
  console.log(folderPath);
  await Deno.mkdir(folderPath, { recursive: true });

  const bzcat = new Deno.Command("bzcat", {
    args: [tarPath],
    stdout: "piped",
  });
  const bzcatProcess = bzcat.spawn();
  const tmp = await Deno.makeTempFile();
  const file = await Deno.create(tmp);
  await bzcatProcess.stdout.pipeTo(file.writable);
  const bzcatStatus = await bzcatProcess.status;
  assert(bzcatStatus.success, "failed bzcat");

  const untar = new Deno.Command("tar", {
    args: ["-C", folderPath, "-xvf", tmp],
  });
  const untarProcess = untar.spawn();
  const untarStatus = await untarProcess.status;
  assert(untarStatus.success, "failed untar");
}

/**
 * @internal
 */
async function extractTarGz(tarPath: string, folderPath: string): Promise<void> {
  console.log(folderPath);
  await Deno.mkdir(folderPath, { recursive: true });

  const untar = new Deno.Command("tar", {
    args: ["-C", folderPath, "-xzf", tarPath],
  });
  const untarProcess = untar.spawn();
  const untarStatus = await untarProcess.status;
  assert(untarStatus.success, "failed untar");
}

/**
 * @internal
 */
async function extractTarXz(tarPath: string, folderPath: string): Promise<void> {
  console.log(folderPath);
  await Deno.mkdir(folderPath, { recursive: true });

  const untar = new Deno.Command("tar", {
    args: ["-C", folderPath, "-xJf", tarPath],
  });
  const untarProcess = untar.spawn();
  const untarStatus = await untarProcess.status;
  assert(untarStatus.success, "failed untar");
}

/**
 * @internal
 */
async function detectAndRenameArchive(archivePath: string): Promise<string> {
  // Read the first few bytes to detect file type
  const file = await Deno.open(archivePath, { read: true });
  const buffer = new Uint8Array(20);
  await file.read(buffer);
  file.close();
  
  // Log the file header for debugging
  console.log(`File header bytes: ${Array.from(buffer.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
  
  // Check for XZ magic number (fd 37 7a 58 5a 00)
  if (buffer[0] === 0xfd && buffer[1] === 0x37 && buffer[2] === 0x7a &&
      buffer[3] === 0x58 && buffer[4] === 0x5a && buffer[5] === 0x00) {
    console.log("Detected XZ format");
    const newPath = archivePath.replace(/\.tar\.bz2$/, '.tar.xz');
    await Deno.rename(archivePath, newPath);
    return newPath;
  }
  
  // Check for gzip magic number (1f 8b)
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
    console.log("Detected gzip format");
    const newPath = archivePath.replace(/\.tar\.bz2$/, '.tar.gz');
    await Deno.rename(archivePath, newPath);
    return newPath;
  }
  
  // Check for bzip2 magic number (BZ)
  if (buffer[0] === 0x42 && buffer[1] === 0x5a) {
    console.log("Detected bzip2 format");
    return archivePath;
  }
  
  // Check for ZIP magic number (PK)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    console.log("Detected ZIP format");
    const newPath = archivePath.replace(/\.tar\.bz2$/, '.zip');
    await Deno.rename(archivePath, newPath);
    return newPath;
  }
  
  // Try to use file command to detect the type
  try {
    const fileCmd = new Deno.Command("file", {
      args: [archivePath],
      stdout: "piped",
    });
    const result = await fileCmd.output();
    const output = new TextDecoder().decode(result.stdout);
    console.log(`File command output: ${output}`);
    
    if (output.includes("gzip")) {
      console.log("File command detected gzip");
      const newPath = archivePath.replace(/\.tar\.bz2$/, '.tar.gz');
      await Deno.rename(archivePath, newPath);
      return newPath;
    } else if (output.includes("bzip2")) {
      console.log("File command detected bzip2");
      return archivePath;
    } else if (output.includes("Zip")) {
      console.log("File command detected ZIP");
      const newPath = archivePath.replace(/\.tar\.bz2$/, '.zip');
      await Deno.rename(archivePath, newPath);
      return newPath;
    }
  } catch (error) {
    console.log(`File command failed: ${error}`);
  }
  
  // If we can't detect, keep original and let it fail with a better error
  console.log("Could not detect file format, keeping original name");
  return archivePath;
}

/**
 * @internal
 */
async function installDMG(dmgPath: string, folderPath: string): Promise<void> {
  let mountPath;
  try {
    const proc = new Deno.Command("hdiutil", {
      args: ["attach", "-nobrowse", "-noautoopen", dmgPath],
      stdout: "piped",
    });
    const procResult = await proc.output();
    const stdout = new TextDecoder().decode(procResult.stdout);
    const volumes = stdout.match(/\/Volumes\/(.*)/m);
    if (!volumes) throw new Error(`Could not find volume path in ${stdout}`);
    mountPath = volumes[0];

    let appName = undefined;
    for await (const file of Deno.readDir(mountPath)) {
      if (file.name.endsWith(".app")) {
        appName = file.name;
        break;
      }
    }
    if (!appName) throw new Error(`Cannot find app in ${mountPath}`);
    copyDir(pathJoin(mountPath, appName), folderPath);
  } finally {
    if (mountPath) {
      const proc = new Deno.Command("hdiutil", {
        args: ["detach", mountPath, "-quiet"],
      });
      debugFetcher(`Unmounting ${mountPath}`);
      const status = await proc.output();
      assert(status.success, "unmounting failed");
    }
  }
}

/**
 * @internal
 */
async function macOSMakeChromiumHelpersExecutable(executablePath: string) {
  const helperApps = [
    "Chromium Helper",
    "Chromium Helper (GPU)",
    "Chromium Helper (Plugin)",
    "Chromium Helper (Renderer)",
  ];

  const frameworkPath = pathResolve(
    executablePath,
    pathJoin("..", "..", "Frameworks", "Chromium Framework.framework", "Versions"),
  );
  const versionPath = pathJoin(frameworkPath, "Current");

  try {
    const version = await Deno.readTextFile(versionPath);

    for (const helperApp of helperApps) {
      const helperAppPath = pathJoin(
        frameworkPath,
        version,
        "Helpers",
        helperApp + ".app",
        "Contents",
        "MacOS",
        helperApp,
      );
      await Deno.chmod(helperAppPath, 0o755);
    }
  } catch (err) {
    console.error('Failed to make Chromium Helpers executable', String(err));
  }
}
