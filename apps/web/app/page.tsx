"use client";

import type { MissionDto } from "@pios/contracts";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { createMission, listMissions } from "../lib/api";

const containerStyle = {
  fontFamily: "system-ui, sans-serif",
  maxWidth: 720,
  margin: "0 auto",
  padding: "3rem 1.5rem",
  lineHeight: 1.6,
};

function formatMissionState(mission: MissionDto): string {
  if (mission.status === "created" && mission.currentPhase === "intake") {
    return "Создана · ожидает уточнения";
  }
  return `${mission.status} · ${mission.currentPhase}`;
}

export default function HomePage() {
  const [missions, setMissions] = useState<MissionDto[] | null>(null);
  const [rawRequest, setRawRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    setIsLoading(true);
    setError(null);
    try {
      setMissions(await listMissions());
    } catch {
      setError("Не удалось загрузить миссии. Проверьте, что API доступен, и повторите попытку.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const normalizedRequest = rawRequest.trim();
    if (!normalizedRequest) return;

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const createdMission = await createMission(normalizedRequest);
      setRawRequest("");
      setMissions((previous) => (previous === null ? [createdMission] : [createdMission, ...previous]));
      setNotice("Миссия создана и сохранена. Автоматическое выполнение в этом выпуске не запускается.");
    } catch {
      setError("Не удалось создать миссию. Проверьте подключение и повторите попытку.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={containerStyle}>
      <h1>Personal Intelligence OS</h1>
      <p>
        <strong>Milestone 2 — Mission и Events.</strong> Миссия сохраняется как намерение и
        появляется в журнале. Интерпретация, планирование и автоматическое выполнение пока не
        включены.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", margin: "1.5rem 0" }}>
        <label htmlFor="mission-request" style={{ display: "block", flexBasis: "100%", fontWeight: 600 }}>
          Намерение или задача
        </label>
        <p id="mission-request-help" style={{ flexBasis: "100%", margin: 0, opacity: 0.75 }}>
          Опишите результат, который хотите получить. Сейчас текст будет сохранён без изменения.
        </p>
        <input
          id="mission-request"
          type="text"
          value={rawRequest}
          onChange={(event) => setRawRequest(event.target.value)}
          placeholder="Например: собрать отчёт по продажам за неделю"
          aria-describedby="mission-request-help"
          style={{ flex: "1 1 18rem", padding: "0.5rem", fontSize: "1rem" }}
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={submitting || !rawRequest.trim()}
          style={{ minHeight: "2.75rem", padding: "0.5rem 1rem" }}
        >
          {submitting ? "Создаю миссию..." : "Создать миссию"}
        </button>
      </form>

      {error && (
        <section role="alert" aria-live="assertive" style={{ color: "#9f1239", marginBottom: "1rem" }}>
          <p>{error}</p>
          <button type="button" onClick={() => void refresh()} disabled={isLoading}>
            {isLoading ? "Повторяем..." : "Повторить загрузку"}
          </button>
        </section>
      )}
      {notice && <p role="status" aria-live="polite" style={{ color: "#166534" }}>{notice}</p>}

      <h2>Миссии</h2>
      {isLoading && <p role="status">Загружаем миссии...</p>}
      {!isLoading && missions !== null && missions.length === 0 && <p>Миссий пока нет.</p>}
      {!isLoading && missions !== null && missions.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {missions.map((mission) => (
            <li
              key={mission.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: 6,
                padding: "0.75rem 1rem",
                marginBottom: "0.5rem",
              }}
            >
              <Link href={`/missions/${mission.id}`}>{mission.title}</Link>
              <div style={{ fontSize: "0.85rem", opacity: 0.75 }}>
                {formatMissionState(mission)} · создана: {new Date(mission.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
