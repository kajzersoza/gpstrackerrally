import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-red-200 shadow-sm text-center m-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 font-heading">
            {this.props.fallbackTitle || 'Hiba történt a megjelenítés során'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {this.state.error?.message || 'Egy váratlan hiba miatt a nézet nem tudott betöltődni.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-4 px-4 py-2 bg-[#0060e6] hover:bg-[#0050cb] text-white text-xs font-bold rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Újrapróbálás</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

