FROM node:22-bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install runtime deps required by PrusaSlicer AppImage
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    xz-utils \
    libglu1-mesa \
    libx11-6 \
    libxcb1 \
    libfontconfig1 \
    libfreetype6 \
    libgomp1 \
    unzip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Install PrusaSlicer AppImage and extract it to /opt/prusaslicer
ENV PRUSASLICER_VERSION=2.6.0
RUN wget -q -O /tmp/prusaslicer.AppImage "https://github.com/prusa3d/PrusaSlicer/releases/download/version/PrusaSlicer-${PRUSASLICER_VERSION}+linux64-Glibc2.31.AppImage" || true
RUN if [ -f /tmp/prusaslicer.AppImage ]; then chmod +x /tmp/prusaslicer.AppImage && /tmp/prusaslicer.AppImage --appimage-extract && mv squashfs-root /opt/prusaslicer && ln -s /opt/prusaslicer/AppRun /usr/local/bin/prusa-slicer; else echo "PrusaSlicer AppImage not downloaded"; fi

# Copy source
COPY package*.json ./
RUN npm ci --production=false

COPY . .

# Build Next app
RUN npm run build

ENV PORT=3000
EXPOSE ${PORT}

# Run Next in production
CMD ["npm", "start"]
