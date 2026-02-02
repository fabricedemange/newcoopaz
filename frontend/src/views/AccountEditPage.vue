<template>
  <div class="container">
    <h2>Mon compte</h2>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>
    <form @submit.prevent="submit">
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
      <h4>Changer de mot de passe</h4>
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
      <button type="submit" class="btn btn-primary" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
        Enregistrer
      </button>
      <a href="/vue" class="btn btn-secondary ms-2">Annuler</a>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

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
