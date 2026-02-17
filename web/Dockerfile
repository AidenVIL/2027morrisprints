FROM node:22-bullseye

  # Removed ARG PRUSA_VERSION since PrusaSlicer is no longer required
ENV DEBIAN_FRONTEND=noninteractive

# PrusaSlicer removed — estimator is pure-Node
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
    # FROM node:22-bullseye

    ENV DEBIAN_FRONTEND=noninteractive

    # Minimal system packages (no PrusaSlicer)
    RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        wget \
      && rm -rf /var/lib/apt/lists/*

    WORKDIR /usr/src/app

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
  done; \
