/** @type {import('next').NextConfig} */
const nextConfig = {
  // puppeteer는 서버 전용 패키지라 번들에 포함하지 않고 외부 모듈로 둔다.
  serverExternalPackages: ["puppeteer"],
};

export default nextConfig;
