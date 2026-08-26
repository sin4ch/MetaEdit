import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow all local network IPs and dev origins for mobile testing
  experimental: {},
  allowedDevOrigins: [
    "192.168.100.8",
    "192.168.100.8:3000",
    "localhost:3000",
    "*.loca.lt",
    "*.ngrok-free.app",
    "*.trycloudflare.com"
  ],
};

export default nextConfig;
