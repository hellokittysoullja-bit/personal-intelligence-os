"use client";

import type { BrowserProfileDto, BrowserProfileMode, BrowserSessionDto } from "@pios/contracts";
import { useCallback, useEffect, useState } from "react";
import {
  closeBrowserSession,
  createBrowserProfile,
  disableBrowserProfile,
  listBrowserProfiles,
  listBrowserSessions,
  requestBrowserHumanTakeover,
  returnBrowserControlToAgent,
  startBrowserSession,
} from "../lib/api";

const profileCopy: Record<BrowserProfileMode, { label: string; description: string }> = {
  agent_isolated: {
    label: "Изолированный профиль агента",
    description: "Отдельный PIOS-профиль. Chromium binary, сайты, cookies и запуск browser session ещё не выполняются этой панелью.",
  },
  owner_shared: {
    label: "Общий профиль владельца",
    description: "Будущий отдельный PIOS-профиль под вашим ручным контролем — не default Chrome profile. Логины, CAPTCHA и личные данные останутся human takeover.",
  },
};

export function BrowserProfileEditor() {
  const [profiles, setProfiles] = useState<BrowserProfileDto[]>([]);
  const [sessions, setSessions] = useState<BrowserSessionDto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextProfiles, nextSessions] = await Promise.all([listBrowserProfiles(), listBrowserSessions()]);
      setProfiles(nextProfiles);
      setSessions(nextSessions);
      setError(null);
    } catch {
      setError("Не удалось загрузить browser control-plane. Попробуйте обновить список.");
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

  async function start(profile: BrowserProfileDto) {
    setBusy(`start:${profile.id}`);
    setError(null);
    setNotice(null);
    try {
      const session = await startBrowserSession(profile.id);
      setNotice(`Создана session ${session.id.slice(0, 8)}… в состоянии ${session.status}. Это не запуск Chromium.`);
      await load();
    } catch {
      setError("Session не создана: profile мог измениться или быть отключён. Обновите список.");
    } finally {
      setBusy(null);
    }
  }

  async function transition(session: BrowserSessionDto, action: "takeover" | "return" | "close") {
    setBusy(`${action}:${session.id}`);
    setError(null);
    setNotice(null);
    try {
      if (action === "takeover") await requestBrowserHumanTakeover(session.id, session.version);
      if (action === "return") await returnBrowserControlToAgent(session.id, session.version);
      if (action === "close") await closeBrowserSession(session.id, session.version);
      setNotice("Session state сохранён. Chromium, сайты и аккаунты не были открыты.");
      await load();
    } catch {
      setError("Session state не изменён: она могла быть обновлена. Загрузите актуальный список.");
    } finally {
      setBusy(null);
    }
  }

  return <section aria-labelledby="browser-profiles-heading" style={{ marginTop: "2.5rem", borderTop: "1px solid #ddd", paddingTop: "1rem" }}>
    <h2 id="browser-profiles-heading">Browser profiles: изолированный и общий режимы</h2>
    <p style={{ opacity: 0.8 }}>
      Здесь хранится только безопасный control-plane. Даже создание session ниже не запускает Chromium, не открывает URL,
      не читает cookies и не получает доступ к аккаунтам. Полное observation сможет создать только будущий runtime через policy gate.
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
      {profile.status === "active" && <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button type="button" disabled={busy !== null} onClick={() => void start(profile)}>Создать control-plane session</button>
        <button type="button" disabled={busy !== null} onClick={() => void disable(profile)}>Отключить profile</button>
      </div>}
    </article>)}

    <h3 style={{ marginTop: "1.5rem" }}>Browser sessions</h3>
    {sessions.length === 0 ? <p style={{ opacity: 0.7 }}>Sessions ещё не созданы.</p> : sessions.map((session) => <article key={session.id} style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.75rem", marginTop: "0.75rem" }}>
      <strong>Session {session.id.slice(0, 8)}…</strong>
      <p style={{ margin: "0.4rem 0" }}>Состояние: {session.status} · Контроль: {session.controlOwner} · Повторное observation: {session.reobservationRequired ? "обязательно" : "не требуется"} · Версия: {session.version}</p>
      {session.status !== "closed" && <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {session.controlOwner !== "human" && <button type="button" disabled={busy !== null} onClick={() => void transition(session, "takeover")}>Передать control владельцу</button>}
        {session.controlOwner === "human" && <button type="button" disabled={busy !== null} onClick={() => void transition(session, "return")}>Вернуть control агенту</button>}
        <button type="button" disabled={busy !== null} onClick={() => void transition(session, "close")}>Закрыть control-plane session</button>
      </div>}
    </article>)}
  </section>;
}
