"use client";

import type { MissionDto, ResearchReportDto } from "@pios/contracts";
import { useCallback, useEffect, useState } from "react";
import { generateResearchReport, listResearchReports } from "../../../lib/api";

export function ReportEditor({ mission }: { mission: MissionDto }) {
  const [reports, setReports] = useState<ResearchReportDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setReports(await listResearchReports(mission.id));
    } catch {
      setError("Не удалось загрузить сохранённые черновики отчётов.");
    } finally {
      setIsLoading(false);
    }
  }, [mission.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const canGenerate = mission.status === "planning" && mission.currentPhase === "plan";

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    try {
      const report = await generateResearchReport(mission.id);
      setReports((previous) => [...previous, report]);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "";
      setError(
        message.includes("503")
          ? "На этом сервере model gateway ещё не настроен. Источники и dossier остаются доступны; ключ в браузер не передаётся."
          : "Не удалось собрать черновик. Убедитесь, что есть источники, и повторите попытку.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section aria-labelledby="research-report-heading" style={{ marginTop: "2rem", borderTop: "1px solid #ddd", paddingTop: "1rem" }}>
      <h2 id="research-report-heading">Черновики исследовательского отчёта</h2>
      <p style={{ opacity: 0.8 }}>
        Генерация запускается только этой кнопкой и использует уже сохранённые источники. Это черновик, а не самостоятельное действие агента: каждый факт обязан содержать ID источника, а итог требует вашей проверки.
      </p>
      <button type="button" onClick={() => void handleGenerate()} disabled={!canGenerate || isGenerating}>
        {isGenerating ? "Собираем черновик..." : "Собрать цитируемый черновик"}
      </button>
      {!canGenerate && <p style={{ opacity: 0.7 }}>Сначала подтвердите контракт и создайте read-only план исследования.</p>}
      {error && <p role="alert" style={{ color: "#9f1239" }}>{error}</p>}
      {isLoading ? <p role="status">Загружаем черновики...</p> : null}
      {!isLoading && reports.length === 0 ? <p style={{ opacity: 0.7 }}>Черновиков пока нет.</p> : null}
      {reports.map((report) => (
        <article key={report.id} style={{ marginTop: "1rem", border: "1px solid #ddd", borderRadius: 6, padding: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>{report.content.title}</h3>
          <p>{report.content.summary.text}</p>
          <p><strong>Источники summary:</strong> {report.content.summary.evidenceIds.join(", ")}</p>
          <h4>Утверждения</h4>
          <ul>
            {report.content.claims.map((claim, index) => (
              <li key={`${report.id}-${index}`}>
                {claim.statement} <span style={{ opacity: 0.7 }}>(доверие {Math.round(claim.confidence * 100)}%; evidence: {claim.evidenceIds.join(", ")})</span>
              </li>
            ))}
          </ul>
          {report.content.limitations.length > 0 && (
            <p><strong>Ограничения:</strong> {report.content.limitations.join(" ")}</p>
          )}
          <p style={{ opacity: 0.65, fontSize: "0.85rem" }}>
            {new Date(report.createdAt).toLocaleString()} · {report.model.providerId}/{report.model.model} · repair: {report.model.repairAttempted ? "да" : "нет"}
          </p>
        </article>
      ))}
    </section>
  );
}
