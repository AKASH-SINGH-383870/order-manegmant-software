import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/server/routes.ts';
import { seedDatabase } from './src/server/seed.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  
  // AI Studio environment constraint: Dev and app server must run on port 3000
  // Note: In Cloud Run, PORT=8080 is used by Nginx reverse proxy which forwards to localhost:3000.
  // The Node server must listen on port 3000 unless a non-8080 port or CLI argument is explicitly given.
  const portArg = process.argv.find(arg => arg.startsWith('--port='));
  const portArgIndex = process.argv.indexOf('--port');
  let cliPort: number | null = null;
  if (portArg) {
    cliPort = parseInt(portArg.split('=')[1], 10);
  } else if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    cliPort = parseInt(process.argv[portArgIndex + 1], 10);
  }
  const envPort = process.env.PORT && process.env.PORT !== '8080' ? parseInt(process.env.PORT, 10) : null;
  const PORT = cliPort || envPort || 3000;

  // Initialize and seed database if not already seeded
  try {
    seedDatabase(false);
  } catch (err) {
    console.error('Database initialization/seed error:', err);
  }

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));
  app.use(cookieParser());

  // Mount API router
  app.use('/api', apiRouter);

  // In production with built dist files serve static, otherwise hook Vite dev middleware
  const distHtmlPath = path.resolve(__dirname, 'dist', 'index.html');
  const isProduction = (process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE || process.env.NODE_ENV !== 'development') && fs.existsSync(distHtmlPath);

  if (isProduction) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(distHtmlPath);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PetroFlow Lubricant ERP Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
