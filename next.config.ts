import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Root cause of the social-card 500 in production, confirmed via Vercel's runtime logs:
  // "Could not load the sharp module using the linux-x64 runtime -- ERR_DLOPEN_FAILED:
  // libvips-cpp.so.8.18.6: cannot open shared object file." sharp is correctly declared as a
  // dependency (fixed earlier) and the build succeeds, but Next's serverless file tracer
  // wasn't including sharp's native linux binary + its libvips shared library in the deployed
  // function bundle for this one route (the only route that imports sharp) -- so it built fine
  // and crashed at import time in the actual Lambda. Scoped to just that route, not '/*' for
  // every function, per the docs' own caution against oversized traces.
  outputFileTracingIncludes: {
    '/api/social/card/\\[id\\]': [
      './node_modules/sharp/**/*',
      './node_modules/@img/sharp-linux-x64/**/*',
      './node_modules/@img/sharp-libvips-linux-x64/**/*',
    ],
  },
};

export default nextConfig;
