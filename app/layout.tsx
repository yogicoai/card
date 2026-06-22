import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "요기보 명함 발주 관리",
  description: "요기보코리아 마케팅디자인팀 명함 발주 관리툴",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
