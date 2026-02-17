FROM node:22-bullseye

ENV DEBIAN_FRONTEND=noninteractive

# Install runtime deps required by PrusaSlicer AppImage and tooling
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    curl \
    xz-utils \
    tar \
    libglu1-mesa \
    libx11-6 \
    libxcb1 \
    libfontconfig1 \
    libfreetype6 \
    libgomp1 \
    unzip \
    libgtk-3-0 \
    libxrender1 \
    libxcb-render0 \
    libxcb-shm0 \
    libgl1-mesa-glx \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Download latest PrusaSlicer AppImage from GitHub Releases (uses API to avoid brittle hardcoded URLs)
# This finds the first linux64 AppImage asset on the latest release and downloads it.
RUN set -eux; \
  ASSET_URL=$(curl -s https://api.github.com/repos/prusa3d/PrusaSlicer/releases/latest \
    | grep "browser_download_url" | grep linux64 | grep AppImage | head -n1 | cut -d '"' -f4); \
  if [ -z "$ASSET_URL" ]; then echo "Could not determine PrusaSlicer asset URL" >&2; exit 1; fi; \
  wget -q -O /tmp/prusaslicer.AppImage "$ASSET_URL"; \
  chmod +x /tmp/prusaslicer.AppImage; \
  /tmp/prusaslicer.AppImage --appimage-extract; \
  mv squashfs-root /opt/prusaslicer; \
  # Try multiple likely locations for the runnable produced by AppImage extraction
  if [ -x /opt/prusaslicer/AppRun ]; then \
    ln -sf /opt/prusaslicer/AppRun /usr/local/bin/prusa-slicer; \
  elif [ -x /opt/prusaslicer/usr/bin/prusa-slicer ]; then \
    ln -sf /opt/prusaslicer/usr/bin/prusa-slicer /usr/local/bin/prusa-slicer; \
  elif [ -x /opt/prusaslicer/prusa-slicer ]; then \
    ln -sf /opt/prusaslicer/prusa-slicer /usr/local/bin/prusa-slicer; \
  else \
    echo "Warning: prusa-slicer executable not found in extracted AppImage" >&2; \
  fi; \
  chmod +x /usr/local/bin/prusa-slicer || true; \
  rm -f /tmp/prusaslicer.AppImage; \
  # Export PRUSASLICER_BIN for runtime code to locate the binary
  echo "Setting PRUSASLICER_BIN=/usr/local/bin/prusa-slicer"; \
  export PRUSASLICER_BIN=/usr/local/bin/prusa-slicer; \
  ls -la /opt/prusaslicer || true; \
  ls -la /usr/local/bin/prusa-slicer || true

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
