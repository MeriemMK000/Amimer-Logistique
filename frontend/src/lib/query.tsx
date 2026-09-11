'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          // Retour DG « la mise à jour des données n'est pas instantanée » :
          //   staleTime 0 + refetch au montage → chaque écran ré-interroge l'API à l'ouverture,
          //   refetchOnWindowFocus → retour d'onglet = données fraîches.
          staleTime: 0,
          refetchOnMount: 'always',
          refetchOnWindowFocus: true,
          refetchOnReconnect: true,
        },
        mutations: { retry: 0 },
      },
    }),
  );
  return (
    <QueryClientProvider client={client}>
      <ConfirmProvider>{children}</ConfirmProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: 'var(--sc)', color: 'var(--tp)', border: '1px solid var(--bd)', fontSize: '.8rem', borderRadius: 'var(--rs)' },
        }}
      />
    </QueryClientProvider>
  );
}
