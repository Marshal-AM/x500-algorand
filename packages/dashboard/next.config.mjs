/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@txnlab/use-wallet-react",
    "x500-protocol-algorand-v1-client",
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "lute-connect": false,
      "@agoralabs-sh/avm-web-provider": false,
      "@magic-ext/algorand": false,
      "@magic-sdk/client": false,
      "@web3auth/modal": false,
      "@web3auth/single-factor-auth": false,
      "@web3auth/base": false,
      "@web3auth/base-provider": false,
      "node:fs": false,
      "node:path": false,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      stream: false,
      buffer: false,
    };
    return config;
  },
};

export default nextConfig;
