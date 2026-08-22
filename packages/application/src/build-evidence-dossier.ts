import type { Evidence, Mission } from "@pios/domain";

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]<>()#+.!|]/g, "\\$&");
}

/**
 * Первый безопасный артефакт research workflow. Это не LLM-синтез: он
 * воспроизводимо объединяет evidence, чтобы владелец видел материал, на
 * котором будущая модель сможет строить отчёт.
 */
export function buildEvidenceDossier(mission: Mission, evidence: Evidence[]): string {
  const lines = [
    `# Evidence dossier: ${escapeMarkdown(mission.title)}`,
    "",
    "## Цель миссии",
    escapeMarkdown(mission.objective),
    "",
    "## Границы",
    "Этот документ содержит только зафиксированные evidence. Он не является выводом модели, не выполняет внешних действий и не заменяет проверку первоисточников.",
    "",
    "## Источники",
  ];
  if (evidence.length === 0) {
    lines.push("Пока нет сохранённых источников.");
  } else {
    for (const [index, item] of evidence.entries()) {
      lines.push(`${index + 1}. [${escapeMarkdown(item.title)}](${item.sourceUrl})`);
      lines.push(`   - Сохранён: ${item.retrievedAt}; уверенность владельца: ${Math.round(item.confidence * 100)}%.`);
      lines.push(`   - Фрагмент: ${escapeMarkdown(item.excerpt)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
