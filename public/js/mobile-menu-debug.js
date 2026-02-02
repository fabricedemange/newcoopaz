// Script de debug pour le menu mobile
(function() {
  'use strict';

  console.log('🔍 Debug menu mobile - Chargement...');

  // Attendre que le DOM soit chargé
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    console.log('📱 Initialisation debug menu mobile');

    // Vérifier la taille de l'écran
    console.log('📐 Largeur écran:', window.innerWidth);
    console.log('📐 Hauteur écran:', window.innerHeight);
    console.log('🔍 User Agent:', navigator.userAgent);

    // Vérifier si on est sur mobile
    const isMobile = window.innerWidth <= 991;
    console.log('📱 Mode mobile:', isMobile);

    // Chercher le bouton
    const button = document.getElementById('mobileMenuToggle');
    console.log('🔘 Bouton trouvé:', button ? '✅' : '❌');

    if (button) {
      // Vérifier les styles du bouton
      const styles = window.getComputedStyle(button);
      console.log('👁️ Display:', styles.display);
      console.log('👁️ Visibility:', styles.visibility);
      console.log('👁️ Opacity:', styles.opacity);
      console.log('👁️ Z-index:', styles.zIndex);
      console.log('👁️ Position:', styles.position);
      console.log('📍 Bottom:', styles.bottom);
      console.log('📍 Right:', styles.right);
      console.log('📏 Width:', styles.width);
      console.log('📏 Height:', styles.height);

      // Vérifier le rect pour voir si visible
      const rect = button.getBoundingClientRect();
      console.log('📦 Rect:', {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0
      });

      // Forcer l'affichage si caché
      if (isMobile && styles.display === 'none') {
        console.warn('⚠️ Bouton caché sur mobile, tentative de correction...');
        button.style.display = 'flex';
        button.style.visibility = 'visible';
        button.style.opacity = '1';
        button.style.zIndex = '99999';
        console.log('✅ Styles forcés appliqués');
      }

      // Ajouter un gestionnaire de clic avec log
      button.addEventListener('click', function(e) {
        console.log('🖱️ Clic sur le bouton détecté!', e);
        const sidebar = document.getElementById('adminSidebar');
        const overlay = document.getElementById('sidebarOverlay');
        console.log('📂 Sidebar:', sidebar ? '✅' : '❌');
        console.log('🔲 Overlay:', overlay ? '✅' : '❌');
      });

      console.log('✅ Debug menu mobile terminé');
    } else {
      console.error('❌ Bouton mobile-menu-toggle non trouvé dans le DOM!');
      console.log('🔍 Éléments avec "menu" dans id:');
      document.querySelectorAll('[id*="menu"]').forEach(el => {
        console.log('  -', el.id, el.tagName);
      });
    }

    // Vérifier la sidebar
    const sidebar = document.getElementById('adminSidebar');
    console.log('📂 Sidebar trouvée:', sidebar ? '✅' : '❌');

    // Vérifier l'overlay
    const overlay = document.getElementById('sidebarOverlay');
    console.log('🔲 Overlay trouvé:', overlay ? '✅' : '❌');
  }

  // Ajouter un bouton de debug visible temporairement
  window.showMobileMenuDebug = function() {
    const debugInfo = document.createElement('div');
    debugInfo.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: yellow;
      color: black;
      padding: 10px;
      z-index: 999999;
      font-size: 12px;
      border: 2px solid red;
      max-width: 90%;
      overflow: auto;
    `;
    debugInfo.innerHTML = `
      <strong>Debug Menu Mobile</strong><br>
      Largeur: ${window.innerWidth}px<br>
      Bouton: ${document.getElementById('mobileMenuToggle') ? '✅' : '❌'}<br>
      <button onclick="this.parentElement.remove()">Fermer</button>
    `;
    document.body.appendChild(debugInfo);
  };

  console.log('💡 Tapez showMobileMenuDebug() dans la console pour voir les infos');
})();
