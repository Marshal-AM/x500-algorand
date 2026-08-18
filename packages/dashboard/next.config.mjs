/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@txnlab/use-wallet-react",
    "x500-protocol-algorand-v1-client",
  ],
};

export default nextConfig;
