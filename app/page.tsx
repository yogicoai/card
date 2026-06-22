"use client";

import { useEffect, useMemo, useState } from "react";

interface Entry {
  store: string;
  nameKo: string;
  nameEn: string;
  rank: string;
  telStore: string;
  telPersonal: string;
  address: string;
  qty: number;
}

const RANKS = ["Store Manager", "VMD", "Staff"];
const emptyForm: Entry = {
  store: "", nameKo: "", nameEn: "", rank: "Store Manager",
  telStore: "", telPersonal: "", address: "", qty: 100,
};

// 매장(유선) 번호 자동 하이픈: 02는 2자리 지역번호, 그 외는 3자리.
function formatStoreTel(value: string): string {
  const seoul = value.replace(/\D/g, "").startsWith("02");
  if (seoul) {
    const d = value.replace(/\D/g, "").slice(0, 10);
    if (d.length < 3) return d;
    if (d.length < 7) return d.replace(/(\d{2})(\d+)/, "$1-$2");          // 02-XXX…
    if (d.length < 10) return d.replace(/(\d{2})(\d{3})(\d+)/, "$1-$2-$3"); // 02-XXX-XXXX
    return d.replace(/(\d{2})(\d{4})(\d+)/, "$1-$2-$3");                  // 02-XXXX-XXXX
  }
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return d.replace(/(\d{3})(\d+)/, "$1-$2");           // 0XX-XXX…
  if (d.length < 11) return d.replace(/(\d{3})(\d{3})(\d+)/, "$1-$2-$3"); // 0XX-XXX-XXXX
  return d.replace(/(\d{3})(\d{4})(\d+)/, "$1-$2-$3");                   // 0XX-XXXX-XXXX
}

export default function Page() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [form, setForm] = useState<Entry>(emptyForm);
  const [month, setMonth] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  // 이번 달 기본값
  useEffect(() => {
    const now = new Date();
    setMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const set = <K extends keyof Entry>(key: K, val: Entry[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const addEntry = () => {
    const { store, nameKo, nameEn } = form;
    if (!store.trim() || !nameKo.trim() || !nameEn.trim()) {
      showToast("⚠ 매장명, 성명(한글), 성명(영문)은 필수입니다");
      return;
    }
    setEntries((e) => [...e, { ...form, telPersonal: form.telPersonal.trim() || "x" }]);
    showToast(`✓ ${nameKo} 추가 완료`);
    setForm(emptyForm);
  };

  const deleteEntry = (idx: number) => setEntries((e) => e.filter((_, i) => i !== idx));

  const clearAll = () => {
    if (entries.length === 0) return;
    if (confirm(`전체 ${entries.length}명 삭제하시겠습니까?`)) setEntries([]);
  };

  const totals = useMemo(() => ({
    people: entries.length,
    qty: entries.reduce((a, b) => a + b.qty, 0),
    stores: new Set(entries.map((e) => e.store)).size,
  }), [entries]);

  // ── CSV (일러스트 데이터 병합용) ──
  const exportCSV = () => {
    if (entries.length === 0) return showToast("⚠ 등록된 직원이 없습니다");
    const headers = ["성명한글", "성명영문", "직급", "매장번호", "개인번호", "매장주소", "수량"];
    const rows = entries.map((e) =>
      [e.nameKo, e.nameEn, e.rank, e.telStore, e.telPersonal === "x" ? "" : e.telPersonal, e.address || e.store, e.qty]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = "﻿" + [headers.map((h) => `"${h}"`).join(","), ...rows].join("\n");
    download(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `요기보_명함발주_${month.replace("-", "")}.csv`);
    showToast("✓ CSV 다운로드 완료");
  };

  // ── PDF 발주서 (1인 1파일 → 복수면 ZIP) ──
  const downloadPDF = async () => {
    if (entries.length === 0) return showToast("⚠ 등록된 직원이 없습니다");
    setBusy(true);
    showToast("⏳ PDF 생성 중…");
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ people: entries, month }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "생성 실패");
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
      const fallback = entries.length === 1
        ? `${month.replace("-", "_")}_매장_명함발주_${entries[0].nameKo}(1인).pdf`
        : `요기보_명함발주_${month.replace("-", "")}.zip`;
      download(blob, m ? decodeURIComponent(m[1]) : fallback);
      showToast(`✓ PDF ${entries.length}건 다운로드 완료`);
    } catch (err) {
      showToast(`⚠ ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const personalDisplay =
    form.telPersonal && form.telPersonal.toLowerCase() !== "x" ? form.telPersonal : "";
  const hasPreview = form.nameKo.trim() || form.nameEn.trim();

  return (
    <>
      <header>
        <div className="logo-mark">yg</div>
        <div>
          <h1>명함 발주 관리</h1>
          <span className="subtitle">요기보코리아 마케팅디자인팀</span>
        </div>
        <div className="header-right">
          <input type="month" className="month-input" value={month} onChange={(e) => setMonth(e.target.value)} />
          <div className="badge-count">{entries.length}명 등록</div>
        </div>
      </header>

      <main>
        {/* 좌측: 입력 폼 */}
        <div>
          <div className="panel">
            <div className="panel-header">
              <div className="step-num">1</div>
              <h2>직원 정보 입력</h2>
            </div>
            <div className="form-body" onKeyDown={(e) => { if (e.key === "Enter") addEntry(); }}>
              <div className="form-row">
                <label>매장명 <span className="required">*</span></label>
                <input value={form.store} onChange={(e) => set("store", e.target.value)} placeholder="스타필드 하남점" />
              </div>
              <div className="form-row-2col">
                <div className="form-row">
                  <label>성명 (한글) <span className="required">*</span></label>
                  <input value={form.nameKo} onChange={(e) => set("nameKo", e.target.value)} placeholder="홍길동" />
                </div>
                <div className="form-row">
                  <label>성명 (영문) <span className="required">*</span></label>
                  <input value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} placeholder="Hong Gil Dong" />
                </div>
              </div>
              <div className="form-row">
                <label>직급</label>
                <select value={form.rank} onChange={(e) => set("rank", e.target.value)}>
                  {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-row-2col">
                <div className="form-row">
                  <label>매장 번호</label>
                  <input value={form.telStore} onChange={(e) => set("telStore", formatStoreTel(e.target.value))} placeholder="051-000-0000" inputMode="numeric" />
                </div>
                <div className="form-row">
                  <label>개인 번호</label>
                  <input value={form.telPersonal} onChange={(e) => set("telPersonal", e.target.value)} placeholder="010-0000-0000 (없으면 x)" />
                </div>
              </div>
              <div className="form-row">
                <label>매장 주소</label>
                <input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="신세계 센텀시티몰점 B2F 요기보" />
                <div className="hint">백화점·쇼핑몰명 + 층 + 요기보</div>
              </div>
              <div className="form-row">
                <label>수량</label>
                <input type="number" min={1} value={form.qty} onChange={(e) => set("qty", parseInt(e.target.value) || 100)} />
              </div>
              <button className="btn-add" onClick={addEntry}><span>＋</span> 목록에 추가</button>
            </div>

            {/* 미리보기 */}
            <div className="preview-section">
              <div className="preview-label">명함 미리보기 (앞면)</div>
              {hasPreview ? (
                <div className="card-preview">
                  <div className="card-logo">yogibo</div>
                  <div className="card-name-row">
                    <div className="card-name-ko">{form.nameKo || "—"}</div>
                    <div className="card-name-en">{form.nameEn}</div>
                  </div>
                  <div className="card-title">/ {form.rank}</div>
                  <div className="card-store">{form.address || form.store}</div>
                  <div className="card-contacts">
                    {personalDisplay && <span><b>M</b>{personalDisplay}</span>}
                    {form.telStore && <span><b>T</b>{form.telStore}</span>}
                    <span><b>WEB</b>www.yogibo.kr</span>
                    <span><b>SNS</b>yogibokorea</span>
                  </div>
                </div>
              ) : (
                <div className="card-placeholder">정보를 입력하면 미리보기가 표시됩니다</div>
              )}
            </div>
          </div>
        </div>

        {/* 우측: 목록 + 액션 */}
        <div className="panel table-panel">
          <div className="panel-header">
            <div className="step-num">2</div>
            <h2>발주 목록</h2>
          </div>

          <div className="table-actions">
            <button className="btn-pdf" onClick={downloadPDF} disabled={busy}>
              📄 {busy ? "생성 중…" : "PDF 발주서 생성 (1인 1파일)"}
            </button>
            {/* <button className="btn-csv" onClick={exportCSV}>⬇ CSV (일러스트 병합용)</button> */}
            <button className="btn-clear-all" onClick={clearAll}>전체 삭제</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>매장명</th><th>성명(한글)</th><th>성명(영문)</th><th>직급</th>
                  <th>매장번호</th><th>개인번호</th><th>주소</th><th>수량</th><th></th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <div className="empty-state">
                        <div className="icon">📋</div>
                        <p>아직 등록된 직원이 없습니다</p>
                        <small>왼쪽 폼에서 직원 정보를 입력하고 추가해주세요</small>
                      </div>
                    </td>
                  </tr>
                ) : (
                  entries.map((e, i) => (
                    <tr key={i}>
                      <td style={{ color: "var(--text-light)", fontSize: 11 }}>{i + 1}</td>
                      <td className="store">{e.store}</td>
                      <td className="name-ko">{e.nameKo}</td>
                      <td className="name-en">{e.nameEn}</td>
                      <td><span className={`rank-badge ${e.rank === "VMD" ? "vm" : ""}`}>{e.rank}</span></td>
                      <td>{e.telStore || "—"}</td>
                      <td>{e.telPersonal}</td>
                      <td>{e.address || "—"}</td>
                      <td style={{ fontWeight: 600 }}>{e.qty}매</td>
                      <td><button className="btn-delete" onClick={() => deleteEntry(i)} title="삭제">✕</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {entries.length > 0 && (
            <div className="summary-bar">
              <div className="summary-item">
                <div className="s-label">총 인원</div>
                <div className="s-val">{totals.people} <span>명</span></div>
              </div>
              <div className="summary-item">
                <div className="s-label">총 수량</div>
                <div className="s-val">{totals.qty.toLocaleString()} <span>매</span></div>
              </div>
              <div className="summary-item">
                <div className="s-label">참여 매장</div>
                <div className="s-val">{totals.stores} <span>개점</span></div>
              </div>
            </div>
          )}
        </div>
      </main>

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </>
  );
}
