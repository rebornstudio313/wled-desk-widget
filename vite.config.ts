import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('./apps/desktop',import.meta.url)),server:{host:'127.0.0.1',port:1420,strictPort:true,proxy:{'/api':'http://127.0.0.1:1421'}},build:{outDir:fileURLToPath(new URL('./dist',import.meta.url)),emptyOutDir:true}});
