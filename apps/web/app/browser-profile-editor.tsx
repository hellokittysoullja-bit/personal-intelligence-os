"use client";

import type { BrowserProfileDto, BrowserProfileMode } from "@pios/contracts";
import { useCallback, useEffect, useState } from "react";
import { createBrowserProfile, disableBrowserProfile, listBrowserProfiles } from "../lib/api";

const profileCopy: Record<BrowserProfileMode, { label: string; description: string }> = {
  agent_isolated: {
    label: "Изолированный профиль агента",
    description: "Отдельный профиль для безопасной работы агента. Подключение сайтов, cookies и запуск Chromium ещё не выполняются.",
  },
  owner_shared: {
    label: "Общий профиль владельца",
    description: "Будущий режим для обычного браузинга под вашим контролем. Логины, CAPTCHA и личные данные всегда останутся ручным human takeover.",
  },
};

export function BrowserProfileEditor() {
  const [profiles, setProfiles] = useState<BrowserProfileDto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setProfiles(await listBrowserProfiles());
      setError(null);
    } catch {
      setError("Не удалось загрузить browser profiles. Попробуйте обновить список.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create(mode: BrowserProfileMode) {
    setBusy(`create:${mode}`);
    setError(null);
    setNotice(null);
    try {
      const profile = await createBrowserProfile({ label: profileCopy[mode].label, mode });
      setNotice(`Создан profile «${profile.label}». Chromium и внешние сайты не были открыты.`);
      await load();
    } catch {
      setError("Profile не создан. Проверьте соединение и повторите попытку.");
    } finally {
      setBusy(null);
    }
  }

  async function disable(profile: BrowserProfileDto) {
    setBusy(profile.id);
    setError(null);
    setNotice(null);
    try {
      await disableBrowserProfile(profile.id, profile.version);
      setNotice(`Profile «${profile.label}» отключён. Ни одна browser session не запускалась.`);
      await load();
    } catch {
      setError("Profile не отключён: он мог измениться. Загрузите актуальный список и повторите действие.");
    } finally {
      setBusy(null);
    }
  }

  return <section aria-labelledby="browser-profiles-heading" style={{ marginTop: "2.5rem", borderTop: "1px solid #ddd", paddingTop: "1rem" }}>
    <h2 id="browser-profiles-heading">Browser profiles: изолированный и общий режимы</h2>
    <p style={{ opacity: 0.8 }}>
      Сейчас это только безопасный control-plane: он хранит режим и состояние профиля. Панель не запускает Chromium,
      не открывает сайты, не читает cookies и не получает доступ к аккаунтам.
    </p>
    <div role="status" aria-live="polite">
      {notice && <p style={{ color: "#166534" }}>{notice}</p>}
      {error && <p role="alert" style={{ color: "#9f1239" }}>{error}</p>}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {(Object.keys(profileCopy) as BrowserProfileMode[]).map((mode) => <button
        key={mode}
        type="button"
        disabled={busy !== null}
        onClick={() => void create(mode)}
      >
        Создать: {profileCopy[mode].label}
      </button>)}
      <button type="button" disabled={busy !== null} onClick={() => void load()}>Обновить список</button>
    </div>
    {profiles.length === 0 ? <p style={{ opacity: 0.7 }}>Profiles ещё не созданы.</p> : profiles.map((profile) => <article key={profile.id} style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.75rem", marginTop: "0.75rem" }}>
      <strong>{profile.label}</strong>
      <p style={{ marginBottom: "0.4rem" }}>{profileCopy[profile.mode].description}</p>
      <small>Режим: {profile.mode} · Состояние: {profile.status} · Версия: {profile.version}</small>
      {profile.status === "active" && <div style={{ marginTop: "0.5rem" }}>
        <button type="button" disabled={busy !== null} onClick={() => void disable(profile)}>Отключить profile</button>
      </div>}
    </article>)}
  </section>;
}
