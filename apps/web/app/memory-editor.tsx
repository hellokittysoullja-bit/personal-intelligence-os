"use client";

import type { MemoryDto, MemoryScope, MemoryType } from "@pios/contracts";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  activateMemory,
  approveMemory,
  createMemoryCandidate,
  forgetMemory,
  listMemories,
} from "../lib/api";

const memoryTypes: Array<{ value: MemoryType; label: string }> = [
  { value: "owner_preference", label: "Предпочтение владельца" },
  { value: "project_fact", label: "Факт проекта" },
  { value: "world_fact", label: "Внешний факт" },
  { value: "decision", label: "Решение" },
  { value: "lesson", label: "Урок" },
  { value: "temporary_context", label: "Временный контекст" },
];

export function MemoryEditor() {
  const [memories, setMemories] = useState<MemoryDto[]>([]);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [memoryType, setMemoryType] = useState<MemoryType>("owner_preference");
  const [scope, setScope] = useState<MemoryScope>("owner");
  const [showForgotten, setShowForgotten] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setMemories(await listMemories(showForgotten));
    } catch {
      setError("Не удалось загрузить память. Повторите попытку.");
    } finally {
      setIsLoading(false);
    }
  }, [showForgotten]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!subject.trim() || !content.trim()) return;
    setBusyId("new");
    setError(null);
    try {
      await createMemoryCandidate({
        memoryType,
        scope,
        subject: subject.trim(),
        content: content.trim(),
        confidence: 0.8,
      });
      setSubject("");
      setContent("");
      await load();
    } catch {
      setError("Не удалось создать candidate memory. Проверьте поля и повторите попытку.");
    } finally {
      setBusyId(null);
    }
  }

  async function transition(memory: MemoryDto, action: "approve" | "activate" | "forget") {
    setBusyId(memory.id);
    setError(null);
    try {
      if (action === "approve") await approveMemory(memory.id, { expectedVersion: memory.version });
      if (action === "activate") await activateMemory(memory.id, { expectedVersion: memory.version });
      if (action === "forget") await forgetMemory(memory.id, { expectedVersion: memory.version });
      await load();
    } catch {
      setError("Не удалось изменить lifecycle памяти. Возможно, запись уже изменилась; загрузите список заново.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="memory-heading" style={{ marginTop: "2.5rem", borderTop: "1px solid #ddd", paddingTop: "1rem" }}>
      <h2 id="memory-heading">Память владельца</h2>
      <p style={{ opacity: 0.8 }}>
        Новая запись сначала является <strong>candidate</strong>. Только вы можете отдельно подтвердить и активировать её. При активации нового факта с тем же scope и subject старый факт помечается superseded, а не переписывается.
      </p>
      <p style={{ opacity: 0.8 }}>
        «Забыть» исключает запись из штатной памяти, но не переписывает уже существующий журнал аудита; сам текст памяти в событие не сохраняется.
      </p>

      <form onSubmit={handleCreate} style={{ display: "grid", gap: "0.5rem", margin: "1rem 0" }}>
        <label>Тип
          <select value={memoryType} onChange={(event) => setMemoryType(event.target.value as MemoryType)} disabled={busyId === "new"}>
            {memoryTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label>Scope
          <select value={scope} onChange={(event) => setScope(event.target.value as MemoryScope)} disabled={busyId === "new"}>
            <option value="owner">owner</option><option value="project">project</option><option value="mission">mission</option><option value="global">global</option>
          </select>
        </label>
        <label>Subject
          <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={300} disabled={busyId === "new"} placeholder="Например: язык ответов" />
        </label>
        <label>Содержание
          <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={8000} rows={3} disabled={busyId === "new"} placeholder="Например: предпочитает русский язык" />
        </label>
        <button type="submit" disabled={busyId === "new" || !subject.trim() || !content.trim()}>
          {busyId === "new" ? "Создаём candidate..." : "Создать candidate memory"}
        </button>
      </form>

      <label style={{ display: "block", margin: "0.75rem 0" }}>
        <input type="checkbox" checked={showForgotten} onChange={(event) => setShowForgotten(event.target.checked)} /> Показывать forgotten записи
      </label>
      {error && <p role="alert" style={{ color: "#9f1239" }}>{error}</p>}
      {isLoading ? <p role="status">Загружаем память...</p> : null}
      {!isLoading && memories.length === 0 ? <p style={{ opacity: 0.7 }}>Записей пока нет.</p> : null}
      {memories.map((memory) => (
        <article key={memory.id} style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.75rem", marginTop: "0.75rem" }}>
          <strong>{memory.subject}</strong> <span style={{ opacity: 0.7 }}>· {memory.memoryType} · {memory.scope} · {memory.status}</span>
          <p style={{ whiteSpace: "pre-wrap" }}>{memory.content}</p>
          <small>Доверие: {Math.round(memory.confidence * 100)}% · версия {memory.version}{memory.supersedesId ? ` · заменяет ${memory.supersedesId}` : ""}</small>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            {memory.status === "candidate" && <button type="button" onClick={() => void transition(memory, "approve")} disabled={busyId === memory.id}>Подтвердить</button>}
            {memory.status === "approved" && <button type="button" onClick={() => void transition(memory, "activate")} disabled={busyId === memory.id}>Активировать</button>}
            {memory.status !== "forgotten" && <button type="button" onClick={() => void transition(memory, "forget")} disabled={busyId === memory.id}>Исключить из памяти</button>}
          </div>
        </article>
      ))}
    </section>
  );
}
