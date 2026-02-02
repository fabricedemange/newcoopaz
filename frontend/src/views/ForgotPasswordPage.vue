<template>
  <div class="container-fluid px-3 mt-4">
    <div class="row justify-content-center">
      <div class="col-12 col-sm-8 col-md-6 col-lg-4">
        <div class="card">
          <div class="card-header text-center">
            <h2 class="card-title mb-0">Mot de passe oublié</h2>
          </div>
          <div class="card-body">
            <div v-if="message" class="alert alert-success">
              <i class="bi bi-check-circle me-2"></i>{{ message }}
            </div>
            <div v-if="error" class="alert alert-danger">
              <i class="bi bi-exclamation-triangle me-2"></i>{{ error }}
            </div>
            <form v-if="!success" @submit.prevent="submit">
              <input type="hidden" name="_csrf" :value="csrfToken">
              <div class="mb-3">
                <label for="email" class="form-label">Votre adresse e-mail</label>
                <input
                  id="email"
                  v-model="email"
                  type="email"
                  class="form-control"
                  required
                  autocomplete="email"
                >
              </div>
              <div class="d-grid gap-2">
                <button type="submit" class="btn btn-primary" :disabled="loading">
                  <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                  Envoyer le lien de réinitialisation
                </button>
              </div>
            </form>
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
import { ref, computed } from 'vue';

const email = ref('');
const error = ref('');
const message = ref('');
const success = ref(false);
const loading = ref(false);

const csrfToken = computed(() => window.CSRF_TOKEN || '');

async function submit() {
  error.value = '';
  message.value = '';
  loading.value = true;
  try {
    const body = new URLSearchParams({
      email: email.value,
      _csrf: csrfToken.value,
    });
    const res = await fetch('/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: body.toString(),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (data.success) {
      success.value = true;
      message.value = data.message || 'Vérifiez votre messagerie pour changer le mot de passe.';
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
