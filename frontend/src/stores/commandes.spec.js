/**
 * Tests unitaires du store commandes (getters + action loadAll avec API mockée).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCommandesStore } from './commandes';
import { fetchCommandes, fetchVentesCaisse, AuthRequiredError } from '@/api';

vi.mock('@/api', () => ({
  fetchCommandes: vi.fn(),
  fetchVentesCaisse: vi.fn(),
  saveCommandeNote: vi.fn(),
  reopenCommande: vi.fn(),
  fetchVenteDetail: vi.fn(),
  sendTicketPDF: vi.fn(),
  AuthRequiredError: Symbol('AuthRequired'),
}));

describe('commandes store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(fetchCommandes).mockReset();
    vi.mocked(fetchVentesCaisse).mockReset();
  });

  describe('filteredCommandes', () => {
    it('filtre par searchTerm sur originalname', () => {
      const store = useCommandesStore();
      store.$patch({
        commandes: [
          { id: 1, originalname: 'Commande Fruits', catalog_description: '', note: '' },
          { id: 2, originalname: 'Commande Legumes', catalog_description: '', note: '' },
        ],
        searchTerm: 'fruits',
      });
      const list = store.filteredCommandes;
      expect(list).toHaveLength(1);
      expect(list[0].originalname).toBe('Commande Fruits');
    });
  });

  describe('sortedCommandes', () => {
    it('trie par created_at desc par défaut', () => {
      const store = useCommandesStore();
      store.$patch({
        commandes: [
          { id: 1, created_at: '2025-01-10', originalname: 'B' },
          { id: 2, created_at: '2025-01-15', originalname: 'A' },
          { id: 3, created_at: '2025-01-12', originalname: 'C' },
        ],
        sortColumn: 'created_at',
        sortDirection: 'desc',
      });
      const sorted = store.sortedCommandes;
      expect(sorted.map((c) => c.id)).toEqual([2, 3, 1]);
    });
  });

  describe('loadAll (action)', () => {
    it('met à jour commandes et ventes après succès API', async () => {
      const store = useCommandesStore();
      const cmdList = [{ id: 1, note: '' }];
      const ventesList = [{ id: 10 }];
      vi.mocked(fetchCommandes).mockResolvedValue({ success: true, commandes: cmdList });
      vi.mocked(fetchVentesCaisse).mockResolvedValue({ success: true, ventes: ventesList });

      await store.loadAll();

      expect(store.loading).toBe(false);
      expect(store.error).toBe(null);
      expect(store.commandes).toEqual(cmdList);
      expect(store.ventes).toEqual(ventesList);
    });

    it('met à jour error après échec API', async () => {
      const store = useCommandesStore();
      vi.mocked(fetchCommandes).mockRejectedValue(new Error('Réseau indisponible'));

      await store.loadAll();

      expect(store.loading).toBe(false);
      expect(store.error).toBe('Réseau indisponible');
    });

    it('met authRequired à true quand API renvoie AuthRequiredError', async () => {
      const store = useCommandesStore();
      const err = new Error('Session requise');
      err.code = AuthRequiredError;
      vi.mocked(fetchCommandes).mockRejectedValue(err);

      await store.loadAll();

      expect(store.loading).toBe(false);
      expect(store.authRequired).toBe(true);
    });
  });
});
