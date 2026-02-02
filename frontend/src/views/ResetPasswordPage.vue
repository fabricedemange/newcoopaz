<template>
  <div class="container-fluid px-3 mt-4">
    <div class="row justify-content-center">
      <div class="col-12 col-sm-8 col-md-6 col-lg-4">
        <div class="card">
          <div class="card-header text-center">
            <h2 class="card-title mb-0">Réinitialisation du mot de passe</h2>
          </div>
          <div class="card-body">
            <div v-if="message" class="alert alert-success">
              <i class="bi bi-check-circle me-2"></i>{{ message }}
            </div>
            <div v-if="error" class="alert alert-danger">
              <i class="bi bi-exclamation-triangle me-2"></i>{{ error }}
            </div>
            <form v-if="token && !success" @submit.prevent="submit">
              <input type="hidden" name="_csrf" :value="csrfToken">
              <input type="hidden" name="token" :value="token">
              <div class="mb-3">
                <label for="password" class="form-label">Nouveau mot de passe</label>
                <input
                  id="password"
                  v-model="password"
                  type="password"
                  class="form-control"
                  required
                  autocomplete="new-password"
                >
              </div>
              <div class="mb-3">
                <label for="confirm" class="form-label">Confirmez le mot de passe</label>
                <input
                  id="confirm"
                  v-model="confirm"
                  type="password"
                  class="form-control"
                  required
                  autocomplete="new-password"
                >
              </div>
              <div class="d-grid gap-2">
                <button type="submit" class="btn btn-primary" :disabled="loading">
                  <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                  Réinitialiser le mot de passe
                </button>
              </div>
            </form>
            <div v-if="!token && !error" class="alert alert-warning">
              Lien invalide ou expiré.
            </div>
          </div>
          <div class="card-footer text-center">
            <a href="/login" class="btn btn-link">Retour à la connexion</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const token = ref('');
const password = ref('');
const confirm = ref('');
const error = ref('');
const message = ref('');
const success = ref(false);
const loading = ref(false);

const csrfToken = computed(() => window.CSRF_TOKEN || '');

onMounted(() => {
  const params = new URLSearchParams(window.location.search);
  token.value = params.get('token') || window.RESET_TOKEN || '';
});

async function submit() {
  error.value = '';
  if (password.value !== confirm.value) {
    error.value = 'Les mots de passe ne correspondent pas.';
    return;
  }
  loading.value = true;
  try {
    const body = new URLSearchParams({
      token: token.value,
      password: password.value,
      confirm: confirm.value,
      _csrf: csrfToken.value,
    });
    const res = await fetch('/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: body.toString(),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      success.value = true;
      message.value = data.message || 'Votre mot de passe est bien réinitialisé.';
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
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
