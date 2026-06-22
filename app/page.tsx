"use client";

import { useEffect, useState } from "react";

interface Employee {
  store: string;
  nameKo: string;
  nameEn: string;
  rank: string;
  telStore: string;
  telPersonal: string;
  address: string;
}

interface OrderRecord {
  _id: string;
  month: string;
  peopleCount: number;
  people: Employee[];
  createdAt: string;
  createdAtKST: string;
  updatedAtKST?: string;
}

const RANKS = ["Store Manager", "VMD", "Staff"];

const emptyEmployee = (): Employee => ({
  store: "", nameKo: "", nameEn: "", rank: "Store Manager",
  telStore: "", telPersonal: "", address: "",
});

function formatTel(value: string): string {
  const seoul = value.replace(/\D/g, "").startsWith("02");
  if (seoul) {
    const d = value.replace(/\D/g, "").slice(0, 10);
    if (d.length < 3) return d;
    if (d.length < 7) return d.replace(/(\d{2})(\d+)/, "$1-$2");
    if (d.length < 10) return d.replace(/(\d{2})(\d{3})(\d+)/, "$1-$2-$3");
    return d.replace(/(\d{2})(\d{4})(\d+)/, "$1-$2-$3");
  }
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return d.replace(/(\d{3})(\d+)/, "$1-$2");
  if (d.length < 11) return d.replace(/(\d{3})(\d{3})(\d+)/, "$1-$2-$3");
  return d.replace(/(\d{3})(\d{4})(\d+)/, "$1-$2-$3");
}

export default function Page() {
  const [employees, setEmployees] = useState<Employee[]>([emptyEmployee()]);
  const [month, setMonth] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  // 수정 모드 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMonth, setEditMonth] = useState("");

  useEffect(() => {
    const now = new Date();
    setMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    fetchOrders();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) setOrders(await res.json());
    } catch { /* 무시 */ }
  };

  const setField = (idx: number, key: keyof Employee, val: string) => {
    setEmployees(prev => prev.map((e, i) => i === idx ? { ...e, [key]: val } : e));
  };

  const addEmployee = () => setEmployees(prev => [...prev, emptyEmployee()]);

  const removeEmployee = (idx: number) => {
    if (employees.length === 1) return;
    setEmployees(prev => prev.filter((_, i) => i !== idx));
  };

  // 수정 모드 진입
  const startEdit = (order: OrderRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(order._id);
    setEditMonth(order.month);
    setEmployees(order.people.map(p => ({ ...p })));
    // 폼 상단으로 스크롤
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 수정 취소
  const cancelEdit = () => {
    setEditingId(null);
    setEditMonth("");
    setEmployees([emptyEmployee()]);
  };

  // 수정 저장
  const saveEdit = async () => {
    const valid = employees.filter(e => e.store.trim() && e.nameKo.trim() && e.nameEn.trim());
    if (valid.length === 0) {
      showToast("⚠ 매장명, 성명(한글), 성명(영문)은 필수입니다");
      return;
    }
    const people = valid.map(e => ({ ...e, telPersonal: e.telPersonal.trim() || "x" }));
    setSaving(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, people, month: editMonth }),
      });
      if (!res.ok) throw new Error("수정 실패");
      showToast("✓ 수정 완료");
      cancelEdit();
      fetchOrders();
    } catch (err) {
      showToast(`⚠ ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  // 목록 생성하기 (신규 저장)
  const saveOrder = async () => {
    const valid = employees.filter(e => e.store.trim() && e.nameKo.trim() && e.nameEn.trim());
    if (valid.length === 0) {
      showToast("⚠ 매장명, 성명(한글), 성명(영문)은 필수입니다");
      return;
    }
    const people = valid.map(e => ({ ...e, telPersonal: e.telPersonal.trim() || "x" }));
    setSaving(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ people, month }),
      });
      if (!res.ok) throw new Error("저장 실패");
      showToast(`✓ 발주 목록 저장 완료 (${people.length}명)`);
      setEmployees([emptyEmployee()]);
      fetchOrders();
    } catch (err) {
      showToast(`⚠ ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  // PDF 다운로드
  const downloadPDF = async (order: OrderRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(order._id);
    showToast("⏳ PDF 생성 중…");
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ people: order.people, month: order.month }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "생성 실패");
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
      const fallback = order.peopleCount === 1
        ? `${order.month.replace("-", "_")}_매장_명함발주_${order.people[0].nameKo}(1인).pdf`
        : `${order.month.replace("-", "_")}_매장_명함발주_통합(${order.peopleCount}인).pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = m ? decodeURIComponent(m[1]) : fallback;
      a.click();
      URL.revokeObjectURL(url);
      showToast("✓ PDF 다운로드 완료");
    } catch (err) {
      showToast(`⚠ ${(err as Error).message}`);
    } finally {
      setDownloading(null);
    }
  };

  const deleteOrder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("이 발주 내역을 삭제하시겠습니까?")) return;
    try {
      await fetch("/api/orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setOrders(prev => prev.filter(o => o._id !== id));
      if (editingId === id) cancelEdit();
      showToast("✓ 발주 내역이 삭제되었습니다");
    } catch {
      showToast("⚠ 삭제 실패");
    }
  };

  const isEditMode = !!editingId;

  return (
    <>
      <header>
        <div className="logo-mark">yg</div>
        <div>
          <h1>명함 발주 관리</h1>
          <span className="subtitle">요기보코리아 마케팅디자인팀</span>
        </div>
        <div className="header-right">
          <input
            type="month"
            className="month-input"
            value={isEditMode ? editMonth : month}
            onChange={e => isEditMode ? setEditMonth(e.target.value) : setMonth(e.target.value)}
          />
          <div className={`badge-count ${isEditMode ? "badge-edit" : ""}`}>
            {isEditMode ? `✏ 수정 중 (${employees.length}명)` : `${employees.length}명 입력 중`}
          </div>
        </div>
      </header>

      <main>
        {/* 좌측: 직원 정보 입력 */}
        <div className={`panel ${isEditMode ? "panel-editing" : ""}`}>
          <div className="panel-header">
            <div className="step-num">1</div>
            <h2>{isEditMode ? "발주 수정" : "직원 정보 입력"}</h2>
            <span className="panel-sub">
              {isEditMode ? "내용을 수정하고 저장하세요" : "직원 수만큼 추가하세요"}
            </span>
          </div>

          <div className="employees-list">
            {employees.map((emp, idx) => (
              <div key={idx} className="employee-card">
                <div className="employee-card-header">
                  <div className="employee-num">직원 {idx + 1}</div>
                  {employees.length > 1 && (
                    <button className="btn-remove-emp" onClick={() => removeEmployee(idx)} title="삭제">✕</button>
                  )}
                </div>
                <div className="emp-form">
                  <div className="form-row">
                    <label>매장명 <span className="required">*</span></label>
                    <input value={emp.store} onChange={e => setField(idx, "store", e.target.value)} placeholder="스타필드 하남점" />
                  </div>
                  <div className="form-row-2col">
                    <div className="form-row">
                      <label>성명 (한글) <span className="required">*</span></label>
                      <input value={emp.nameKo} onChange={e => setField(idx, "nameKo", e.target.value)} placeholder="홍길동" />
                    </div>
                    <div className="form-row">
                      <label>성명 (영문) <span className="required">*</span></label>
                      <input value={emp.nameEn} onChange={e => setField(idx, "nameEn", e.target.value)} placeholder="Hong Gil Dong" />
                    </div>
                  </div>
                  <div className="form-row">
                    <label>직급</label>
                    <select value={emp.rank} onChange={e => setField(idx, "rank", e.target.value)}>
                      {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-row-2col">
                    <div className="form-row">
                      <label>매장 번호</label>
                      <input value={emp.telStore} onChange={e => setField(idx, "telStore", formatTel(e.target.value))} placeholder="051-000-0000" inputMode="numeric" />
                    </div>
                    <div className="form-row">
                      <label>개인 번호</label>
                      <input value={emp.telPersonal} onChange={e => {
                        const v = e.target.value;
                        setField(idx, "telPersonal", /[a-zA-Z가-힣]/.test(v) ? v : formatTel(v));
                      }} placeholder="010-0000-0000 (없으면 x)" />
                    </div>
                  </div>
                  <div className="form-row">
                    <label>매장 주소</label>
                    <input value={emp.address} onChange={e => setField(idx, "address", e.target.value)} placeholder="신세계 센텀시티몰점 B2F 요기보" />
                    <div className="hint">백화점·쇼핑몰명 + 층 + 요기보</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="order-actions">
            <button className="btn-add-emp" onClick={addEmployee}>
              <span>＋</span> 직원 추가
            </button>
            {isEditMode ? (
              <>
                <button className="btn-cancel-edit" onClick={cancelEdit}>취소</button>
                <button className="btn-save" onClick={saveEdit} disabled={saving}>
                  ✓ {saving ? "저장 중…" : "수정 저장"}
                </button>
              </>
            ) : (
              <button className="btn-save" onClick={saveOrder} disabled={saving}>
                📋 {saving ? "저장 중…" : "목록 생성하기"}
              </button>
            )}
          </div>
        </div>

        {/* 우측: 발주 목록 */}
        <div className="panel table-panel">
          <div className="panel-header">
            <div className="step-num">2</div>
            <h2>발주 목록</h2>
            <button className="btn-refresh" onClick={fetchOrders} title="새로고침">↻</button>
          </div>

          <div className="orders-list">
            {orders.length === 0 ? (
              <div className="empty-state">
                <div className="icon">📋</div>
                <p>아직 발주 목록이 없습니다</p>
                <small>좌측에서 직원 정보를 입력하고<br />목록 생성하기를 눌러주세요</small>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order._id} className={`order-row ${editingId === order._id ? "order-row-editing" : ""}`}>
                  <div
                    className="order-row-header"
                    onClick={() => setExpanded(expanded === order._id ? null : order._id)}
                  >
                    <div className="order-meta">
                      <span className="order-month">{order.month}</span>
                      <span className="order-count">{order.peopleCount}명</span>
                      {order.updatedAtKST && <span className="order-edited">수정됨</span>}
                    </div>
                    <div className="order-date">{order.createdAtKST || new Date(order.createdAt).toLocaleString("ko-KR")}</div>
                    <button
                      className="btn-edit-order"
                      onClick={(e) => startEdit(order, e)}
                      title="수정"
                    >✏ 수정하기</button>
                    <button
                      className="btn-download-pdf"
                      onClick={(e) => downloadPDF(order, e)}
                      disabled={downloading === order._id}
                      title="PDF 다운로드"
                    >
                      {downloading === order._id ? "⏳" : "⬇ 다운받기"}
                    </button>
                    <button
                      className="btn-delete-order"
                      onClick={(e) => deleteOrder(order._id, e)}
                      title="삭제"
                    >✕</button>
                    <div className="order-chevron">{expanded === order._id ? "▲" : "▼"}</div>
                  </div>

                  {expanded === order._id && (
                    <div className="order-detail">
                      <table>
                        <thead>
                          <tr>
                            <th>#</th><th>성명(한글)</th><th>직급</th><th>매장명</th><th>매장번호</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.people.map((p, i) => (
                            <tr key={i}>
                              <td style={{ color: "var(--text-light)", fontSize: 11 }}>{i + 1}</td>
                              <td className="name-ko">{p.nameKo}</td>
                              <td><span className={`rank-badge ${p.rank === "VMD" ? "vm" : ""}`}>{p.rank}</span></td>
                              <td>{p.store}</td>
                              <td>{p.telStore || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </>
  );
}
