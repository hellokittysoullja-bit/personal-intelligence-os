"use client";

import type { EventDto, MissionDto, TaskDto } from "@pios/contracts";
import Link from "next/link";
import { use, useCallback, useEffect, useState, type CSSProperties } from "react";
import { getMission, listTasks, subscribeToMissionEvents } from "../../../lib/api";
import { ContractEditor } from "./contract-editor";
import { EvidenceEditor } from "./evidence-editor";

const containerStyle: CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  maxWidth: 720,
  margin: "0 auto",
  padding: "3rem 1.5rem",
  lineHeight: 1.6,
};

function formatMissionStatus(mission: MissionDto): string {
  if (mission.status === "created" && mission.currentPhase === "intake") {
    return "Создана — ожидает уточнения";
  }
  return mission.status;
}

function formatMissionPhase(mission: MissionDto): string {
  if (mission.currentPhase === "intake") return "Сбор намерения";
  return mission.currentPhase;
}

export default function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [mission, setMission] = useState<MissionDto | null>(null);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [events, setEvents] = useState<EventDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [loadedMission, loadedTasks] = await Promise.all([getMission(id), listTasks(id)]);
      setMission(loadedMission);
      setTasks(loadedTasks);
    } catch {
      setError("Не удалось загрузить миссию. Проверьте подключение и повторите попытку.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime-таймлайн: события приходят по SSE (docs/ARCHITECTURE.md §12).
  useEffect(() => {
    const unsubscribe = subscribeToMissionEvents(id, (event) => {
      setEvents((previous) =>
        previous.some((existingEvent) => existingEvent.eventId === event.eventId)
          ? previous
          : [...previous, event],
      );
    });
    return unsubscribe;
  }, [id]);

  return (
    <main style={containerStyle}>
      <Link href="/">← к списку миссий</Link>

      {error && (
        <section role="alert" aria-live="assertive" style={{ color: "#9f1239", marginTop: "1rem" }}>
          <p>{error}</p>
          <button type="button" onClick={() => void load()} disabled={isLoading}>
            {isLoading ? "Повторяем..." : "Повторить загрузку"}
          </button>
        </section>
      )}

      {isLoading && !mission && <p role="status">Загружаем миссию...</p>}

      {mission && (
        <>
          <h1>{mission.title}</h1>
          <p>{mission.objective}</p>

          <section aria-labelledby="mission-next-step" style={{ borderLeft: "4px solid #2563eb", paddingLeft: "1rem", margin: "1.5rem 0" }}>
            <h2 id="mission-next-step" style={{ margin: 0 }}>Следующий шаг</h2>
            <p>
              Сначала заполните и сохраните контракт. Затем его нужно явно подтвердить; ни одно из этих действий не запускает планирование, инструменты или внешние операции.
            </p>
          </section>

          <ContractEditor mission={mission} onMissionChanged={setMission} />

          <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.25rem 1rem" }}>
            <dt style={{ opacity: 0.7 }}>Статус</dt>
            <dd>{formatMissionStatus(mission)}</dd>
            <dt style={{ opacity: 0.7 }}>Фаза</dt>
            <dd>{formatMissionPhase(mission)}</dd>
            <dt style={{ opacity: 0.7 }}>Уровень риска</dt>
            <dd>{mission.riskLevel}</dd>
            <dt style={{ opacity: 0.7 }}>Создана</dt>
            <dd>{new Date(mission.createdAt).toLocaleString()}</dd>
          </dl>

          <h2>Задачи</h2>
          {tasks.length === 0 ? (
            <p style={{ opacity: 0.7 }}>
              Задач пока нет: подтвердите контракт и создайте read-only план исследования.
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

          <EvidenceEditor mission={mission} />

          <h2>Таймлайн событий</h2>
          {events.length === 0 ? (
            <p role="status" style={{ opacity: 0.7 }}>Ожидание событий...</p>
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
