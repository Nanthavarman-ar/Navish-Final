# Backend Dockerfile
#
# Switched from node:20-alpine to node:20-bookworm-slim (Debian, glibc) specifically to run
# KTX-Software's `ktx` CLI (server/utils/ktx2Optimize.mjs - the server-side KTX2 texture
# re-encode step). That binary isn't available on stable Alpine at all (only on the
# edge/testing branches, and even there below the 4.4.0 gltf-transform/cli's toktx()
# requires), and Debian's own apt repos don't carry it either - the only real path is
# Khronos's own prebuilt release, which is glibc-linked and won't run against Alpine's musl
# libc. See ktx2Optimize.mjs's own top comment for the fuller history of why this needed a
# native binary at all (both prior client-side, browser-only attempts failed).
FROM node:20-bookworm-slim

# Set working directory
WORKDIR /app

# KTX-Software isn't packaged for Debian either (apt's own "ktx" package is an unrelated
# Quake mod, confirmed by checking packages.debian.org) - installed directly from
# KhronosGroup's GitHub release instead. `apt-get install ./<file>.deb` (not `dpkg -i`) so
# apt also resolves the .deb's own runtime dependencies automatically. curl is only needed
# to fetch it and is removed again afterward to keep the final image slim; `ktx --version`
# at the end fails the build immediately if the install didn't actually work, rather than
# deferring that discovery to the first real optimize job in production.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && curl -sL -o /tmp/ktx.deb "https://github.com/KhronosGroup/KTX-Software/releases/download/v4.4.2/KTX-Software-4.4.2-Linux-x86_64.deb" \
  && apt-get install -y --no-install-recommends /tmp/ktx.deb \
  && rm -f /tmp/ktx.deb \
  && apt-get purge -y curl \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/* \
  && ktx --version

# Copy package files
COPY server/package*.json ./

# Install dependencies (includes sharp, which needs a native binary for this image's
# platform - built/downloaded here, at image-build time, not cross-compiled from the host).
RUN npm ci --only=production

# Copy server source code
COPY server/ ./

# Create non-root user (groupadd/useradd - Debian's tools, not Alpine's busybox
# addgroup/adduser this Dockerfile used before switching base images).
RUN groupadd -g 1001 nodejs \
  && useradd -r -u 1001 -g nodejs nodejs

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# Start the application
CMD ["node", "server.js"]
