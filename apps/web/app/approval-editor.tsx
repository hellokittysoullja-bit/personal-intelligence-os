"use client";

import type { ApprovalDto } from "@pios/contracts";
import { useCallback, useEffect, useState } from "react";
import { decideApproval, listApprovals } from "../lib/api";

export function ApprovalEditor() {
  const [approvals, setApprovals] = useState<ApprovalDto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setApprovals(await listApprovals()); } catch { setError("Не удалось загрузить requests на подтверждение."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function decide(approval: ApprovalDto, decision: "approved" | "rejected") {
    setBusy(approval.id); setError(null);
    try { await decideApproval(approval.id, { decision }); await load(); }
    catch { setError("Решение не сохранено: request мог истечь или измениться. Загрузите список заново."); }
    finally { setBusy(null); }
  }
  return <section aria-labelledby="approvals-heading" style={{ marginTop: "2.5rem", borderTop: "1px solid #ddd", paddingTop: "1rem" }}>
    <h2 id="approvals-heading">Внешние действия: подтверждение владельца</h2>
    <p style={{ opacity: 0.8 }}>Одобрение привязано к показанному preview и payload hash, действует один раз и может истечь. Эта панель не выполняет действие сама.</p>
    {error && <p role="alert" style={{ color: "#9f1239" }}>{error}</p>}
    {approvals.length === 0 ? <p style={{ opacity: 0.7 }}>Ожидающих подтверждений нет.</p> : approvals.map((approval) => <article key={approval.id} style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.75rem", marginTop: "0.75rem" }}>
      <strong>{approval.channel} · {approval.actionKind} · {approval.riskLevel}</strong>
      <p style={{ whiteSpace: "pre-wrap" }}>{approval.preview}</p>
      <small>Истекает: {new Date(approval.expiresAt).toLocaleString()} · hash: {approval.payloadHash.slice(0, 12)}…</small>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button type="button" disabled={busy === approval.id} onClick={() => void decide(approval, "approved")}>Одобрить ровно это действие</button>
        <button type="button" disabled={busy === approval.id} onClick={() => void decide(approval, "rejected")}>Отклонить</button>
      </div>
    </article>)}
  </section>;
}
