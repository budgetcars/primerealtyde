// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  /** Canonical-/OG-Basis nach Deployment; eigene Domain in Firebase Hosting anbindbar */
  site: 'https://ai711-be7f7.web.app',

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [react()]
});