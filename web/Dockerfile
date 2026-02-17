FROM node:22-bullseye

ARG PRUSA_VERSION=2.7.4
ENV DEBIAN_FRONTEND=noninteractive

# Install runtime deps required by PrusaSlicer and tooling
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    bzip2 \
    xz-utils \
    tar \
    libglib2.0-0 \
    libgtk-3-0 \
    libx11-6 \
    libxext6 \
    libxrender1 \
    libxrandr2 \
    libxi6 \
    libsm6 \
    libice6 \
    libfontconfig1 \
    libfreetype6 \
    libstdc++6 \
    libglu1-mesa \
    libxcb1 \
    libgomp1 \
    ca-certificates \
    unzip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Download PrusaSlicer from official GitHub releases using the provided PRUSA_VERSION ARG.
# Try a few common asset naming patterns and both tag formats (with and without leading 'v').
RUN set -eux; \
  mkdir -p /opt/prusaslicer; \
  # Query GitHub Releases API for the requested tag (try v$PRUSA_VERSION then $PRUSA_VERSION)
  ASSET_URL=""; \
  for TAG in "v${PRUSA_VERSION}" "${PRUSA_VERSION}"; do \
    API_URL="https://api.github.com/repos/prusa3d/PrusaSlicer/releases/tags/${TAG}"; \
    echo "Querying $API_URL"; \
    ASSET_URL=$(curl -s "$API_URL" | grep "browser_download_url" | cut -d '"' -f4 | grep -i linux | grep -i gtk3 | grep -E "x86_64|amd64" | grep -E '\\.(tar\\.xz|tar\\.gz|AppImage)' | head -n1 || true); \
    if [ -n "$ASSET_URL" ]; then \
      echo "Found asset URL: $ASSET_URL"; break; \
    fi; \
  done; \
  if [ -z "$ASSET_URL" ]; then echo "Could not find a GTK3 linux x86_64 asset for PrusaSlicer ${PRUSA_VERSION}" >&2; exit 1; fi; \
  echo "Downloading PrusaSlicer from $ASSET_URL"; \
  wget -q -O /tmp/prusaslicer.asset "$ASSET_URL" || (echo "Download failed" >&2; exit 1); \
  # Determine file type and extract
  FILETYPE=$(file /tmp/prusaslicer.asset || true); \
  if echo "$FILETYPE" | grep -qi "XZ"; then tar -xJf /tmp/prusaslicer.asset -C /opt/prusaslicer || (echo "tar.xz extraction failed" >&2; ls -la /tmp || true; exit 1); fi; \
  if echo "$FILETYPE" | grep -qi "gzip"; then tar -xzf /tmp/prusaslicer.asset -C /opt/prusaslicer || (echo "tar.gz extraction failed" >&2; ls -la /tmp || true; exit 1); fi; \
  if echo "$FILETYPE" | grep -qi "AppImage" || echo "$ASSET_URL" | grep -qi "AppImage"; then chmod +x /tmp/prusaslicer.asset; /tmp/prusaslicer.asset --appimage-extract; mv squashfs-root/* /opt/prusaslicer || true; fi; \
  echo "Extracting PrusaSlicer archive to /opt/prusaslicer"; \
  tar -xJf /tmp/prusaslicer.tar.xz -C /opt/prusaslicer || (echo "tar extraction failed" >&2; ls -la /tmp || true; exit 1); \
  echo "Listing extracted files (top-level)"; ls -la /opt/prusaslicer || true; \
  echo "Listing extracted files (one level down)"; ls -la /opt/prusaslicer/* || true; \
  # Locate prusa-slicer binary (case-insensitive) or AppRun wrappers
  BIN=$(find /opt/prusaslicer -type f \( -iname 'prusa-slicer' -o -iname 'PrusaSlicer' -o -iname 'AppRun' \) -perm /111 | head -n1 || true); \
  # Also try common usr/bin locations if not found above
  if [ -z "$BIN" ]; then \
    BIN=$(find /opt/prusaslicer -type f -path '*/usr/bin/*prusa*' -perm /111 | head -n1 || true); \
  fi; \
  if [ -n "$BIN" ]; then \
    echo "Found binary: $BIN"; cp "$BIN" /usr/local/bin/prusa-slicer; \
  else \
    echo "prusa-slicer executable not found in extracted archive" >&2; ls -R /opt/prusaslicer || true; exit 1; \
  fi; \
  chmod +x /usr/local/bin/prusa-slicer; rm -f /tmp/prusaslicer.tar.xz || true

# Verify PrusaSlicer is available (fail build if not)
RUN /usr/local/bin/prusa-slicer --version
RUN which prusa-slicer || true
RUN ls -la /usr/local/bin/prusa-slicer || true

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --production=false

COPY . .

# Build Next app
RUN npm run build

ENV PORT=3000
EXPOSE ${PORT}

# Run Next in production
CMD ["npm", "start"]
