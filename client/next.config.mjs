/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Temporarily disable to reduce hydration issues
  webpack: (config, { isServer }) => {
    // Fix for Node.js modules in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
      
      // Exclude MetaMask SDK from client bundle to reduce size
      config.resolve.alias = {
        ...config.resolve.alias,
        '@metamask/sdk': false,
        '@metamask/sdk-communication-layer': false,
        '@metamask/sdk-install-modal-web': false,
      };
    }
    return config;
  },
  experimental: {
    esmExternals: 'loose' // Help with ESM module issues
  }
};

export default nextConfig;