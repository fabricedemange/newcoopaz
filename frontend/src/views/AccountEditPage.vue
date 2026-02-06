<template>
  <div class="container">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
      <h2 class="mb-0">Mon compte</h2>
      <BackButton />
    </div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>

    <!-- Carte 1 : Mon compte - ouvre une modal pour accéder aux données -->
    <div class="card mb-4">
      <div class="card-header">
        <h5 class="mb-0"><i class="bi bi-person-circle me-2"></i>Mon compte</h5>
      </div>
      <div class="card-body">
        <p class="text-muted mb-3">{{ account.username || '—' }} · {{ account.email || '—' }}</p>
        <button
          type="button"
          class="btn btn-primary"
          data-bs-toggle="modal"
          data-bs-target="#accountModal"
        >
          <i class="bi bi-pencil-square me-2"></i>Accéder aux données de mon compte
        </button>
      </div>
    </div>

    <!-- Carte 2 : Déconnexion -->
    <div class="card mb-4">
      <div class="card-header">
        <h5 class="mb-0"><i class="bi bi-box-arrow-right me-2"></i>Déconnexion</h5>
      </div>
      <div class="card-body">
        <a href="/logout" class="btn btn-outline-danger">
          <i class="bi bi-box-arrow-right me-2"></i>Déconnexion
        </a>
      </div>
    </div>

    <!-- Modal : formulaire complet du compte -->
    <div
      id="accountModal"
      class="modal fade"
      tabindex="-1"
      aria-labelledby="accountModalLabel"
      aria-hidden="true"
    >
      <div class="modal-dialog modal-dialog-scrollable modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="accountModalLabel">
              <i class="bi bi-person-circle me-2"></i>Données de mon compte
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fermer"></button>
          </div>
          <div class="modal-body">
            <form id="accountForm" @submit.prevent="submit">
              <input type="hidden" name="_csrf" :value="csrfToken">
              <div class="mb-3">
                <label for="username" class="form-label">Nom d'utilisateur</label>
                <input
                  id="username"
                  v-model="account.username"
                  type="text"
                  class="form-control"
                  disabled
                >
              </div>
              <div class="mb-3">
                <label for="email" class="form-label">Email</label>
                <input
                  id="email"
                  v-model="account.email"
                  type="email"
                  class="form-control"
                  required
                >
              </div>
              <input type="hidden" name="email_catalogue" :value="account.email_catalogue ? '1' : '0'">
              <div class="form-check form-switch mb-4">
                <input
                  id="email_catalogue"
                  v-model="account.email_catalogue"
                  class="form-check-input"
                  type="checkbox"
                  :true-value="1"
                  :false-value="0"
                >
                <label class="form-check-label" for="email_catalogue">
                  Recevoir les notifications des nouveaux catalogues
                </label>
                <div class="form-text">
                  En cochant cette case, vous serez informé par email dès qu'un catalogue est publié.
                </div>
              </div>

              <hr>
              <h6 class="mb-3">Changer de mot de passe</h6>
              <div class="mb-3">
                <label for="current_password" class="form-label">Mot de passe actuel</label>
                <input
                  id="current_password"
                  v-model="currentPassword"
                  type="password"
                  class="form-control"
                  autocomplete="current-password"
                >
              </div>
              <div class="mb-3">
                <label for="new_password" class="form-label">Nouveau mot de passe</label>
                <input
                  id="new_password"
                  v-model="newPassword"
                  type="password"
                  class="form-control"
                  autocomplete="new-password"
                >
              </div>
              <div class="mb-3">
                <label for="confirm_password" class="form-label">Confirmer le nouveau mot de passe</label>
                <input
                  id="confirm_password"
                  v-model="confirmPassword"
                  type="password"
                  class="form-control"
                  autocomplete="new-password"
                >
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
            <button type="submit" form="accountForm" class="btn btn-primary" :disabled="loading">
              <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import BackButton from '@/components/BackButton.vue';

const account = ref({
  username: '',
  email: '',
  description: '',
  email_catalogue: 0,
});
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const error = ref('');
const success = ref('');
const loading = ref(false);

const csrfToken = computed(() => window.CSRF_TOKEN || '');

onMounted(() => {
  const data = window.ACCOUNT_DATA;
  if (data) {
    account.value = {
      username: data.username || '',
      email: data.email || '',
      description: data.description || '',
      email_catalogue: data.email_catalogue ? 1 : 0,
    };
  }
});

async function submit() {
  error.value = '';
  success.value = '';
  if (newPassword.value || confirmPassword.value) {
    if (newPassword.value !== confirmPassword.value) {
      error.value = 'Les mots de passe ne correspondent pas.';
      return;
    }
    if (!currentPassword.value) {
      error.value = 'Indiquez le mot de passe actuel pour en changer.';
      return;
    }
  }
  loading.value = true;
  try {
    const body = new URLSearchParams({
      email: account.value.email,
      description: account.value.description || '',
      email_catalogue: account.value.email_catalogue ? '1' : '0',
      current_password: currentPassword.value,
      new_password: newPassword.value,
      confirm_password: confirmPassword.value,
      _csrf: csrfToken.value,
    });
    const res = await fetch('/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: body.toString(),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      success.value = data.message || 'Compte mis à jour.';
      currentPassword.value = '';
      newPassword.value = '';
      confirmPassword.value = '';
      const modalEl = document.getElementById('accountModal');
      if (modalEl) {
        const modal = window.bootstrap?.Modal?.getInstance(modalEl);
        if (modal) modal.hide();
      }
    } else {
      error.value = data.error || 'Une erreur est survenue.';
    }
  } catch (e) {
    error.value = 'Erreur de connexion. Veuillez réessayer.';
  } finally {
    loading.value = false;
  }
}
</script>
