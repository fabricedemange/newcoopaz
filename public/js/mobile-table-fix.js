// Fix automatique pour les tableaux sur mobile
(function() {
  'use strict';

  console.log('📱 Mobile Table Fix - Chargement...');
  console.log('📐 Largeur actuelle:', window.innerWidth);

  function applyMobileFixes(force = false) {
    const isMobile = window.innerWidth <= 767;

    console.log('📱 Check mobile:', {
      innerWidth: window.innerWidth,
      isMobile: isMobile,
      force: force
    });

    if (!isMobile && !force) {
      console.log('💻 Mode desktop (largeur > 767px), pas de fix nécessaire');
      console.log('💡 Pour forcer: applyMobileFixes(true)');
      return;
    }

    console.log('📱 Application des fixes mobile...');

    // Fix les conteneurs parents (réduire padding mais laisser overflow visible)
    const adminWrapper = document.querySelector('.admin-content-wrapper');
    if (adminWrapper) {
      adminWrapper.style.paddingLeft = '0.5rem';
      adminWrapper.style.paddingRight = '0.5rem';
      adminWrapper.style.maxWidth = '100vw';
      adminWrapper.style.boxSizing = 'border-box';
      console.log('📦 Admin wrapper optimisé');
    }

    const containerFluid = document.querySelector('.container-fluid');
    if (containerFluid) {
      containerFluid.style.paddingLeft = '0.5rem';
      containerFluid.style.paddingRight = '0.5rem';
      containerFluid.style.maxWidth = '100vw';
      containerFluid.style.boxSizing = 'border-box';
      console.log('📦 Container-fluid optimisé');
    }

    // Trouver tous les tableaux
    const tables = document.querySelectorAll('table');
    console.log(`📊 ${tables.length} tableaux trouvés`);

    tables.forEach((table, index) => {
      // Vérifier si le tableau a déjà un wrapper .table-responsive
      let wrapper = table.closest('.table-responsive');

      if (!wrapper) {
        console.log(`⚠️ Tableau ${index + 1} sans wrapper .table-responsive, création...`);

        // Créer un wrapper
        wrapper = document.createElement('div');
        wrapper.className = 'table-responsive';
        wrapper.style.display = 'block';
        wrapper.style.width = '100%';
        wrapper.style.maxWidth = '100%';
        wrapper.style.overflowX = 'auto';
        wrapper.style.overflowY = 'visible';
        wrapper.style.webkitOverflowScrolling = 'touch';
        wrapper.style.margin = '0';
        wrapper.style.boxSizing = 'border-box';

        // Envelopper le tableau
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);

        console.log(`✅ Wrapper créé pour tableau ${index + 1}`);
      } else {
        console.log(`✅ Tableau ${index + 1} a déjà un wrapper`);

        // Forcer les styles sur le wrapper existant (séparer overflow-x et overflow-y)
        wrapper.style.display = 'block';
        wrapper.style.width = '100%';
        wrapper.style.maxWidth = '100%';
        wrapper.style.overflowX = 'auto';
        wrapper.style.overflowY = 'visible';
        wrapper.style.webkitOverflowScrolling = 'touch';
        wrapper.style.margin = '0';
        wrapper.style.boxSizing = 'border-box';
      }

      // Forcer les styles sur le tableau lui-même
      table.style.cssText = `
        width: max-content !important;
        min-width: 100%;
      `;
    });

    // Réduire les cellules
    const cells = document.querySelectorAll('.table td, .table th');
    console.log(`📏 ${cells.length} cellules trouvées`);

    cells.forEach(cell => {
      cell.style.padding = '0.5rem 0.25rem';
      cell.style.fontSize = '0.875rem';
      cell.style.whiteSpace = 'nowrap';
    });

    console.log('✅ Fixes appliqués!');
  }

  // Appliquer au chargement
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyMobileFixes);
  } else {
    applyMobileFixes();
  }

  // Réappliquer après que Vue a rendu (avec plusieurs délais)
  setTimeout(applyMobileFixes, 500);
  setTimeout(applyMobileFixes, 1000);
  setTimeout(applyMobileFixes, 2000);
  setTimeout(applyMobileFixes, 3000);

  // Observer les changements du DOM (pour Vue qui met à jour dynamiquement)
  if ('MutationObserver' in window) {
    let timeout;
    const observer = new MutationObserver(function(mutations) {
      let hasTableChange = false;

      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length > 0) {
          // Vérifier si un des nouveaux noeuds contient un tableau
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element node
              if (node.tagName === 'TABLE' || node.querySelector && node.querySelector('table')) {
                hasTableChange = true;
                console.log('🔄 Nouveau tableau détecté dans le DOM');
              }
            }
          });
        }
      });

      if (hasTableChange) {
        // Débounce pour éviter trop d'appels
        clearTimeout(timeout);
        timeout = setTimeout(applyMobileFixes, 200);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('👀 Observer activé pour surveiller les changements DOM');
  }

  // Exposer globalement pour debug
  window.applyMobileFixes = applyMobileFixes;
  console.log('💡 Tapez applyMobileFixes() dans la console pour réappliquer les fixes manuellement');
  console.log('💡 Pour forcer sur desktop: applyMobileFixes(true)');
})();
