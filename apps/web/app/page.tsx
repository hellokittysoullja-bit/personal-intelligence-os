"use client";

import type { MissionDto } from "@pios/contracts";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { createMission, listMissions } from "../lib/api";

export default function HomePage() {
  const [missions, setMissions] = useState<MissionDto[] | null>(null);
  const [rawRequest, setRawRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setMissions(await listMissions());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!rawRequest.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createMission(rawRequest.trim());
      setRawRequest("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 720,
        margin: "0 auto",
        padding: "3rem 1.5rem",
        lineHeight: 1.6,
      }}
    >
      <h1>Personal Intelligence OS</h1>
      <p>
        <strong>Milestone 2 — Mission и Events.</strong> Пока без реального LLM:
        миссия создаётся как есть, без интерпретации намерения (это Milestone 3).
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem", margin: "1.5rem 0" }}>
        <input
          type="text"
          value={rawRequest}
          onChange={(event) => setRawRequest(event.target.value)}
          placeholder="Опишите, что нужно сделать..."
          style={{ flex: 1, padding: "0.5rem", fontSize: "1rem" }}
          disabled={submitting}
        />
        <button type="submit" disabled={submitting || !rawRequest.trim()} style={{ padding: "0.5rem 1rem" }}>
          {submitting ? "Создаю..." : "Start"}
        </button>
      </form>

      {error && <p style={{ color: "crimson" }}>Ошибка: {error}</p>}

      <h2>Миссии</h2>
      {missions === null && <p>Загрузка...</p>}
      {missions !== null && missions.length === 0 && <p>Миссий пока нет.</p>}
      {missions !== null && missions.length > 0 && (
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
              <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                статус: {mission.status} · фаза: {mission.currentPhase} · создана:{" "}
                {new Date(mission.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
