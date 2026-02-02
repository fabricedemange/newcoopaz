<template>
  <div class="container mt-5">
    <div class="row justify-content-center">
      <div class="col-md-6">
        <h2>Inscription</h2>
        <div class="alert alert-warning">
          <strong>⚠️ ATTENTION :</strong> Votre inscription ne sera définitive qu'une fois validée par un administrateur !
        </div>
        <div v-if="error" class="alert alert-danger">{{ error }}</div>
        <form @submit.prevent="submit">
          <input type="hidden" name="_csrf" :value="csrfToken">
          <div class="mb-3">
            <label for="username" class="form-label">Nom d'utilisateur</label>
            <input
              id="username"
              v-model="username"
              type="text"
              class="form-control"
              required
              autofocus
            >
          </div>
          <div class="mb-3">
            <label for="email" class="form-label">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              class="form-control"
              required
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
            >
          </div>
          <div class="d-grid gap-2">
            <button type="submit" class="btn btn-success" :disabled="loading">
              <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
              S'inscrire
            </button>
            <a href="/login" class="btn btn-link">Déjà inscrit ? Se connecter</a>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const username = ref('');
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
      username: username.value,
      email: email.value,
      password: password.value,
      _csrf: csrfToken.value,
    });
    const res = await fetch('/register', {
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
    error.value = data.error || 'Une erreur est survenue.';
  } catch (e) {
    error.value = 'Erreur de connexion. Veuillez réessayer.';
  } finally {
    loading.value = false;
  }
}
</script>
