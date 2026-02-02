// Forcer le reload si la page est restaurée depuis le cache (desktop & mobile)
window.addEventListener('pageshow', function(event) {
  if (event.persisted) {
      console.log("back");
    window.location.reload();
  }
});

// Safari mobile peut ne pas déclencher 'pageshow' avec persisted
//window.addEventListener('popstate', function(event) {
  // Petite astuce : popstate est appelé lors d'un retour arrière
  // On vérifie si c'est l'événement attendu et on force le reload
 // window.location.reload();
});