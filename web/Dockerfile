FROM node:22-bullseye

ENV DEBIAN_FRONTEND=noninteractive

# Install runtime deps required by PrusaSlicer AppImage and tooling
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    curl \
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
    unzip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Download latest PrusaSlicer AppImage from GitHub Releases (uses API to avoid brittle hardcoded URLs)
# This finds the first linux64 AppImage asset on the latest release and downloads it.
RUN set -eux; \
  # Find a suitable linux64 asset (prefer tar.* or tar.xz, fall back to AppImage)
  ASSET_LINE=$(curl -s https://api.github.com/repos/prusa3d/PrusaSlicer/releases/latest | grep "browser_download_url" | grep linux64 | head -n1 || true); \
  ASSET_URL=$(echo "$ASSET_LINE" | cut -d '"' -f4); \
  if [ -z "$ASSET_URL" ]; then echo "Could not determine PrusaSlicer asset URL" >&2; exit 1; fi; \
  echo "Downloading PrusaSlicer asset: $ASSET_URL"; \
  wget -q -O /tmp/prusaslicer.asset "$ASSET_URL"; \
  # Extract based on file type
  file /tmp/prusaslicer.asset || true; \
  if file /tmp/prusaslicer.asset | grep -q "XZ compressed" || file /tmp/prusaslicer.asset | grep -q "XZ"; then \
    mkdir -p /tmp/prusaslicer && tar -xJf /tmp/prusaslicer.asset -C /tmp/prusaslicer --strip-components=0 || true; \
    mv /tmp/prusaslicer/* /opt/prusaslicer || true; \
  elif file /tmp/prusaslicer.asset | grep -q "gzip compressed" || file /tmp/prusaslicer.asset | grep -q "gzip"; then \
    mkdir -p /tmp/prusaslicer && tar -xzf /tmp/prusaslicer.asset -C /tmp/prusaslicer --strip-components=0 || true; \
    mv /tmp/prusaslicer/* /opt/prusaslicer || true; \
  elif file /tmp/prusaslicer.asset | grep -q "ISO 9660" || file /tmp/prusaslicer.asset | grep -q "AppImage" || echo "$ASSET_URL" | grep -q "AppImage"; then \
    chmod +x /tmp/prusaslicer.asset; /tmp/prusaslicer.asset --appimage-extract; mv squashfs-root /opt/prusaslicer || true; \
  else \
    # fallback: try to treat as tar
    mkdir -p /tmp/prusaslicer && tar -xvf /tmp/prusaslicer.asset -C /tmp/prusaslicer || true; mv /tmp/prusaslicer/* /opt/prusaslicer || true; \
  fi; \
  # Locate the prusa-slicer binary inside extracted tree and copy to /usr/local/bin
  if [ -x /opt/prusaslicer/usr/bin/prusa-slicer ]; then \
    cp /opt/prusaslicer/usr/bin/prusa-slicer /usr/local/bin/prusa-slicer; \
  elif [ -x /opt/prusaslicer/prusa-slicer ]; then \
    cp /opt/prusaslicer/prusa-slicer /usr/local/bin/prusa-slicer; \
  elif [ -x /opt/prusaslicer/AppRun ]; then \
    # AppRun may exec the binary; copy AppRun as a wrapper
    cp /opt/prusaslicer/AppRun /usr/local/bin/prusa-slicer; \
  else \
    echo "Warning: prusa-slicer executable not found in extracted archive" >&2; \
  fi; \
  chmod +x /usr/local/bin/prusa-slicer || true; \
  rm -f /tmp/prusaslicer.asset || true; \
  echo "PRUSA: listing /opt/prusaslicer"; ls -la /opt/prusaslicer || true; \
  echo "PRUSA: listing /usr/local/bin/prusa-slicer"; ls -la /usr/local/bin/prusa-slicer || true

# Verify PrusaSlicer is available (fail build if not)
RUN which prusa-slicer
RUN prusa-slicer --version

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
