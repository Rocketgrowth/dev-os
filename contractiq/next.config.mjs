/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
    // pdf-parse (via pdfjs-dist) loads its worker file dynamically at runtime,
    // which Next.js's build-time file tracer can't follow statically. Without
    // this, serverless platforms (e.g. Netlify) omit the worker file from the
    // deployed function bundle, crashing every PDF upload in production while
    // working fine locally where the full node_modules tree is present.
    outputFileTracingIncludes: {
      '/api/contracts/upload': [
        './node_modules/pdf-parse/dist/**/*.mjs',
        './node_modules/pdf-parse/node_modules/pdfjs-dist/**/*.mjs',
      ],
    },
  },
};

export default nextConfig;
