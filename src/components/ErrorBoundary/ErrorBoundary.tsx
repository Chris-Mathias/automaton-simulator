import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearWorkspace, readRawWorkspace } from '../../persistence/storage';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

function downloadBackup() {
  const raw = readRawWorkspace();
  if (!raw) return;
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'backup-workspace-automatos.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function resetWorkspace() {
  const confirmed = window.confirm(
    'Isso apaga todos os autômatos salvos neste navegador. Baixe o backup antes se quiser guardá-los. Continuar?',
  );
  if (!confirmed) return;
  clearWorkspace();
  window.location.reload();
}

/**
 * Last line of defense: the workspace autosaves to localStorage, so a state
 * that crashes rendering would otherwise crash it again on every reload with
 * no way out short of clearing site data by hand. Deliberately independent
 * of the store, which may be what's broken.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro não tratado na interface:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-screen" role="alert">
        <div className="error-screen__card">
          <h1>Algo deu errado</h1>
          <p>
            O simulador encontrou um erro inesperado. Tente recarregar a página; se o erro voltar, os autômatos salvos
            neste navegador podem estar corrompidos.
          </p>
          <pre className="error-screen__detail">{this.state.error.message}</pre>
          <div className="error-screen__actions">
            <button type="button" className="error-screen__primary" onClick={() => window.location.reload()}>
              Recarregar
            </button>
            <button type="button" onClick={downloadBackup}>
              Baixar backup
            </button>
            <button type="button" className="error-screen__danger" onClick={resetWorkspace}>
              Limpar workspace
            </button>
          </div>
        </div>
      </div>
    );
  }
}
