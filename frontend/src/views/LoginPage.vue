<template>
  <div class="container-fluid px-3 mt-4">
    <div class="row justify-content-center">
      <div class="col-12 col-sm-8 col-md-6 col-lg-4">
        <div class="card">
          <div class="card-header text-center">
            <h2 class="card-title mb-0">Connexion</h2>
          </div>
          <div class="card-body">
            <div v-if="error" class="alert alert-danger" role="alert">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>
              {{ error }}
            </div>

            <form @submit.prevent="submit">
              <input type="hidden" name="_csrf" :value="csrfToken">
              <div class="mb-3">
                <label for="email" class="form-label">Email de l'utilisateur</label>
                <input
                  id="email"
                  v-model="email"
                  type="text"
                  class="form-control"
                  required
                  autofocus
                  placeholder="Votre email"
                >
              </div>
              <div class="mb-3">
                <label for="password" class="form-label">Mot de passe</label>
                <input
                  id="password"
                  v-model="password"
                  type="password"
                  class="form-control"
                  required
                  placeholder="Votre mot de passe"
                >
              </div>
              <div class="d-grid gap-2">
                <button type="submit" class="btn btn-primary" :disabled="loading">
                  <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                  Se connecter
                </button>
              </div>
            </form>
          </div>
          <div class="card-footer text-center">
            <a href="/forgot-password" class="btn btn-link">Mot de passe oublié ?</a>
          </div>
        </div>
      </div>
    </div>
    <div class="row justify-content-center mt-4">
      <div class="col-12 col-sm-8 col-md-6 col-lg-4">
        <div class="card">
          <div class="card-header">
            <h5 class="card-title mb-0">Aide</h5>
          </div>
          <div class="card-body">
            <h6>Problème de connexion ?</h6>
            <p class="text-muted">
              Vérifiez votre nom d'utilisateur et mot de passe. Si vous avez oublié votre mot de passe,
              utilisez le lien "Mot de passe oublié ?".
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const csrfToken = computed(() => window.CSRF_TOKEN || '');

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const body = new URLSearchParams({
      email: email.value,
      password: password.value,
      _csrf: csrfToken.value,
    });
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: body.toString(),
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (data.success && data.redirect) {
      window.location.href = data.redirect;
      return;
    }
    error.value = data.error || 'Identifiants incorrects. Veuillez réessayer.';
  } catch (e) {
    error.value = 'Erreur de connexion. Veuillez réessayer.';
  } finally {
    loading.value = false;
  }
}
</script>
