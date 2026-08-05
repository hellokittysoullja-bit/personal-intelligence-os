export default function HomePage() {
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
        Фундамент проекта. Сейчас реализован <strong>Milestone 1 — Foundation</strong>:
        репозиторий устанавливается и запускается, API и worker поднимаются,
        PostgreSQL подключается.
      </p>
      <p>
        Доменная модель миссий, оркестрация и агенты появятся в следующих
        milestone — см. <code>docs/ROADMAP.md</code> в репозитории.
      </p>
    </main>
  );
}
