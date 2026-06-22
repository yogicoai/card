import { NextRequest } from "next/server";
import puppeteerCore from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer";
import { buildCardHtml, type CardPerson } from "@/lib/cardTemplate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Payload {
  people: CardPerson[];
  month?: string; // "2026-06"
}

// 파일명: 2026_06_매장_명함발주_문경애(1인).pdf
function pdfFileName(p: CardPerson, month?: string): string {
  const m = (month || "").replace("-", "_") || "0000_00";
  const safe = (p.nameKo || "무명").replace(/[\\/:*?"<>|]/g, "");
  return `${m}_매장_명함발주_${safe}(1인).pdf`;
}

async function getFileAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

async function renderPdf(browser: Browser, html: string): Promise<Uint8Array> {
  const page = await browser.newPage();
  try {
    // 폰트·로고는 data URI로 임베드되어 외부 요청이 없으므로 "load" 로 충분.
    await page.setContent(html, { waitUntil: "load" });
    // 임베드된 Pretendard 폰트 적용 완료까지 대기 (한글 깨짐 방지)
    await page.evaluateHandle("document.fonts.ready");
    return await page.pdf({
      printBackground: true,
      preferCSSPageSize: true, // @page { size: 92mm 52mm } 사용
    });
  } finally {
    await page.close();
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
  const logoB64 = await getFileAsBase64(`${origin}/yogibo-logo.png`);
  const logoDataUri = `data:image/png;base64,${logoB64}`;

  const fontB64 = await getFileAsBase64(`${origin}/fonts/PretendardVariable.woff2`);
  const fontCss = `@font-face{font-family:'Pretendard';font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${fontB64}) format('woff2');}`;

  const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV;
  
  let browser: Browser;
  if (isVercel) {
    browser = await puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    }) as unknown as Browser;
  } else {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }

  try {
    const buf = await renderPdf(browser, buildCardHtml(people, logoDataUri, fontCss));
    let name = "";
    if (people.length === 1) {
      name = pdfFileName(people[0], payload.month);
    } else {
      const m = (payload.month || "").replace("-", "_") || "0000_00";
      name = `${m}_매장_명함발주_통합(${people.length}인).pdf`;
    }

    return new Response(buf as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  } catch (err) {
    console.error("PDF 생성 실패:", err);
    return new Response(JSON.stringify({ error: "PDF 생성 중 오류" }), { status: 500 });
  } finally {
    await browser.close();
  }
}
