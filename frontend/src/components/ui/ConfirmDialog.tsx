'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import Modal from './Modal';

interface ConfirmOptions {
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<
    (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  >(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );

  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title ?? 'Confirmer'}
        footer={
          <>
            <button className="btn btn-o" onClick={() => close(false)}>Annuler</button>
            <button className={`btn ${state?.danger ? 'btn-r' : 'btn-p'}`} onClick={() => close(true)}>
              {state?.confirmLabel ?? 'Confirmer'}
            </button>
          </>
        }
      >
        <div style={{ fontSize: '.85rem', color: 'var(--tp)', lineHeight: 1.5 }}>{state?.message}</div>
      </Modal>
    </ConfirmContext.Provider>
  );
}
