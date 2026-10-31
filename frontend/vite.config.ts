import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
const backend='http://127.0.0.1:8001';
export default defineConfig({
 plugins:[react()],
 server:{
  host:'127.0.0.1',port:8000,strictPort:true,
  headers:{'Cache-Control':'no-store'},
  proxy:{'/api':backend,'/docs':backend,'/redoc':backend,'/openapi.json':backend},
 },
 test:{environment:'node'},
} as any);
