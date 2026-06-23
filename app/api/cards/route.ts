import { NextRequest } from "next/server";
import { buildCardHtml, DEFAULT_FONTS, type CardPerson, type CardFonts } from "@/lib/cardTemplate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Payload {
  people: CardPerson[];
  month?: string;
  fonts?: Partial<CardFonts>; // 요소별 폰트 지정(선택). 미지정 시 DEFAULT_FONTS
}

function pdfFileName(p: CardPerson, month?: string): string {
  const m = (month || "").replace("-", "_") || "0000_00";
  const safe = (p.nameKo || "무명").replace(/[\\/:*?"<>|]/g, "");
  return `${m}_매장_명함발주_${safe}(1인).pdf`;
}

async function getFileAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`파일 로드 실패 (${res.status}): ${url}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

async function tryGetFileAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return Buffer.from(buf).toString("base64");
  } catch {
    return null;
  }
}

// public/fonts 에 있으면 @font-face 로 임베드할 폰트들 (첫 번째로 존재하는 파일 사용).
// ITC Souvenir 는 상용 폰트 — 웹폰트 파일을 public/fonts 에 넣으면 슬로건에 자동 적용된다.
const FONT_SOURCES: Array<{ family: string; weight: string; files: string[] }> = [
  { family: "Pretendard", weight: "100 900", files: ["fonts/PretendardVariable.woff2"] },

  // ITC Souvenir (상용, public/fonts 의 .otf). 슬로건은 Bold(700). Demi/Medium 도 등록해 두면 fonts 로 지정 가능.
  { family: "ITC Souvenir", weight: "700", files: [
      "fonts/ITC Souvenir Std Bold.otf",
      "fonts/ITCSouvenir-Bold.woff2", "fonts/ITCSouvenir-Bold.otf",
  ] },
  { family: "ITC Souvenir", weight: "600", files: [
      "fonts/ITC Souvenir Std Demi.otf",
  ] },
  { family: "ITC Souvenir", weight: "500", files: [
      "fonts/ITC Souvenir Std Medium/ITC Souvenir Std Medium.otf",
      "fonts/ITC Souvenir Std Medium.otf",
  ] },
];

function fontFormat(file: string): { format: string; mime: string } {
  if (file.endsWith(".woff2")) return { format: "woff2", mime: "font/woff2" };
  if (file.endsWith(".woff")) return { format: "woff", mime: "font/woff" };
  if (file.endsWith(".otf")) return { format: "opentype", mime: "font/otf" };
  if (file.endsWith(".ttf")) return { format: "truetype", mime: "font/ttf" };
  return { format: "woff2", mime: "font/woff2" };
}

// 사용 가능한 폰트 파일만 골라 @font-face CSS 로 묶는다 (없는 폰트는 폴백 처리됨).
async function buildFontCss(origin: string): Promise<string> {
  const blocks = await Promise.all(
    FONT_SOURCES.map(async (src) => {
      for (const file of src.files) {
        const b64 = await tryGetFileAsBase64(`${origin}/${encodeURI(file)}`);
        if (b64) {
          const { format, mime } = fontFormat(file);
          return `@font-face{font-family:'${src.family}';font-style:normal;font-weight:${src.weight};font-display:block;src:url(data:${mime};base64,${b64}) format('${format}');}`;
        }
      }
      return "";
    })
  );
  return blocks.filter(Boolean).join("\n");
}

async function getBrowser() {
  const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV);

  if (isVercel) {
    // chromium-min: 배포 패키지에 바이너리를 포함하지 않고 런타임에 URL로 다운로드
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const puppeteerCore = (await import("puppeteer-core")).default;

    // puppeteer-core@24.9.0 에 맞는 Chromium 131 릴리즈
    const CHROMIUM_URL =
      "https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar";

    const execPath = await chromium.executablePath(CHROMIUM_URL);
    console.log("Chromium executablePath:", execPath);

    return puppeteerCore.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
      executablePath: execPath,
      headless: true,
      defaultViewport: { width: 1280, height: 720 },
    });
  }

  // 로컬 개발 환경
  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

export async function POST(req: NextRequest) {
  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "잘못된 요청 본문" }), { status: 400 });
  }

  const people = Array.isArray(payload.people) ? payload.people : [];
  if (people.length === 0) {
    return new Response(JSON.stringify({ error: "등록된 직원이 없습니다" }), { status: 400 });
  }

  const origin = req.nextUrl.origin;
  let browser: Awaited<ReturnType<typeof getBrowser>> | null = null;

  try {
    const [logoB64, fontCss] = await Promise.all([
      getFileAsBase64(`${origin}/yogibo-logo.png`),
      buildFontCss(origin),
    ]);

    const logoDataUri = `data:image/png;base64,${logoB64}`;
    // 요소별 폰트: 기본값 위에 요청에서 받은 fonts 를 덮어쓴다.
    const fonts: CardFonts = { ...DEFAULT_FONTS, ...(payload.fonts || {}) };

    browser = await getBrowser();
    const page = await browser.newPage();

    await page.setContent(buildCardHtml(people, logoDataUri, fontCss, fonts), { waitUntil: "domcontentloaded" });
    await new Promise(r => setTimeout(r, 500));

    const buf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });
    await page.close();

    const name = people.length === 1
      ? pdfFileName(people[0], payload.month)
      : `${(payload.month || "").replace("-", "_") || "0000_00"}_매장_명함발주_통합(${people.length}인).pdf`;

    return new Response(buf as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("PDF 생성 실패:", message);
    return new Response(
      JSON.stringify({ error: `PDF 생성 실패: ${message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* 무시 */ }
    }
  }
}
