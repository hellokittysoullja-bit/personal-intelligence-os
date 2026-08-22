"use client";

import type { EvidenceDto, MissionDto } from "@pios/contracts";
import { useEffect, useState, type FormEvent } from "react";
import { captureOwnerEvidence, listEvidence } from "../../../lib/api";

type Props = { mission: MissionDto };

export function EvidenceEditor({ mission }: Props) {
  const [items, setItems] = useState<EvidenceDto[]>([]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mission.status !== "planning") return;
    void listEvidence(mission.id).then(setItems).catch(() => setError("Не удалось загрузить источники."));
  }, [mission.id, mission.status]);

  if (mission.status !== "planning" || mission.currentPhase !== "plan") return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const evidence = await captureOwnerEvidence(mission.id, { sourceUrl, title, excerpt, confidence: 0.5 });
      setItems((previous) => [...previous, evidence]);
      setSourceUrl(""); setTitle(""); setExcerpt("");
    } catch {
      setError("Не удалось сохранить источник. Проверьте URL и заполните все поля.");
    } finally {
      setSaving(false);
    }
  }

  return <section aria-labelledby="evidence-title" style={{ margin: "1.5rem 0" }}>
    <h2 id="evidence-title">Источники и evidence</h2>
    <p style={{ opacity: 0.8 }}>Добавьте проверенный фрагмент источника. Он сохраняется в журнале, но система ещё не открывает сайты, не входит в аккаунты и не выполняет внешние действия.</p>
    {error && <p role="alert" style={{ color: "#9f1239" }}>{error}</p>}
    <form onSubmit={submit}>
      <label htmlFor="evidence-url">URL источника</label>
      <input id="evidence-url" type="url" required value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} style={{ display: "block", width: "100%", margin: "0.25rem 0 0.75rem" }} />
      <label htmlFor="evidence-title-input">Заголовок</label>
      <input id="evidence-title-input" required value={title} onChange={(event) => setTitle(event.target.value)} style={{ display: "block", width: "100%", margin: "0.25rem 0 0.75rem" }} />
      <label htmlFor="evidence-excerpt">Проверяемый фрагмент</label>
      <textarea id="evidence-excerpt" required rows={4} value={excerpt} onChange={(event) => setExcerpt(event.target.value)} style={{ display: "block", width: "100%", margin: "0.25rem 0 0.75rem" }} />
      <button type="submit" disabled={saving}>{saving ? "Сохраняю..." : "Добавить источник"}</button>
    </form>
    {items.length > 0 && <ul>{items.map((item) => <li key={item.id}><a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.title}</a> — {item.excerpt}</li>)}</ul>}
  </section>;
}
