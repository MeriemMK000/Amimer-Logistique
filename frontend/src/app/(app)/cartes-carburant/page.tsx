import { redirect } from 'next/navigation';

// Le module « Cartes carburant » est désormais un onglet de Carburant (retour DG).
export default function CartesCarburantRedirect() {
  redirect('/carburant?tab=cartes');
}
