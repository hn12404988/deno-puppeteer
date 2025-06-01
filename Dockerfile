# `bookworm-20250520-slim` is arm64 linux
FROM debian:bookworm-20250520-slim

ENV DENO_VERSION=2.3.3
ARG DENO_ARM64_ZIP_URL=https://github.com/denoland/deno/releases/download/v2.3.5/deno-aarch64-unknown-linux-gnu.zip
ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get -qq update \
    && apt-get -qq install -y --no-install-recommends \
    curl \
    ca-certificates \
    unzip \
    bzip2 \
    xz-utils \
    file \
# ↓ https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#chrome-headless-doesnt-launch-on-unix
# Since I want to leave the contents of troubleshooting.md as it is, ca-certificates is intentionally duplicated here.
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
# ↑ https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#chrome-headless-doesnt-launch-on-unix
# ↓ Added based on the information obtained from by console.log(line) at https://deno.land/x/puppeteer@9.0.2/src/deno/BrowserRunner.ts#L168.
    libdrm2 \
    libxkbcommon0 \
    libxshmfence1 \
# ↑ Added based on the information obtained from by console.log(line) at https://deno.land/x/puppeteer@9.0.2/src/deno/BrowserRunner.ts#L168.
# ↓ Additional packages for better fontconfig compatibility
    fontconfig \
    fonts-dejavu-core \
    fonts-freefont-ttf \
# ↑ Additional packages for better fontconfig compatibility
    && curl -fsSL ${DENO_ARM64_ZIP_URL} \
    --output deno.zip \
    && unzip deno.zip \
    && rm deno.zip \
    && chmod 755 deno \
    && mv deno /usr/bin/deno \
    && apt-get -qq remove --purge -y \
    curl \
# Do not remove ca-certificates as it is required by puppeteer.
#    ca-certificates \
    unzip \
    && apt-get -y -qq autoremove \
    && apt-get -qq clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
# ↓ Fix fontconfig cache and permissions
    && fc-cache -fv # Rebuild font cache
    # && chmod -R 755 /var/cache/fontconfig # Removed chmod
    # && chmod -R 755 /usr/share/fontconfig # Removed chmod
# ↑ Fix fontconfig cache and permissions

RUN useradd --uid 1993 --user-group deno \
 && mkdir /deno-dir/ \
 && chown deno:deno /deno-dir/

ENV DENO_DIR /deno-dir/

# --- PLACE CUSTOM COMMANDS BELOW --- #

WORKDIR /root
COPY . . 

# https://deno.land/x/puppeteer@9.0.2#installation
# In your real script, replace the installation script with https://deno.land/x/puppeteer@9.0.2/install.ts
RUN deno run -A --unstable ./install.ts firefox arm64