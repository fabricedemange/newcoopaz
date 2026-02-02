import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  root: __dirname,
  // En dev : base '/' pour que http://localhost:3200/ affiche la page
  // En build : base '/dist/' pour que Express serve les assets sous /dist/
  base: mode === 'production' ? '/dist/' : '/',
  build: {
    outDir: path.resolve(__dirname, '../public/dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'auth-login': path.resolve(__dirname, 'src/entries/auth-login.js'),
        'auth-forgot-password': path.resolve(__dirname, 'src/entries/auth-forgot-password.js'),
        'auth-register': path.resolve(__dirname, 'src/entries/auth-register.js'),
        'auth-reset-password': path.resolve(__dirname, 'src/entries/auth-reset-password.js'),
        'auth-account': path.resolve(__dirname, 'src/entries/auth-account.js'),
        home: path.resolve(__dirname, 'src/entries/home.js'),
        'admin-dashboard': path.resolve(__dirname, 'src/entries/admin-dashboard.js'),
        commandes: path.resolve(__dirname, 'src/entries/commandes.js'),
        catalogues: path.resolve(__dirname, 'src/entries/catalogues.js'),
        paniers: path.resolve(__dirname, 'src/entries/paniers.js'),
        'commande-detail': path.resolve(__dirname, 'src/entries/commande-detail.js'),
        'catalogue-detail': path.resolve(__dirname, 'src/entries/catalogue-detail.js'),
        'panier-detail': path.resolve(__dirname, 'src/entries/panier-detail.js'),
        'caisse-historique': path.resolve(__dirname, 'src/entries/caisse-historique.js'),
        caisse: path.resolve(__dirname, 'src/entries/caisse.js'),
        'admin-trace': path.resolve(__dirname, 'src/entries/admin-trace.js'),
        'admin-bandeaux': path.resolve(__dirname, 'src/entries/admin-bandeaux.js'),
        'admin-organizations': path.resolve(__dirname, 'src/entries/admin-organizations.js'),
        'admin-email-queue': path.resolve(__dirname, 'src/entries/admin-email-queue.js'),
        'admin-user-roles': path.resolve(__dirname, 'src/entries/admin-user-roles.js'),
        'admin-stats': path.resolve(__dirname, 'src/entries/admin-stats.js'),
        'admin-categories': path.resolve(__dirname, 'src/entries/admin-categories.js'),
        'admin-roles': path.resolve(__dirname, 'src/entries/admin-roles.js'),
        'admin-suppliers': path.resolve(__dirname, 'src/entries/admin-suppliers.js'),
        'admin-users': path.resolve(__dirname, 'src/entries/admin-users.js'),
        'admin-products': path.resolve(__dirname, 'src/entries/admin-products.js'),
        'admin-catalogues': path.resolve(__dirname, 'src/entries/admin-catalogues.js'),
        'admin-catalogue-synthese': path.resolve(__dirname, 'src/entries/admin-catalogue-synthese.js'),
        'admin-catalogue-synthese-detaillee': path.resolve(__dirname, 'src/entries/admin-catalogue-synthese-detaillee.js'),
        'admin-user-form': path.resolve(__dirname, 'src/entries/admin-user-form.js'),
        'admin-category-form': path.resolve(__dirname, 'src/entries/admin-category-form.js'),
        'admin-supplier-form': path.resolve(__dirname, 'src/entries/admin-supplier-form.js'),
        'admin-supplier-detail': path.resolve(__dirname, 'src/entries/admin-supplier-detail.js'),
        'admin-product-form': path.resolve(__dirname, 'src/entries/admin-product-form.js'),
        'admin-product-detail': path.resolve(__dirname, 'src/entries/admin-product-detail.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 3200,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/article': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
      '/catalogues': { target: 'http://localhost:3000', changeOrigin: true },
      '/panier': { target: 'http://localhost:3000', changeOrigin: true },
      '/commandes': { target: 'http://localhost:3000', changeOrigin: true },
      '/caisse': { target: 'http://localhost:3000', changeOrigin: true },
      '/admin': { target: 'http://localhost:3000', changeOrigin: true },
      '/login': { target: 'http://localhost:3000', changeOrigin: true },
      '/logout': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
