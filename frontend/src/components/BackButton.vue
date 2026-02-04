<template>
  <a
    href="#"
    class="btn btn-outline-secondary"
    title="Retour à la page précédente"
    aria-label="Retour"
    @click.prevent="goBack"
  >
    <i class="bi bi-arrow-left me-1"></i>Retour
  </a>
</template>

<script setup>
function goBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = '/vue';
  }
}
</script>
