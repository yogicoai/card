// 요기보 명함 2페이지 PDF 템플릿
// - 1페이지(앞면): 사람마다 다른 이름/직급/매장/연락처 (가변)
// - 2페이지(뒷면): 모든 사람 공통 "Discover the Feel" (고정)
// 좌표·색상은 샘플 PDF(2026_06_매장_명함발주_문경애(1인).pdf) 내부에서 추출한 값.
// 폰트 CSS(@font-face)와 요소별 폰트 지정(fonts)은 API 라우트에서 넘겨받는다 (Vercel 환경 지원).

export interface CardPerson {
  store: string;        // 매장명 (파일명/주소 보조)
  nameKo: string;       // 성명(한글)  예: 문경애
  nameEn: string;       // 성명(영문)  예: Moon Kyung Ae
  rank: string;         // 직급        예: Store Manager
  telStore: string;     // 매장 번호(T)
  telPersonal: string;  // 개인 번호(M) — 'x'/빈값이면 숨김
  address: string;      // 매장 주소 한 줄  예: 신세계 센텀시티몰점 B2F 요기보
}

// ── 요소별 폰트 지정 ────────────────────────────────────────────────
// family: CSS font-family 이름 (해당 폰트 파일이 public/fonts 에 있고 라우트에서 임베드되어야 실제 적용)
// weight: 100~900 (또는 'bold' 등)
export interface FontSpec {
  family: string;
  weight: number | string;
}

export interface CardFonts {
  nameKo: FontSpec; // 한글명
  nameEn: FontSpec; // 영문명
  title: FontSpec;  // 직급(/ Store Manager)
  store: FontSpec;  // 매장 주소
  label: FontSpec;  // M / T / WEB / SNS 라벨
  value: FontSpec;  // 번호 / URL 값
  slogan: FontSpec; // 뒷면 "Discover the Feel"
}

// 스크린샷 기준 기본 매핑. 요청 payload 의 fonts 로 덮어쓸 수 있다.
export const DEFAULT_FONTS: CardFonts = {
  nameKo: { family: "Pretendard", weight: 700 },
  nameEn: { family: "Pretendard", weight: 500 },
  title:  { family: "Pretendard", weight: 400 },
  store:  { family: "Pretendard", weight: 500 },
  label:  { family: "Pretendard", weight: 600 },
  value:  { family: "Pretendard", weight: 300 },
  slogan: { family: "ITC Souvenir", weight: 700 },
};

// 인쇄용 재단선/블리드 가이드 표시 여부 (최종 입고 시 false 권장)
const SHOW_GUIDES = false;

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const hasPersonal = (p: CardPerson) => {
  const v = (p.telPersonal || "").trim().toLowerCase();
  return v && v !== "x";
};

// 전화번호 하이픈 유지
const tel = (s: string) => esc((s || "").trim());

// font-family 폴백 스택: 세리프 계열(ITC Souvenir 등)은 serif, 그 외는 Pretendard/sans-serif 로 폴백.
function fontStack(spec: FontSpec): string {
  const serifLike = /souvenir|serif|times|georgia|garamond|minion/i.test(spec.family);
  const fallback = serifLike ? "'Souvenir', Georgia, serif" : "'Pretendard', sans-serif";
  return `'${spec.family}', ${fallback}`;
}

// fonts 객체 → :root CSS 변수 (--ff-*: family, --fw-*: weight)
function fontVars(fonts: CardFonts): string {
  const entries: Array<[string, FontSpec]> = [
    ["nameko", fonts.nameKo],
    ["nameen", fonts.nameEn],
    ["title", fonts.title],
    ["store", fonts.store],
    ["label", fonts.label],
    ["value", fonts.value],
    ["slogan", fonts.slogan],
  ];
  return entries
    .map(([k, s]) => `    --ff-${k}: ${fontStack(s)}; --fw-${k}: ${s.weight};`)
    .join("\n");
}

/**
 * @param people       명함에 들어갈 직원 목록 (각 1인 = 앞면+뒷면 2페이지)
 * @param logoDataUri  yogibo 로고 PNG(data URI)
 * @param fontCss      @font-face 선언들 (라우트에서 public/fonts 파일을 base64 임베드)
 * @param fonts        요소별 폰트 지정 (미지정 시 DEFAULT_FONTS)
 */
export function buildCardHtml(
  people: CardPerson[],
  logoDataUri: string,
  fontCss: string,
  fonts: CardFonts = DEFAULT_FONTS,
): string {
  const guides = SHOW_GUIDES
    ? `<div class="bleed-guide"></div><div class="trim-guide"></div>`
    : "";

  const pagesHtml = people.map(p => `
  <!-- 1페이지 · 앞면 (사람마다 다름) -->
  <section class="page front">
    ${guides}
    <img class="logo" src="${logoDataUri}" alt="yogibo">
    <div class="info">
      <div class="name-row">
        <span class="name-ko">${esc(p.nameKo)}</span>
        <span class="name-en">${esc(p.nameEn)}</span>
        <span class="title">/ ${esc(p.rank)}</span>
      </div>
      <div class="store">${esc(p.address || p.store)}</div>
      <div class="contacts">
        ${
          hasPersonal(p)
            ? `<div class="contact-line"><span class="lbl">M</span><span class="val">${tel(p.telPersonal)}</span></div>`
            : ""
        }
        <div class="contact-line row-web">
          <span class="seg"><span class="lbl">T</span><span class="val">${tel(p.telStore)}</span></span>
          <span class="seg"><span class="lbl">WEB</span><span class="val lg">www.yogibo.kr</span></span>
          <span class="seg"><span class="lbl">SNS</span><span class="val lg">yogibokorea</span></span>
        </div>
      </div>
    </div>
  </section>

  <!-- 2페이지 · 뒷면 (모든 사람 공통) -->
  <section class="page back">
    ${guides}
    <div class="slogan">Discover the Feel</div>
  </section>
  `).join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  ${fontCss}
  :root {
    --teal: #00BDD3;   /* M/T/WEB/SNS 라벨, 슬로건, 로고 물결 */
    --ink:  #404042;   /* 본문 텍스트 */
    --trim: #2E3092;    /* 재단선 가이드(파랑) */
    --bleed:#ED1C23;    /* 블리드 가이드(빨강) */
    /* ── 요소별 폰트 (라우트에서 받은 fonts 로 생성) ── */
${fontVars(fonts)}
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }

  /* 92×52mm = 90×50mm 재단 + 사방 1mm 블리드 */
  @page { size: 92mm 52mm; margin: 0; }

  html, body { font-family: 'Pretendard', sans-serif; color: var(--ink); }

  .page {
    position: relative;
    width: 92mm;
    height: 52mm;
    background: #fff;
    overflow: hidden;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }

  /* ── 인쇄 가이드 ── */
  .bleed-guide {
    position: absolute; inset: 0;
    border: 0.3pt solid var(--bleed);
    pointer-events: none;
  }
  .trim-guide {
    position: absolute; inset: 1mm;        /* 1mm 안쪽 = 재단선 */
    border: 0.3pt solid var(--trim);
    pointer-events: none;
  }

  /* ── 뒷면(고정) 슬로건 ── */
  .back { display: flex; align-items: center; justify-content: center; }
  .slogan {
    font-family: var(--ff-slogan);
    font-weight: var(--fw-slogan);
    font-size: 17pt;
    color: var(--teal);
    letter-spacing: 0.2pt;
  }

  /* ── 앞면(가변) ── */
  .logo {
    position: absolute;
    top: 4.7mm;
    right: 6.3mm;     /* 로고 오른쪽 끝 = 하단 SNS 오른쪽 끝 (동일 우측 여백) */
    width: 23.3mm;
    height: auto;
  }
  .info {
    position: absolute;
    left: 6.3mm;
    bottom: 6.4mm;
  }
  .name-row { display: flex; align-items: baseline; }
  .name-ko {
    font-family: var(--ff-nameko); font-weight: var(--fw-nameko);
    font-size: 12pt; color: var(--ink);
  }
  .name-en {
    font-family: var(--ff-nameen); font-weight: var(--fw-nameen);
    font-size: 8.5pt; color: var(--ink); margin-left: 4pt;
  }
  .title {
    font-family: var(--ff-title); font-weight: var(--fw-title);
    font-size: 6pt; color: var(--ink); margin-left: 3pt;
  }
  .store {
    font-family: var(--ff-store); font-weight: var(--fw-store);
    font-size: 5.8pt; color: var(--ink); margin-top: 2mm;
  }
  .contacts { margin-top: 2.5mm; }
  .contact-line { display: flex; align-items: baseline; }
  .contact-line + .contact-line { margin-top: 1.1mm; }
  .lbl {
    font-family: var(--ff-label); font-weight: var(--fw-label);
    font-size: 7pt; color: var(--teal); width: 8pt; flex-shrink: 0;
  }
  .val {
    font-family: var(--ff-value); font-weight: var(--fw-value);
    font-size: 7pt; color: var(--ink);
  }
  .val.lg { font-size: 8pt; }
  /* 하단 줄: T(좌) · WEB(중앙) · SNS(우) 분산. 너비 = 좌여백(6.3)~우여백(6.3) → SNS 끝이 로고 끝과 정렬 */
  .row-web { width: 79.4mm; justify-content: space-between; }
  .row-web .seg { display: flex; align-items: baseline; }
  .row-web .lbl { width: auto; margin-right: 3pt; }
</style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}
