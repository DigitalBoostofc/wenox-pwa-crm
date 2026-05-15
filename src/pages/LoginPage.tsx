import { useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useAuth } from '@/auth/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await login(email, senha);
    } catch {
      setErro('Credenciais inválidas');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <h1 style={{ textAlign: 'center', marginTop: 48 }}>Wenox ⚡</h1>
          <form onSubmit={onSubmit}>
            <label htmlFor="email" style={{ display: 'block', marginTop: 16 }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: 12, marginTop: 4 }}
            />
            <label htmlFor="senha" style={{ display: 'block', marginTop: 16 }}>
              Senha
            </label>
            <input
              id="senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={{ width: '100%', padding: 12, marginTop: 4 }}
            />
            {erro && (
              <p style={{ color: 'var(--ion-color-danger, #eb445a)' }}>{erro}</p>
            )}
            <button
              type="submit"
              disabled={carregando}
              style={{
                width: '100%',
                padding: 14,
                marginTop: 24,
                background: 'var(--ion-color-primary)',
                color: 'var(--ion-color-primary-contrast)',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
              }}
            >
              Entrar
            </button>
          </form>
        </div>
      </IonContent>
    </IonPage>
  );
}
