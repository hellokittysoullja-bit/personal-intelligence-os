"use client";

import type { EventDto, MissionDto, TaskDto } from "@pios/contracts";
import Link from "next/link";
import { use, useEffect, useState, type CSSProperties } from "react";
import { getMission, listTasks, subscribeToMissionEvents } from "../../../lib/api";

const containerStyle: CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  maxWidth: 720,
  margin: "0 auto",
  padding: "3rem 1.5rem",
  lineHeight: 1.6,
};

export default function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [mission, setMission] = useState<MissionDto | null>(null);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [events, setEvents] = useState<EventDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [loadedMission, loadedTasks] = await Promise.all([getMission(id), listTasks(id)]);
        if (!cancelled) {
          setMission(loadedMission);
          setTasks(loadedTasks);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Realtime-таймлайн: события приходят по SSE (docs/ARCHITECTURE.md §12).
  useEffect(() => {
    const unsubscribe = subscribeToMissionEvents(id, (event) => {
      setEvents((previous) =>
        previous.some((e) => e.eventId === event.eventId) ? previous : [...previous, event],
      );
    });
    return unsubscribe;
  }, [id]);

  if (error) {
    return (
      <main style={containerStyle}>
        <Link href="/">← к списку миссий</Link>
        <p style={{ color: "crimson" }}>Ошибка: {error}</p>
      </main>
    );
  }

  return (
    <main style={containerStyle}>
      <Link href="/">← к списку миссий</Link>

      {!mission && <p>Загрузка...</p>}

      {mission && (
        <>
          <h1>{mission.title}</h1>
          <p>{mission.objective}</p>

          <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.25rem 1rem" }}>
            <dt style={{ opacity: 0.7 }}>Статус</dt>
            <dd>{mission.status}</dd>
            <dt style={{ opacity: 0.7 }}>Фаза</dt>
            <dd>{mission.currentPhase}</dd>
            <dt style={{ opacity: 0.7 }}>Уровень риска</dt>
            <dd>{mission.riskLevel}</dd>
            <dt style={{ opacity: 0.7 }}>Создана</dt>
            <dd>{new Date(mission.createdAt).toLocaleString()}</dd>
          </dl>

          <h2>Задачи</h2>
          {tasks.length === 0 ? (
            <p style={{ opacity: 0.7 }}>
              Пока пусто — планировщик появится в Milestone 4.
            </p>
          ) : (
            <ul>
              {tasks.map((task) => (
                <li key={task.id}>
                  {task.title} — {task.status}
                </li>
              ))}
            </ul>
          )}

          <h2>Таймлайн событий (live)</h2>
          {events.length === 0 ? (
            <p style={{ opacity: 0.7 }}>Ожидание событий...</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, fontFamily: "monospace", fontSize: "0.9rem" }}>
              {events.map((event) => (
                <li key={event.eventId} style={{ padding: "0.25rem 0", borderBottom: "1px solid #eee" }}>
                  {new Date(event.timestamp).toLocaleTimeString()} — {event.eventType}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
