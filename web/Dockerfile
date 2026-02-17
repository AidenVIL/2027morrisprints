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
  for TAG in "$PRUSA_VERSION" "v$PRUSA_VERSION"; do \
    for ASSET in \
      "PrusaSlicer-${TAG}-Linux-x86_64-gtk3.tar.xz" \
      "PrusaSlicer-${TAG}-Linux-x86_64.tar.xz" \
      "PrusaSlicer-${TAG}-linux-x86_64.tar.xz" \
      "PrusaSlicer-${TAG}-linux-x86_64-GTK3.tar.xz" \
      "PrusaSlicer-${TAG}.AppImage" \
      "PrusaSlicer-${TAG}-linux-x86_64.AppImage"; do \
      URL="https://github.com/prusa3d/PrusaSlicer/releases/download/${TAG}/${ASSET}"; \
      echo "Trying $URL"; \
      if wget -q -O /tmp/prusaslicer.asset "$URL"; then \
        echo "Downloaded $ASSET"; \
        GOT=1; break 2; \
      fi; \
    done; \
  done; \
  if [ -z "${GOT}" ]; then echo "Failed to download PrusaSlicer for ${PRUSA_VERSION}" >&2; exit 1; fi; \
  # Inspect and extract accordingly
  file /tmp/prusaslicer.asset || true; \
  if file /tmp/prusaslicer.asset | grep -qi "XZ" || file /tmp/prusaslicer.asset | grep -qi "XZ compressed"; then \
    tar -xJf /tmp/prusaslicer.asset -C /opt/prusaslicer || true; \
  elif file /tmp/prusaslicer.asset | grep -qi "gzip" || file /tmp/prusaslicer.asset | grep -qi "gzip compressed"; then \
    tar -xzf /tmp/prusaslicer.asset -C /opt/prusaslicer || true; \
  elif file /tmp/prusaslicer.asset | grep -qi "AppImage" || echo "/tmp/prusaslicer.asset" | grep -q "AppImage"; then \
    chmod +x /tmp/prusaslicer.asset; /tmp/prusaslicer.asset --appimage-extract; mv squashfs-root/* /opt/prusaslicer || true; \
  else \
    # fallback: attempt to extract as tar
    tar -xvf /tmp/prusaslicer.asset -C /opt/prusaslicer || true; \
  fi; \
  # Locate the prusa-slicer executable and copy to /usr/local/bin
  if [ -x /opt/prusaslicer/usr/bin/prusa-slicer ]; then \
    cp /opt/prusaslicer/usr/bin/prusa-slicer /usr/local/bin/prusa-slicer; \
  elif [ -x /opt/prusaslicer/prusa-slicer ]; then \
    cp /opt/prusaslicer/prusa-slicer /usr/local/bin/prusa-slicer; \
  elif [ -x /opt/prusaslicer/AppRun ]; then \
    cp /opt/prusaslicer/AppRun /usr/local/bin/prusa-slicer; \
  elif [ -x /opt/prusaslicer/bin/prusa-slicer ]; then \
    cp /opt/prusaslicer/bin/prusa-slicer /usr/local/bin/prusa-slicer; \
  else \
    echo "Warning: prusa-slicer executable not found in extracted archive" >&2; \
  fi; \
  chmod +x /usr/local/bin/prusa-slicer || true; \
  rm -f /tmp/prusaslicer.asset || true; \
  echo "PRUSA: listing /opt/prusaslicer"; ls -la /opt/prusaslicer || true; \
  echo "PRUSA: listing /usr/local/bin/prusa-slicer"; ls -la /usr/local/bin/prusa-slicer || true

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
