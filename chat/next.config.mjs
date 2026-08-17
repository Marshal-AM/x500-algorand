/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["x500-sdk-algorand", "algosdk"],
};

export default nextConfig;
