import { NextRequest } from "next/server";
import { buildCardHtml, type CardPerson } from "@/lib/cardTemplate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Payload {
  people: CardPerson[];
  month?: string;
}

function pdfFileName(p: CardPerson, month?: string): string {
  const m = (month || "").replace("-", "_") || "0000_00";
  const safe = (p.nameKo || "무명").replace(/[\\/:*?"<>|]/g, "");
  return `${m}_매장_명함발주_${safe}(1인).pdf`;
}

async function getFileAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`파일 로드 실패: ${url}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

async function getBrowser() {
  const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV);

  if (isVercel) {
    // Vercel 서버리스 환경: sparticuz/chromium 사용
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteerCore = (await import("puppeteer-core")).default;

    const executablePath = await chromium.executablePath();
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath,
      headless: true,
      defaultViewport: { width: 1280, height: 720 },
    });
  } else {
    // 로컬 개발 환경: 일반 puppeteer 사용
    const puppeteer = (await import("puppeteer")).default;
    return puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
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
    const [logoB64, fontB64] = await Promise.all([
      getFileAsBase64(`${origin}/yogibo-logo.png`),
      getFileAsBase64(`${origin}/fonts/PretendardVariable.woff2`),
    ]);

    const logoDataUri = `data:image/png;base64,${logoB64}`;
    const fontCss = `@font-face{font-family:'Pretendard';font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${fontB64}) format('woff2');}`;

    browser = await getBrowser();
    const page = await browser.newPage();

    await page.setContent(buildCardHtml(people, logoDataUri, fontCss), { waitUntil: "domcontentloaded" });
    // 한글 폰트 로딩 대기 (500ms)
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
    console.error("PDF 생성 실패:", err);
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return new Response(JSON.stringify({ error: `PDF 생성 실패: ${message}` }), { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
