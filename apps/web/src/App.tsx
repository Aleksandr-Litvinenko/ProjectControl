export default function App() {
  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-slate-500">
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--ok)' }} />
          каркас инициализирован
        </div>
        <h1 className="mt-5 font-display text-4xl tracking-tight text-ink">ProjectControl</h1>
        <p className="mt-2 text-slate-500">Рабочее место проектного офиса</p>
        <p className="mt-6 text-sm text-slate-400">
          Приложение собирается по этапам: аутентификация, проекты, чек-листы, сроки,
          загрузка специалистов и дашборд портфеля.
        </p>
      </div>
    </div>
  );
}
