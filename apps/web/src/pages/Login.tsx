import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Input, Label } from '../components/ui';

export default function Login() {
  const { refetch } = useAuth();
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/login', { login, password });
      await refetch();
      navigate('/');
    } catch (err) {
      setError(errorMessage(err, 'Не удалось войти'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
            <span className="font-display text-2xl leading-none">P</span>
          </div>
          <h1 className="font-display text-2xl text-ink">ProjectControl</h1>
          <p className="mt-1 text-sm text-slate-500">Рабочее место проектного офиса</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4">
            <Label>Логин</Label>
            <Input value={login} onChange={(e) => setLogin(e.target.value)} autoFocus autoComplete="username" placeholder="например, admin" />
          </div>
          <div className="mb-5">
            <Label>Пароль</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
          </div>
          {error && <div className="mb-4 rounded-lg bg-risk/10 px-3 py-2 text-sm text-risk">{error}</div>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Вход…' : 'Войти'}
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">
          Доступ выдаёт администратор проектного офиса
        </p>
      </div>
    </div>
  );
}
