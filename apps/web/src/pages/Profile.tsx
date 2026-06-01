import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Card, Button, Input, Label } from '../components/ui';
import { ROLE_LABELS } from '../lib/labels';

export default function Profile() {
  const { user } = useAuth();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword: cur, newPassword: next });
      setMsg({ ok: true, text: 'Пароль изменён' });
      setCur('');
      setNext('');
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 font-display text-2xl text-ink">Профиль</h1>
      <Card className="mb-6 p-5">
        <dl className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
          <dt className="text-slate-500">ФИО</dt><dd className="font-medium text-ink">{user.fullName}</dd>
          <dt className="text-slate-500">Логин</dt><dd className="text-ink">{user.login}</dd>
          <dt className="text-slate-500">Роль</dt><dd className="text-ink">{ROLE_LABELS[user.role]}</dd>
        </dl>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-display text-lg text-ink">Смена пароля</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Текущий пароль</Label>
            <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <Label>Новый пароль</Label>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </div>
          {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-ok/10 text-ok' : 'bg-risk/10 text-risk'}`}>{msg.text}</div>}
          <Button type="submit" disabled={loading || !cur || next.length < 6}>{loading ? 'Сохранение…' : 'Изменить пароль'}</Button>
        </form>
      </Card>
    </div>
  );
}
