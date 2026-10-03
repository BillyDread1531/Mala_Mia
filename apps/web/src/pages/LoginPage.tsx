import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { ApiError } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import './LoginPage.css';

export function LoginPage() {
  const { status, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos conectar con MALA MÍA. Revisa tu conexión e intenta de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <Card className="login-card">
        <div className="login-card__brand">
          <h1 className="login-card__brand-title">MALA MÍA</h1>
          <img className="login-card__logo" src="/mala-mia-wordmark.png" alt="MALA MÍA" />
          <p>Inicia sesión para continuar</p>
        </div>

        <form className="login-card__form" onSubmit={handleSubmit} noValidate>
          <Input
            label="Usuario"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            autoFocus
          />
          <Input
            label="Contraseña"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error ? (
            <p className="login-card__error" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" fullWidth loading={submitting}>
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}
