<template>
  <div class="container">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
      <h2 class="mb-0">{{ isAdd ? 'Ajouter un utilisateur' : 'Éditer un utilisateur' }}</h2>
      <BackButton />
    </div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <form @submit.prevent="submit">
      <input type="hidden" name="_csrf" :value="csrfToken">
      <div class="mb-3">
        <label class="form-label">Nom d'utilisateur</label>
        <input v-model="form.username" type="text" class="form-control" required>
      </div>
      <div class="mb-3">
        <label class="form-label">Email</label>
        <input v-model="form.email" type="email" class="form-control" required>
      </div>
      <div class="form-check form-switch mb-3">
        <input id="email_catalogue" v-model="form.email_catalogue" class="form-check-input" type="checkbox" :true-value="1" :false-value="0">
        <label class="form-check-label" for="email_catalogue">Recevoir les notifications des nouveaux catalogues</label>
      </div>
      <div class="mb-3">
        <label class="form-label">Description</label>
        <input v-model="form.description" type="text" class="form-control">
      </div>
      <div class="mb-3">
        <label class="form-label">Mot de passe {{ isAdd ? '' : '(laisser vide pour ne pas changer)' }}</label>
        <input v-model="form.password" type="password" class="form-control" :required="isAdd">
      </div>

      <div class="mb-3">
        <label class="form-label">Rôles RBAC</label>
        <div class="border rounded p-3" style="max-height: 300px; overflow-y: auto;">
<div v-for="r in allRoles" :key="r.id" class="form-check mb-2">
              <input
                :id="'role_' + r.id"
                v-model="form.rbac_roles"
                type="checkbox"
                class="form-check-input"
                :value="Number(r.id)"
              >
            <label class="form-check-label" :for="'role_' + r.id">
              <strong>{{ r.display_name }}</strong>
              <span v-if="r.name === 'utilisateur'" class="badge bg-secondary ms-1">Par défaut</span>
              <br v-if="r.description">
              <small v-if="r.description" class="text-muted">{{ r.description }}</small>
            </label>
          </div>
          <p v-if="!allRoles.length" class="text-muted mb-0">Aucun rôle disponible</p>
        </div>
      </div>

      <div v-if="organizations && organizations.length" class="mb-3">
        <label for="orgSelect" class="form-label">Organisation</label>
        <select id="orgSelect" v-model="form.organization_id" class="form-select" required>
          <option value="">Sélectionner une organisation</option>
          <option v-for="org in organizations" :key="org.id" :value="org.id">{{ org.name }}</option>
        </select>
      </div>

      <button type="submit" class="btn btn-primary" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
        {{ isAdd ? 'Ajouter' : 'Enregistrer' }}
      </button>
      <a href="/admin/users/vue" class="btn btn-secondary ms-2">Annuler</a>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import BackButton from '@/components/BackButton.vue';

const form = ref({
  username: '',
  email: '',
  description: '',
  email_catalogue: 1,
  password: '',
  rbac_roles: [],
  organization_id: '',
});
const allRoles = ref([]);
const organizations = ref(null);
const action = ref('add');
const userId = ref(null);
const error = ref('');
const loading = ref(false);

const csrfToken = computed(() => window.CSRF_TOKEN || '');
const isAdd = computed(() => action.value === 'add');

onMounted(() => {
  const data = window.INITIAL_DATA || {};
  action.value = data.action || 'add';
  allRoles.value = data.allRoles || [];
  organizations.value = data.organizations || null;
  error.value = data.error || '';

  if (data.user) {
    userId.value = data.user.id;
    form.value.username = data.user.username || '';
    form.value.email = data.user.email || '';
    form.value.description = data.user.description || '';
    form.value.email_catalogue = data.user.email_catalogue ? 1 : 0;
    form.value.organization_id = data.user.organization_id != null ? String(data.user.organization_id) : '';
    form.value.rbac_roles = (data.userRoleIds || []).map(Number);
  } else {
    form.value.email_catalogue = 1;
    const defaultUser = allRoles.value.find(r => r.name === 'utilisateur');
    if (defaultUser && (!data.userRoleIds || data.userRoleIds.length === 0)) {
      form.value.rbac_roles = [Number(defaultUser.id)];
    }
  }
});

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const roleIds = Array.isArray(form.value.rbac_roles)
      ? form.value.rbac_roles.filter(id => id != null && id !== '')
      : [form.value.rbac_roles].filter(Boolean);
    const body = new URLSearchParams({
      username: form.value.username,
      email: form.value.email,
      description: form.value.description || '',
      email_catalogue: form.value.email_catalogue ? '1' : '0',
      password: form.value.password,
      _csrf: csrfToken.value,
    });
    roleIds.forEach(id => body.append('rbac_roles[]', id));
    if (form.value.organization_id) body.append('organization_id', form.value.organization_id);

    const url = isAdd.value ? '/admin/users/new' : `/admin/users/${userId.value}/edit`;
    const res = await fetch(url, {
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
