/** @type {import('next').NextConfig} */
const nextConfig = {
  // 서버 전용 패키지들은 webpack 번들링에서 제외 (Vercel 필수 설정)
  serverExternalPackages: [
    "puppeteer",
    "puppeteer-core",
    "@sparticuz/chromium-min",
  ],
};

export default nextConfig;
