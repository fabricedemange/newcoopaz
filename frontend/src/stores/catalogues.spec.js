/**
 * Tests unitaires du store catalogues (getters + actions avec API mockée).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useCataloguesStore } from './catalogues';
import { fetchCatalogues, AuthRequiredError } from '@/api';

vi.mock('@/api', () => ({
  fetchCatalogues: vi.fn(),
  AuthRequiredError: Symbol('AuthRequired'),
}));

describe('catalogues store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(fetchCatalogues).mockReset();
  });

  describe('loadAll (action)', () => {
    it('met à jour catalogues et loading/error après succès API', async () => {
      const store = useCataloguesStore();
      const list = [{ id: 1, originalname: 'Cat A', expiration_date: '2025-06-01' }];
      vi.mocked(fetchCatalogues).mockResolvedValue({ success: true, catalogues: list });

      await store.loadAll();

      expect(store.loading).toBe(false);
      expect(store.error).toBe(null);
      expect(store.catalogues).toEqual(list);
    });

    it('met à jour error après échec API', async () => {
      const store = useCataloguesStore();
      vi.mocked(fetchCatalogues).mockResolvedValue({ success: false, error: 'Erreur serveur' });

      await store.loadAll();

      expect(store.loading).toBe(false);
      expect(store.error).toBe('Erreur serveur');
      expect(store.catalogues).toEqual([]);
    });

    it('met authRequired à true quand API renvoie AuthRequiredError', async () => {
      const store = useCataloguesStore();
      const err = new Error('Session requise');
      err.code = AuthRequiredError;
      vi.mocked(fetchCatalogues).mockRejectedValue(err);

      await store.loadAll();

      expect(store.loading).toBe(false);
      expect(store.authRequired).toBe(true);
      expect(store.error).toBe('Session requise');
    });
  });

  describe('sortedCatalogues', () => {
    it('retourne une liste vide quand catalogues est vide', () => {
      const store = useCataloguesStore();
      expect(store.sortedCatalogues).toEqual([]);
    });

    it('trie par expiration_date asc par défaut', () => {
      const store = useCataloguesStore();
      store.$patch({
        catalogues: [
          { id: 1, originalname: 'B', expiration_date: '2025-03-01' },
          { id: 2, originalname: 'A', expiration_date: '2025-01-15' },
          { id: 3, originalname: 'C', expiration_date: '2025-02-10' },
        ],
        sortColumn: 'expiration_date',
        sortDirection: 'asc',
      });
      const sorted = store.sortedCatalogues;
      expect(sorted.map((c) => c.id)).toEqual([2, 3, 1]);
      expect(sorted[0].originalname).toBe('A');
    });

    it('trie par expiration_date desc quand sortDirection est desc', () => {
      const store = useCataloguesStore();
      store.$patch({
        catalogues: [
          { id: 1, originalname: 'B', expiration_date: '2025-03-01' },
          { id: 2, originalname: 'A', expiration_date: '2025-01-15' },
        ],
        sortColumn: 'expiration_date',
        sortDirection: 'desc',
      });
      const sorted = store.sortedCatalogues;
      expect(sorted.map((c) => c.id)).toEqual([1, 2]);
    });

    it('filtre par searchTerm sur originalname', () => {
      const store = useCataloguesStore();
      store.$patch({
        catalogues: [
          { id: 1, originalname: 'Catalogue Fruits', username: 'u1', description: '' },
          { id: 2, originalname: 'Catalogue Legumes', username: 'u2', description: '' },
          { id: 3, originalname: 'Offre Boissons', username: 'u3', description: '' },
        ],
        searchTerm: 'fruits',
      });
      const sorted = store.sortedCatalogues;
      expect(sorted).toHaveLength(1);
      expect(sorted[0].originalname).toBe('Catalogue Fruits');
    });
  });
});
