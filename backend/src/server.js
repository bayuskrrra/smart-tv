import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import config from './config/index.js';
import { initScheduler } from './services/scheduler.service.js';
import { startWhatsAppBot, getLatestQR } from './services/whatsapp.service.js';

// Route Imports
import authRoutes from './routes/auth.routes.js';
import assetRoutes from './routes/asset.routes.js';
import loanRoutes from './routes/loan.routes.js';
import handoverRoutes from './routes/handover.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import reportRoutes from './routes/report.routes.js';
import userRoutes from './routes/user.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload directory exists and serve files statically
const uploadsPath = path.resolve(config.uploadDir);
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/handover', handoverRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);

// Root Endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Smart TV Lending API' });
});

// WhatsApp Bot QR Code Endpoint
app.get('/api/whatsapp/qr', (req, res) => {
  const { dataUrl } = getLatestQR();
  if (!dataUrl) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>WhatsApp Bot Status</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px 20px; background: #f8fafc; color: #1e293b; }
          .card { background: white; max-width: 480px; margin: 0 auto; padding: 36px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
          .icon { font-size: 48px; margin-bottom: 12px; }
          h2 { margin: 0 0 8px; color: #0f172a; }
          p { color: #64748b; line-height: 1.6; }
          .btn { display: inline-block; margin-top: 18px; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; }
        </style>
        <meta http-equiv="refresh" content="5">
      </head>
      <body>
        <div class="card">
          <div class="icon">⏳</div>
          <h2>Menunggu QR Code atau Bot Sudah Terhubung</h2>
          <p>Jika baru restart server, tunggu beberapa detik. Halaman ini akan me-refresh secara otomatis.</p>
          <p>Jika bot sudah berhasil terhubung (status open), QR code tidak perlu di-scan lagi.</p>
          <a href="/api/whatsapp/qr" class="btn">Refresh Manual</a>
        </div>
      </body>
      </html>
    `);
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Scan WhatsApp Bot QR Code</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px 16px; background: #0f172a; color: #f8fafc; }
        .card { background: #1e293b; max-width: 420px; margin: 0 auto; padding: 32px 24px; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); border: 1px solid #334155; }
        .badge { display: inline-block; padding: 6px 14px; background: #16a34a22; color: #4ade80; border-radius: 999px; font-size: 13px; font-weight: 600; margin-bottom: 16px; border: 1px solid #16a34a44; }
        h2 { margin: 0 0 8px; font-size: 22px; }
        p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
        .qr-box { background: white; padding: 16px; border-radius: 16px; display: inline-block; margin-bottom: 20px; box-shadow: 0 8px 16px rgba(0,0,0,0.2); }
        .qr-box img { width: 280px; height: 280px; display: block; }
        .steps { text-align: left; background: #0f172a88; padding: 14px 18px; border-radius: 12px; font-size: 13px; color: #cbd5e1; line-height: 1.7; border: 1px solid #334155; }
        .steps ol { margin: 0; padding-left: 20px; }
      </style>
      <meta http-equiv="refresh" content="15">
    </head>
    <body>
      <div class="card">
        <span class="badge">WhatsApp Multi-Device Pairing</span>
        <h2>Scan QR Code Bot</h2>
        <p>Gunakan nomor WhatsApp khusus yang ingin Anda jadikan Bot sistem peminjaman Smart TV.</p>
        <div class="qr-box">
          <img src="${dataUrl}" alt="WhatsApp QR Code" />
        </div>
        <div class="steps">
          <strong>Cara Scan:</strong>
          <ol>
            <li>Buka WhatsApp di HP nomor bot</li>
            <li>Ketuk <b>Menu (⋮)</b> atau <b>Pengaturan</b></li>
            <li>Pilih <b>Perangkat Tertaut</b></li>
            <li>Ketuk <b>Tautkan Perangkat</b> lalu scan QR ini</li>
          </ol>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error stack:', err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    details: err.details || null
  });
});

// Initialize Cron Jobs
initScheduler();

// Initialize WhatsApp Bot
startWhatsAppBot();

// Start Server
app.listen(config.port, () => {
  console.log(`🚀 Server running on port ${config.port}`);
  console.log(`📂 Uploads served from: ${uploadsPath}`);
});
