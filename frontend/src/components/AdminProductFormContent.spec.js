/**
 * Tests du composant AdminProductFormContent (Phase 3).
 * Rendu, champs obligatoires, émission cancel.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import AdminProductFormContent from './AdminProductFormContent.vue';

describe('AdminProductFormContent', () => {
  const defaultProps = {
    categories: [
      { id: 1, nom: 'Fruits' },
      { id: 2, nom: 'Légumes' },
    ],
    suppliers: [
      { id: 10, nom: 'Fournisseur A' },
    ],
    modal: true,
    csrfToken: 'test-csrf',
  };

  beforeEach(() => {
    if (typeof window !== 'undefined') window.CSRF_TOKEN = 'test-csrf';
  });

  it('affiche le formulaire avec les champs principaux', () => {
    const wrapper = mount(AdminProductFormContent, {
      props: defaultProps,
    });
    expect(wrapper.find('input#nom').exists()).toBe(true);
    expect(wrapper.find('label[for="nom"]').text()).toMatch(/Nom du produit/);
    expect(wrapper.find('select#category_id').exists()).toBe(true);
    expect(wrapper.find('select#unite').exists()).toBe(true);
    expect(wrapper.find('input#quantite_min').exists()).toBe(true);
  });

  it('affiche les options catégories et fournisseurs', () => {
    const wrapper = mount(AdminProductFormContent, {
      props: defaultProps,
    });
    const catOptions = wrapper.findAll('select#category_id option');
    expect(catOptions).toHaveLength(3); // placeholder + 2 cat
    expect(catOptions[1].text()).toBe('Fruits');
    expect(catOptions[2].text()).toBe('Légumes');
    const supOptions = wrapper.findAll('select#supplier_id option');
    expect(supOptions.length).toBeGreaterThanOrEqual(2); // placeholder + 1 sup
  });

  it('émet cancel au clic sur Annuler en mode modal', async () => {
    const wrapper = mount(AdminProductFormContent, {
      props: { ...defaultProps, modal: true },
    });
    const cancelBtn = wrapper.find('button.btn-outline-secondary');
    expect(cancelBtn.exists()).toBe(true);
    await cancelBtn.trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('bouton submit présent avec libellé Créer le produit en mode création', () => {
    const wrapper = mount(AdminProductFormContent, {
      props: { ...defaultProps, product: null, productId: null },
    });
    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.exists()).toBe(true);
    expect(submitBtn.text()).toMatch(/Créer le produit/);
  });

  it('bouton submit avec libellé Enregistrer en mode édition', () => {
    const wrapper = mount(AdminProductFormContent, {
      props: {
        ...defaultProps,
        productId: 42,
        product: { id: 42, nom: 'Produit test', category_id: 1, unite: 'Pièce', quantite_min: 1, is_active: 1 },
      },
    });
    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.text()).toMatch(/Enregistrer/);
  });
});
