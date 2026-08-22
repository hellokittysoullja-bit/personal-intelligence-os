"use client";

import type { MissionDto } from "@pios/contracts";
import { useEffect, useState, type FormEvent } from "react";
import { confirmMissionContract, planResearchMission, updateMissionContract } from "../../../lib/api";

function lines(value: string): string[] {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

type Props = {
  mission: MissionDto;
  onMissionChanged: (mission: MissionDto) => void;
};

export function ContractEditor({ mission, onMissionChanged }: Props) {
  const [objective, setObjective] = useState(mission.objective);
  const [autonomyLevel, setAutonomyLevel] = useState(mission.autonomyLevel);
  const [riskLevel, setRiskLevel] = useState(mission.riskLevel);
  const [successCriteria, setSuccessCriteria] = useState(mission.successCriteria.join("\n"));
  const [constraints, setConstraints] = useState(mission.constraints.join("\n"));
  const [unknowns, setUnknowns] = useState(mission.unknowns.join("\n"));
  const [assumptions, setAssumptions] = useState(mission.assumptions.join("\n"));
  const [stopConditions, setStopConditions] = useState(mission.stopConditions.join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setObjective(mission.objective);
    setAutonomyLevel(mission.autonomyLevel);
    setRiskLevel(mission.riskLevel);
    setSuccessCriteria(mission.successCriteria.join("\n"));
    setConstraints(mission.constraints.join("\n"));
    setUnknowns(mission.unknowns.join("\n"));
    setAssumptions(mission.assumptions.join("\n"));
    setStopConditions(mission.stopConditions.join("\n"));
  }, [mission]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateMissionContract(mission.id, {
        expectedVersion: mission.version,
        objective,
        autonomyLevel,
        riskLevel,
        budget: mission.budget,
        successCriteria: lines(successCriteria),
        constraints: lines(constraints),
        unknowns: lines(unknowns),
        assumptions: lines(assumptions),
        stopConditions: lines(stopConditions),
      });
      onMissionChanged(updated);
      setNotice("Черновик контракта сохранён. Никакие инструменты не запускались.");
    } catch {
      setError("Не удалось сохранить контракт. Обновите страницу: возможно, версия миссии изменилась.");
    } finally {
      setSaving(false);
    }
  }

  async function planResearch() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const planned = await planResearchMission(mission.id, { expectedVersion: mission.version });
      onMissionChanged(planned);
      setNotice("Создан безопасный план исследования из трёх read-only задач. Внешние инструменты ещё не запускаются.");
    } catch {
      setError("Не удалось создать план исследования. Обновите страницу и проверьте статус миссии.");
    } finally {
      setSaving(false);
    }
  }

  async function confirm() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const confirmed = await confirmMissionContract(mission.id, { expectedVersion: mission.version });
      onMissionChanged(confirmed);
      setNotice("Контракт подтверждён владельцем. Система не запускает инструменты автоматически.");
    } catch {
      setError("Не удалось подтвердить контракт. Убедитесь, что задан хотя бы один критерий успеха.");
    } finally {
      setSaving(false);
    }
  }

  const editable = mission.status === "created" && ["intake", "contract"].includes(mission.currentPhase);

  return (
    <section aria-labelledby="mission-contract" style={{ margin: "1.5rem 0" }}>
      <h2 id="mission-contract">Контракт миссии</h2>
      <p style={{ opacity: 0.8 }}>
        Контракт определяет границы будущей работы. Сохранение и подтверждение не выполняют задачи и не запускают внешние действия.
      </p>
      {error && <p role="alert" style={{ color: "#9f1239" }}>{error}</p>}
      {notice && <p role="status" style={{ color: "#166534" }}>{notice}</p>}
      {mission.status === "understanding" && mission.currentPhase === "understand" ? (
        <div>
          <p>Контракт подтверждён. Теперь можно создать только план исследования; сам сбор источников будет отдельным контролируемым шагом.</p>
          <button type="button" onClick={() => void planResearch()} disabled={saving}>
            {saving ? "Создаю план..." : "Создать read-only план исследования"}
          </button>
        </div>
      ) : !editable ? (
        <p>Контракт уже зафиксирован в журнале событий.</p>
      ) : (
        <form onSubmit={save}>
          <label htmlFor="contract-objective">Ожидаемый результат</label>
          <textarea id="contract-objective" value={objective} onChange={(event) => setObjective(event.target.value)} required rows={3} style={{ display: "block", width: "100%", margin: "0.25rem 0 0.75rem" }} />
          <label htmlFor="contract-success">Критерии успеха — по одному на строку</label>
          <textarea id="contract-success" value={successCriteria} onChange={(event) => setSuccessCriteria(event.target.value)} rows={3} style={{ display: "block", width: "100%", margin: "0.25rem 0 0.75rem" }} />
          <label htmlFor="contract-constraints">Ограничения — по одному на строку</label>
          <textarea id="contract-constraints" value={constraints} onChange={(event) => setConstraints(event.target.value)} rows={2} style={{ display: "block", width: "100%", margin: "0.25rem 0 0.75rem" }} />
          <label htmlFor="contract-stop">Условия остановки — по одному на строку</label>
          <textarea id="contract-stop" value={stopConditions} onChange={(event) => setStopConditions(event.target.value)} rows={2} style={{ display: "block", width: "100%", margin: "0.25rem 0 0.75rem" }} />
          <label htmlFor="contract-autonomy">Автономность</label>
          <select id="contract-autonomy" value={autonomyLevel} onChange={(event) => setAutonomyLevel(event.target.value as MissionDto["autonomyLevel"])} style={{ margin: "0 1rem 0.75rem 0" }}>
            <option value="manual">Ручная</option><option value="supervised">Под наблюдением</option><option value="autonomous">Автономная</option>
          </select>
          <label htmlFor="contract-risk">Риск</label>
          <select id="contract-risk" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as MissionDto["riskLevel"])} style={{ marginBottom: "0.75rem" }}>
            <option value="L0">L0</option><option value="L1">L1</option><option value="L2">L2</option><option value="L3">L3</option><option value="L4">L4</option>
          </select>
          <details style={{ marginBottom: "0.75rem" }}><summary>Текущие лимиты бюджета</summary><p>До ${mission.budget.maxEstimatedCostUsd.toFixed(2)}, {mission.budget.maxModelCalls} вызовов модели и {mission.budget.maxToolCalls} вызовов инструментов. Изменение лимитов появится отдельным контролируемым этапом.</p></details>
          <button type="submit" disabled={saving || !objective.trim()}>{saving ? "Сохраняю..." : "Сохранить черновик"}</button>
          <button type="button" onClick={() => void confirm()} disabled={saving || mission.currentPhase !== "contract" || lines(successCriteria).length === 0} style={{ marginLeft: "0.5rem" }}>Подтвердить контракт</button>
        </form>
      )}
    </section>
  );
}
