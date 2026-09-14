import { makeWASocket, useMultiFileAuthState, DisconnectReason, delay } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import config from '../config/index.js';

const prisma = new PrismaClient();

// In-memory conversation state for interactive WA borrowing wizard
const waUserStates = new Map();

// Track pending loan notifications for admin approve/reject in WA Group
const pendingAdminNotifs = new Map();

// Global socket reference
let sock = null;

// Latest QR code storage for web viewing
let currentQR = null;
let currentQRDataUrl = null;

export function getLatestQR() {
  return { qr: currentQR, dataUrl: currentQRDataUrl };
}

const PURPOSES = [
  'Rapat Internal',
  'Presentasi Client',
  'Training & Workshop',
  'Event Perusahaan',
];

const logger = pino({ level: 'silent' });

// ============================================================
// Connection & Socket Management
// ============================================================

/**
 * Start WhatsApp Bot using Baileys
 */
export async function startWhatsAppBot() {
  if (!config.whatsappEnabled) {
    console.log('[WhatsApp] Bot disabled. Set WHATSAPP_ENABLED=true to enable.');
    return;
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState('./wa-auth-state');

    sock = makeWASocket({
      auth: state,
      logger,
      printQRInTerminal: true,
      browser: ['SmartTV Lending Bot', 'Chrome', '22.0'],
    });

    // Save credentials on update
    sock.ev.on('creds.update', saveCreds);

    // Handle connection updates
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQR = qr;
        QRCode.toString(qr, { type: 'terminal', small: true }, (err, str) => {
          if (!err) {
            console.log('\n=================== WHATSAPP QR CODE ===================');
            console.log(str);
            console.log('========================================================');
            console.log('[WhatsApp] 📱 Scan QR Code di atas dengan WhatsApp di HP nomor bot!');
            console.log('[WhatsApp] 🌐 Atau buka di browser: http://localhost:5000/api/whatsapp/qr\n');
          }
        });

        QRCode.toDataURL(qr, (err, url) => {
          if (!err) currentQRDataUrl = url;
        });
      }

      if (connection === 'close') {
        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

        console.log(
          '[WhatsApp] Connection closed.',
          shouldReconnect ? 'Reconnecting...' : 'Logged out. Delete wa-auth-state/ and restart.'
        );

        if (shouldReconnect) {
          setTimeout(() => startWhatsAppBot(), 5000);
        }
      } else if (connection === 'open') {
        currentQR = null;
        currentQRDataUrl = null;
        console.log('[WhatsApp] ✅ Bot connected successfully!');

        const adminGroupId = getAdminGroupId();
        if (adminGroupId) {
          console.log(`[WhatsApp] 📢 Admin Group: ${adminGroupId}`);
          setTimeout(async () => {
            await resendPendingNotifications();
          }, 3000);
        } else {
          console.log('[WhatsApp] ⚠️  WHATSAPP_ADMIN_GROUP_ID not set. Use /groupinfo command in a group to get the ID.');
        }
      }
    });

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        try {
          // Skip own messages and status updates
          if (msg.key.fromMe) continue;
          if (msg.key.remoteJid === 'status@broadcast') continue;

          await handleIncomingMessage(msg);
        } catch (err) {
          console.error('[WhatsApp] Error handling message:', err.message);
        }
      }
    });
  } catch (error) {
    console.error('[WhatsApp] Failed to start bot:', error.message);
    setTimeout(() => startWhatsAppBot(), 10000);
  }
}

// ============================================================
// Message Sending Utilities
// ============================================================

/**
 * Send a text message to a specific JID
 */
async function sendMessageToJid(jid, text) {
  if (!sock) {
    console.log('[WhatsApp] Socket not connected. Skipping message.');
    return null;
  }

  try {
    const result = await sock.sendMessage(jid, { text });
    return result;
  } catch (error) {
    console.error('[WhatsApp] Error sending message:', error.message);
    return null;
  }
}

let runtimeAdminGroupId = null;

/**
 * Dynamically get Admin Group ID from memory, .env file, or config
 */
export function getAdminGroupId() {
  if (runtimeAdminGroupId) return runtimeAdminGroupId;

  // Try reading from .env file directly so no server restart is needed!
  try {
    const envPath = path.resolve('.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/WHATSAPP_ADMIN_GROUP_ID\s*=\s*["']?([^\s"'\r\n]+)["']?/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch (err) {
    // fallback
  }

  return process.env.WHATSAPP_ADMIN_GROUP_ID || config.whatsappAdminGroupId || '';
}

/**
 * Send a message to Admin Group
 */
async function sendMessageToAdmin(text) {
  const adminGroupId = getAdminGroupId();
  if (!adminGroupId) {
    console.log('[WhatsApp] Admin group ID not configured. Skipping admin message.');
    return null;
  }
  return sendMessageToJid(adminGroupId, text);
}

/**
 * Resend notifications for any pending loans that need admin approval
 */
export async function resendPendingNotifications() {
  try {
    const adminGroupId = getAdminGroupId();
    if (!adminGroupId) return;

    const pendingLoans = await prisma.loan.findMany({
      where: { status: 'PENDING' },
      include: { asset: true, user: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    for (const loan of pendingLoans) {
      const isAlreadyTracked = Array.from(pendingAdminNotifs.values()).some((p) => p.loanId === loan.id);
      if (!isAlreadyTracked) {
        console.log(`[WhatsApp] 📢 Sending notification for pending loan ${loan.id} to admin group`);
        await sendLoanNotificationWA(
          loan,
          loan.user.nama,
          loan.asset.namaTv,
          loan.keperluan,
          loan.departemen,
          loan.tglPinjam,
          loan.tglKembaliRencana,
          loan.user.noHp
        );
      }
    }
  } catch (err) {
    console.error('[WhatsApp] Error resending pending notifications:', err.message);
  }
}

/**
 * Send loan notification to WhatsApp Admin Group
 */
export async function sendLoanNotificationWA(loan, userName, assetName, keperluan, departemen, tglPinjam, tglKembali, userPhone) {
  let phone = userPhone || loan.user?.noHp;
  if (!phone && loan.userId) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: loan.userId },
        select: { noHp: true, whatsappJid: true },
      });
      if (u) {
        phone = u.noHp || (u.whatsappJid ? resolvePhoneNumber(u.whatsappJid) : null);
      }
    } catch (e) {
      // ignore
    }
  }

  const phoneDisplay = phone || '-';

  const message =
    `📺 *PENGAJUAN PEMINJAMAN SMART TV BARU*\n\n` +
    `👤 *Peminjam:* ${userName}\n` +
    `📱 *No. HP:* ${phoneDisplay}\n` +
    `🏢 *Departemen:* ${departemen}\n` +
    `📺 *Unit TV:* ${assetName}\n` +
    `📋 *Keperluan:* ${keperluan}\n` +
    `📅 *Mulai:* ${new Date(tglPinjam).toLocaleString('id-ID')}\n` +
    `📅 *Kembali:* ${new Date(tglKembali).toLocaleString('id-ID')}\n\n` +
    `🔔 _Balas pesan ini dengan:_\n` +
    `✅ *1* = Approve\n` +
    `❌ *2* = Reject`;

  const result = await sendMessageToAdmin(message);

  if (result && result.key) {
    pendingAdminNotifs.set(result.key.id, {
      loanId: loan.id,
      type: 'loan',
    });
  }

  return result;
}

/**
 * Send extension notification to WhatsApp Admin Group
 */
export async function sendExtensionNotificationWA(extension, userName, assetName, tglKembaliLama, tglKembaliBaru, userPhone) {
  let phone = userPhone || extension.user?.noHp;
  if (!phone && extension.userId) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: extension.userId },
        select: { noHp: true, whatsappJid: true },
      });
      if (u) {
        phone = u.noHp || (u.whatsappJid ? resolvePhoneNumber(u.whatsappJid) : null);
      }
    } catch (e) {
      // ignore
    }
  }

  const phoneDisplay = phone || '-';

  const message =
    `🔄 *PENGAJUAN PERPANJANGAN PEMINJAMAN*\n\n` +
    `👤 *Peminjam:* ${userName}\n` +
    `📱 *No. HP:* ${phoneDisplay}\n` +
    `📺 *Unit TV:* ${assetName}\n` +
    `📅 *Kembali Lama:* ${new Date(tglKembaliLama).toLocaleString('id-ID')}\n` +
    `📅 *Kembali Baru:* ${new Date(tglKembaliBaru).toLocaleString('id-ID')}\n\n` +
    `🔔 _Balas pesan ini dengan:_\n` +
    `✅ *1* = Approve\n` +
    `❌ *2* = Reject`;

  const result = await sendMessageToAdmin(message);

  if (result && result.key) {
    pendingAdminNotifs.set(result.key.id, {
      loanId: extension.id,
      type: 'extension',
    });
  }

  return result;
}

/**
 * Send loan approval/rejection status update to WhatsApp Admin Group (e.g. from Web Dashboard)
 */
export async function sendLoanStatusUpdateToAdminGroup(loan, status, adminName) {
  const isApproved = status === 'APPROVED' || status === 'ONGOING';
  const icon = isApproved ? '✅' : '❌';
  const statusLabel = isApproved ? 'DISETUJUI' : 'DITOLAK';

  let phone = loan.user?.noHp;
  if (!phone && loan.userId) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: loan.userId },
        select: { noHp: true, whatsappJid: true },
      });
      if (u) {
        phone = u.noHp || (u.whatsappJid ? resolvePhoneNumber(u.whatsappJid) : null);
      }
    } catch (e) {
      // ignore
    }
  }

  const phoneDisplay = phone || '-';

  const message =
    `${icon} *PEMINJAMAN ${statusLabel}*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📺 *Unit TV:* ${loan.asset?.namaTv || '-'}\n` +
    `👤 *Peminjam:* ${loan.user?.nama || '-'}\n` +
    `📱 *No. HP:* ${phoneDisplay}\n` +
    `🏢 *Departemen:* ${loan.user?.departemen || loan.departemen || '-'}\n` +
    `👮 *Diproses oleh:* ${adminName || 'Admin'}\n` +
    (loan.catatanAdmin ? `📝 *Catatan:* ${loan.catatanAdmin}\n` : '') +
    `\n_Status telah diperbarui di sistem._`;

  return sendMessageToAdmin(message);
}

/**
 * Send notification to borrower via WhatsApp (if whatsappJid is linked)
 */
export async function notifyBorrowerWA(userId, text) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && user.whatsappJid) {
      return sendMessageToJid(user.whatsappJid, text);
    }
  } catch (err) {
    console.error('[WhatsApp] Error notifying borrower:', err.message);
  }
  return null;
}

// ============================================================
// Incoming Message Handler (Router)
// ============================================================

/**
 * Get text content from a message
 */
function getMessageText(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    ''
  ).trim();
}

/**
 * Check if message is from a group
 */
function isGroupMessage(msg) {
  return msg.key.remoteJid?.endsWith('@g.us');
}

/**
 * Get quoted message ID (when someone replies to a message)
 */
function getQuotedMessageId(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.stanzaId || null;
}

/**
 * Handle all incoming messages
 */
async function handleIncomingMessage(msg) {
  const jid = msg.key.remoteJid;
  const text = getMessageText(msg);
  const isContact = Boolean(msg.message?.contactMessage || msg.message?.contactsArrayMessage);

  if (!text && !isContact) return;

  // Handle group messages (admin approve/reject)
  if (isGroupMessage(msg)) {
    if (text) await handleGroupMessage(msg, jid, text);
    return;
  }

  // Handle private messages (user commands, contact card, wizard)
  const pushName = msg.pushName || '';

  if (isContact) {
    await handleContactCardMessage(msg, jid, pushName);
    return;
  }

  await handlePrivateMessage(msg, jid, text, pushName);
}

// ============================================================
// Group Message Handler (Admin Approve/Reject)
// ============================================================

async function handleGroupMessage(msg, groupJid, text) {
  const lowerText = text.toLowerCase().trim();

  // Command: groupinfo — set & show group JID for configuration
  if (lowerText === 'groupinfo' || lowerText === '/groupinfo' || lowerText === 'setadmin') {
    runtimeAdminGroupId = groupJid;
    try {
      const envPath = path.resolve('.env');
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, 'utf8');
        if (content.includes('WHATSAPP_ADMIN_GROUP_ID=')) {
          content = content.replace(/WHATSAPP_ADMIN_GROUP_ID=.*/g, `WHATSAPP_ADMIN_GROUP_ID=${groupJid}`);
        } else {
          content += `\nWHATSAPP_ADMIN_GROUP_ID=${groupJid}\n`;
        }
        fs.writeFileSync(envPath, content, 'utf8');
      }
    } catch (e) {
      console.error('Failed to write .env:', e.message);
    }

    await sendMessageToJid(groupJid,
      `✅ *Grup Admin WhatsApp Berhasil Diaktifkan!* 📢\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `*Group JID:* \`${groupJid}\`\n\n` +
      `Grup ini telah terdaftar sebagai *Admin Group* untuk notifikasi peminjaman Smart TV.\n` +
      `Setiap pengajuan peminjaman akan otomatis masuk ke grup ini dan Admin cukup membalas pesan notifikasi dengan:\n` +
      `✅ *1* = ACC / Approve\n` +
      `❌ *2* = Tolak / Reject`
    );

    setTimeout(async () => {
      await resendPendingNotifications();
    }, 1500);

    return;
  }

  // Only process 1 or 2 commands
  const choice = text.trim();
  if (choice !== '1' && choice !== '2') return;

  const action = choice === '1' ? 'approve' : 'reject';

  // Strategy 1: Admin replied a specific notification message
  const quotedId = getQuotedMessageId(msg);
  if (quotedId) {
    const pending = pendingAdminNotifs.get(quotedId);
    if (pending) {
      console.log(`[WhatsApp] Admin ${action} via REPLY - loanId: ${pending.loanId}`);
      await processLoanAction(pending.loanId, action, groupJid, quotedId);
      return;
    }
  }

  // Strategy 2: Admin typed directly — find PENDING loan from DB
  console.log(`[WhatsApp] Admin typed "${choice}" directly — searching PENDING loans...`);
  try {
    const pendingLoans = await prisma.loan.findMany({
      where: { status: 'PENDING' },
      include: {
        asset: { select: { namaTv: true } },
        user: { select: { nama: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (pendingLoans.length === 0) {
      await sendMessageToJid(groupJid, `Tidak ada pengajuan peminjaman yang menunggu persetujuan.`);
      return;
    }

    if (pendingLoans.length === 1) {
      const loan = pendingLoans[0];
      console.log(`[WhatsApp] Auto-selected loan ${loan.id} for ${action}`);
      await processLoanAction(loan.id, action, groupJid, null);
      return;
    }

    // Multiple pending — ask admin to reply specific notification
    const listText = pendingLoans
      .slice(0, 5)
      .map((l, i) => `${i + 1}. *${l.user.nama}* - ${l.asset.namaTv}`)
      .join('\n');

    await sendMessageToJid(groupJid,
      `Ada *${pendingLoans.length} pengajuan* yang menunggu:\n\n${listText}\n\n` +
      `Silakan BALAS (reply) pesan notifikasi spesifik dengan *${choice}* untuk memilih salah satu.`
    );
  } catch (err) {
    console.error('[WhatsApp] Error finding pending loans:', err);
    await sendMessageToJid(groupJid, `Terjadi error saat mencari data. Silakan coba lagi.`);
  }
}


/**
 * Process approve or reject action for a specific loan
 */
async function processLoanAction(loanId, action, groupJid, quotedId) {
  try {
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        asset: { select: { namaTv: true, id: true } },
        user: { select: { id: true, nama: true, departemen: true, whatsappJid: true, noHp: true } },
        parentLoan: true,
      },
    });

    if (!loan) {
      await sendMessageToJid(groupJid, `Peminjaman tidak ditemukan.`);
      if (quotedId) pendingAdminNotifs.delete(quotedId);
      return;
    }

    if (loan.status !== 'PENDING') {
      await sendMessageToJid(groupJid, `Peminjaman sudah diproses sebelumnya (${loan.status}).`);
      if (quotedId) pendingAdminNotifs.delete(quotedId);
      return;
    }

    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    if (action === 'approve') {
      // Re-check conflict
      const conflict = await prisma.loan.findFirst({
        where: {
          assetId: loan.assetId,
          id: { notIn: [loanId, loan.parentLoanId].filter(Boolean) },
          status: { in: ['APPROVED', 'ONGOING'] },
          OR: [{ tglPinjam: { lte: loan.tglKembaliRencana }, tglKembaliRencana: { gte: loan.tglPinjam } }],
        },
      });

      if (conflict) {
        await sendMessageToJid(groupJid, `Tidak bisa approve - jadwal *${loan.asset.namaTv}* bentrok dengan peminjaman lain.`);
        return;
      }

      await prisma.loan.update({
        where: { id: loanId },
        data: { status: 'ONGOING', approvedBy: adminUser?.id || null, catatanAdmin: 'Disetujui via WhatsApp' },
      });

      await prisma.asset.update({
        where: { id: loan.assetId },
        data: { status: 'DIPINJAM' },
      });

      await prisma.handoverLog.create({
        data: { loanId, tipe: 'PENGAMBILAN', kondisi: 'Baik', catatan: 'Disetujui otomatis via WhatsApp' },
      });

      await prisma.notification.create({
        data: {
          userId: loan.user.id,
          title: loan.isExtension ? 'Perpanjangan Disetujui' : 'Peminjaman Disetujui & Aktif',
          message: `Peminjaman ${loan.asset.namaTv} Anda telah disetujui.`,
          type: 'approval',
          refId: loan.id,
        },
      });

      if (loan.user.whatsappJid) {
        console.log(`[WhatsApp] Sending approval to borrower: ${loan.user.whatsappJid}`);
        await sendMessageToJid(
          loan.user.whatsappJid,
          `*Peminjaman Smart TV Disetujui!*\n\nUnit *${loan.asset.namaTv}* siap digunakan.\nSampai: ${new Date(loan.tglKembaliRencana).toLocaleString('id-ID')}`
        );
      } else {
        console.log(`[WhatsApp] Borrower ${loan.user.nama} has no whatsappJid`);
      }

      await sendMessageToJid(groupJid,
        `✅ *PEMINJAMAN DISETUJUI*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📺 *Unit TV:* ${loan.asset.namaTv}\n` +
        `👤 *Peminjam:* ${loan.user.nama}\n` +
        `📱 *No. HP:* ${loan.user.noHp || '-'}\n` +
        `🏢 *Departemen:* ${loan.user.departemen || '-'}\n` +
        `📅 *Sampai:* ${new Date(loan.tglKembaliRencana).toLocaleString('id-ID')}\n\n` +
        `_Status peminjaman aktif & notifikasi telah dikirim ke peminjam._`
      );
    } else {
      await prisma.loan.update({
        where: { id: loanId },
        data: { status: 'REJECTED', approvedBy: adminUser?.id || null, catatanAdmin: 'Ditolak via WhatsApp' },
      });

      await prisma.notification.create({
        data: {
          userId: loan.user.id,
          title: 'Peminjaman Ditolak',
          message: `Peminjaman ${loan.asset.namaTv} Anda ditolak. Silakan hubungi admin.`,
          type: 'approval',
          refId: loan.id,
        },
      });

      if (loan.user.whatsappJid) {
        console.log(`[WhatsApp] Sending rejection to borrower: ${loan.user.whatsappJid}`);
        await sendMessageToJid(
          loan.user.whatsappJid,
          `*Peminjaman Ditolak*\n\nPengajuan peminjaman unit *${loan.asset.namaTv}* Anda ditolak oleh Admin.`
        );
      } else {
        console.log(`[WhatsApp] Borrower ${loan.user.nama} has no whatsappJid`);
      }

      await sendMessageToJid(groupJid,
        `❌ *PEMINJAMAN DITOLAK*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📺 *Unit TV:* ${loan.asset.namaTv}\n` +
        `👤 *Peminjam:* ${loan.user.nama}\n` +
        `📱 *No. HP:* ${loan.user.noHp || '-'}\n` +
        `🏢 *Departemen:* ${loan.user.departemen || '-'}\n\n` +
        `_Notifikasi penolakan telah dikirim ke peminjam._`
      );
    }

    if (quotedId) pendingAdminNotifs.delete(quotedId);
  } catch (error) {
    console.error('[WhatsApp] processLoanAction error:', error);
    await sendMessageToJid(groupJid, `Terjadi error saat memproses. Silakan coba lagi.`);
  }
}


/**
 * Resolve actual phone number from WhatsApp JID or LID mapping
 */
function resolvePhoneNumber(jid) {
  if (!jid) return null;

  // Case 1: Standard WhatsApp JID: 628xxx@s.whatsapp.net
  if (jid.endsWith('@s.whatsapp.net')) {
    const raw = jid.replace('@s.whatsapp.net', '');
    return raw.replace(/[^0-9]/g, '');
  }

  // Case 2: Privacy LID: 183747810951250@lid
  if (jid.endsWith('@lid')) {
    const lid = jid.replace('@lid', '');
    const mappingFile = path.join('./wa-auth-state', `lid-mapping-${lid}_reverse.json`);
    try {
      if (fs.existsSync(mappingFile)) {
        const raw = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
        if (raw) return String(raw).replace(/[^0-9]/g, '');
      }
    } catch (e) {
      console.error('[WhatsApp] Error reading lid mapping:', e.message);
    }
  }

  return null;
}

/**
 * Extract phone number from vcard contact message
 */
function extractPhoneFromContactMessage(msg) {
  const contactMsg = msg.message?.contactMessage;
  if (contactMsg?.vcard) {
    const waidMatch = contactMsg.vcard.match(/waid=(\d+)/i);
    if (waidMatch && waidMatch[1]) return waidMatch[1];

    const telMatch = contactMsg.vcard.match(/TEL[^:]*:([+\d\s-]+)/i);
    if (telMatch && telMatch[1]) {
      return telMatch[1].replace(/[^0-9]/g, '');
    }
  }

  const arrayMsg = msg.message?.contactsArrayMessage?.contacts;
  if (arrayMsg && arrayMsg.length > 0 && arrayMsg[0].vcard) {
    const waidMatch = arrayMsg[0].vcard.match(/waid=(\d+)/i);
    if (waidMatch && waidMatch[1]) return waidMatch[1];
    const telMatch = arrayMsg[0].vcard.match(/TEL[^:]*:([+\d\s-]+)/i);
    if (telMatch && telMatch[1]) {
      return telMatch[1].replace(/[^0-9]/g, '');
    }
  }

  return null;
}

/**
 * Verify and automatically link user based on detected phone number
 */
async function verifyAndLinkUser(jid, phone, pushName) {
  if (!phone) return false;

  let phoneVariants = [phone];
  if (phone.startsWith('62')) {
    phoneVariants.push('0' + phone.slice(2));
  } else if (phone.startsWith('0')) {
    phoneVariants.push('62' + phone.slice(1));
  }

  let matchedUser = await prisma.user.findFirst({
    where: {
      OR: [
        { whatsappJid: jid },
        ...phoneVariants.map((p) => ({ noHp: { contains: p } })),
      ],
    },
  });

  if (matchedUser) {
    matchedUser = await prisma.user.update({
      where: { id: matchedUser.id },
      data: {
        whatsappJid: jid,
        noHp: matchedUser.noHp || `+${phone}`,
      },
    });

    await sendMessageToJid(jid,
      `🎉 *Pendaftaran Berhasil!*\n\n` +
      `Akun peminjam telah terdaftar:\n` +
      `👤 *Nama:* ${matchedUser.nama}\n` +
      `📱 *No HP:* ${matchedUser.noHp}\n\n` +
      `Sekarang Anda bisa langsung ketik *pinjam* untuk mengajukan peminjaman Smart TV! 📺`
    );
    return true;
  } else {
    const dummyPassword = await bcrypt.hash('whatsapp123', 10);
    const newUser = await prisma.user.create({
      data: {
        nama: pushName || 'Karyawan',
        departemen: 'Umum',
        noHp: `+${phone}`,
        email: `wa_${phone}@whatsapp.app`,
        passwordHash: dummyPassword,
        whatsappJid: jid,
        role: 'KARYAWAN',
      },
    });

    await sendMessageToJid(jid,
      `🎉 *Pendaftaran Berhasil!*\n\n` +
      `Akun peminjam telah terdaftar:\n` +
      `👤 *Nama:* ${newUser.nama}\n` +
      `📱 *No HP:* ${newUser.noHp}\n\n` +
      `Sekarang Anda bisa langsung ketik *pinjam* untuk mengajukan peminjaman Smart TV! 📺`
    );
    return true;
  }
}

/**
 * Handle incoming Contact Card (Bagikan Kontak via WhatsApp)
 */
async function handleContactCardMessage(msg, jid, pushName) {
  const phone = extractPhoneFromContactMessage(msg);
  if (!phone) {
    return sendMessageToJid(jid,
      `⚠️ Nomor HP tidak terbaca dari kontak yang dikirim. Pastikan Anda mengirim kontak yang berisi nomor telepon.`
    );
  }

  return verifyAndLinkUser(jid, phone, pushName);
}

// Helper to extract clean phone number from JID
function getCleanPhone(jid) {
  return resolvePhoneNumber(jid) || '';
}

// ============================================================
// Private Message Handler (User Commands & Wizard)
// ============================================================

async function handlePrivateMessage(msg, jid, text, pushName = '') {
  const lowerText = text.toLowerCase().trim();

  // Command: batal
  if (['batal', '/batal', 'cancel', '/cancel'].includes(lowerText)) {
    waUserStates.delete(jid);
    return sendMessageToJid(jid, `🚫 Tindakan telah dibatalkan. Ketik *menu* untuk melihat daftar perintah.`);
  }

  // Check wizard state first (interactive input)
  const state = waUserStates.get(jid);
  if (state) {
    if (state.step === 'REGISTRATION') {
      return handleRegistrationInput(jid, text, state);
    }
    return handleWizardInput(jid, text, state);
  }

  // Command: menu / help / halo / start
  if (['menu', 'help', 'halo', 'hai', 'hi', 'start', '/start', '/help', '/menu'].includes(lowerText)) {
    return handleMenuCommand(jid);
  }

  // Command: daftar / register
  if (lowerText.startsWith('daftar') || lowerText.startsWith('register') || lowerText.startsWith('/daftar')) {
    return handleRegisterCommand(jid, text, pushName, msg);
  }

  // Command: tv
  if (['tv', '/tv', 'list tv', 'daftar tv'].includes(lowerText)) {
    return handleTvCommand(jid);
  }

  // Command: status
  if (['status', '/status', 'cek status', 'cek'].includes(lowerText)) {
    return handleStatusCommand(jid);
  }

  // Command: pinjam
  if (['pinjam', '/pinjam', 'booking', '/booking'].includes(lowerText)) {
    return handlePinjamCommand(jid);
  }

  // Default response
  return sendMessageToJid(jid,
    `🤖 Perintah tidak dikenal.\n\nKetik *menu* untuk melihat daftar perintah yang tersedia.`
  );
}

// ============================================================
// Command Handlers
// ============================================================

async function handleMenuCommand(jid) {
  const menu =
    `📺 *Bot Peminjaman Smart TV*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Sistem ini memudahkan Anda mengecek ketersediaan Smart TV dan melakukan peminjaman langsung dari WhatsApp.\n\n` +
    `📌 *Perintah Tersedia:*\n\n` +
    `▶️ *daftar* — Pendaftaran / ubah nama peminjam\n` +
    `▶️ *tv* — Cek daftar Smart TV & jadwal pemakaian\n` +
    `▶️ *pinjam* — Ajukan peminjaman Smart TV\n` +
    `▶️ *status* — Cek status peminjaman aktif Anda\n` +
    `▶️ *batal* — Batalkan proses peminjaman\n\n` +
    `_Ketik *daftar* atau *pinjam* untuk memulai._`;

  return sendMessageToJid(jid, menu);
}

async function handleRegisterCommand(jid, text, pushName, msg) {
  // Check if user provided name directly: e.g. "daftar Bayu Sukra"
  const payload = text.replace(/^(daftar|register|\/daftar|\/register)/i, '').trim();
  if (payload) {
    return handleRegistrationInput(jid, payload, { pushName });
  }

  // Ask for full name
  waUserStates.set(jid, { step: 'REGISTRATION', pushName });

  const existingUser = await prisma.user.findFirst({
    where: { whatsappJid: jid },
  });

  if (existingUser) {
    return sendMessageToJid(jid,
      `📝 *Pendaftaran Nama Peminjam*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Nama peminjam saat ini: *${existingUser.nama}*\n\n` +
      `Silakan balas pesan ini dengan *Nama Lengkap* Anda jika ingin mengubahnya:\n\n` +
      `_Contoh:_ *Bayu Sukra*`
    );
  }

  return sendMessageToJid(jid,
    `📝 *Pendaftaran Peminjam Smart TV*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Silakan balas pesan ini dengan *Nama Lengkap* Anda:\n\n` +
    `_Contoh:_ *Bayu Sukra*`
  );
}

async function handleRegistrationInput(jid, text, state) {
  const nama = text.trim();
  if (!nama) {
    return sendMessageToJid(jid, `⚠️ Silakan ketik Nama Lengkap Anda.`);
  }

  const phone = resolvePhoneNumber(jid);

  let phoneVariants = phone ? [phone] : [];
  if (phone && phone.startsWith('62')) {
    phoneVariants.push('0' + phone.slice(2));
  } else if (phone && phone.startsWith('0')) {
    phoneVariants.push('62' + phone.slice(1));
  }

  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { whatsappJid: jid },
        ...(phoneVariants.length > 0 ? phoneVariants.map((p) => ({ noHp: { contains: p } })) : []),
      ],
    },
  });

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        nama,
        whatsappJid: jid,
        noHp: user.noHp || (phone ? `+${phone}` : null),
      },
    });
  } else {
    const dummyPassword = await bcrypt.hash('whatsapp123', 10);
    const uniqueEmail = phone
      ? `wa_${phone}@whatsapp.app`
      : `wa_${Date.now()}@whatsapp.app`;

    user = await prisma.user.create({
      data: {
        nama,
        departemen: 'Umum',
        noHp: phone ? `+${phone}` : null,
        email: uniqueEmail,
        passwordHash: dummyPassword,
        whatsappJid: jid,
        role: 'KARYAWAN',
      },
    });
  }

  waUserStates.delete(jid);

  return sendMessageToJid(jid,
    `🎉 *Pendaftaran Berhasil!*\n\n` +
    `Akun peminjam telah terdaftar:\n` +
    `👤 *Nama:* ${user.nama}\n` +
    `📱 *No HP:* ${user.noHp || '-'}\n\n` +
    `Sekarang Anda bisa langsung ketik *pinjam* untuk mengajukan peminjaman Smart TV! 📺`
  );
}


async function handleTvCommand(jid) {
  const assets = await prisma.asset.findMany({
    orderBy: { namaTv: 'asc' },
  });

  if (assets.length === 0) {
    return sendMessageToJid(jid, `📺 *Daftar Smart TV*\n\nSaat ini belum ada unit Smart TV di sistem.`);
  }

  let tvMsg = `📺 *Daftar Smart TV & Jadwal Pemakaian:*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (let idx = 0; idx < assets.length; idx++) {
    const tv = assets[idx];
    const scheduleInfo = await getAssetScheduleText(tv.id);
    tvMsg +=
      `*${idx + 1}. ${tv.namaTv}* (${tv.ukuran}, ${tv.merk})\n` +
      `   📍 Lokasi: ${tv.lokasi} | Status: *${tv.status}*\n` +
      `   ${scheduleInfo}\n\n`;
  }

  tvMsg += `_Ketik *pinjam* untuk mengajukan peminjaman._`;

  return sendMessageToJid(jid, tvMsg);
}

async function handleStatusCommand(jid) {
  const user = await prisma.user.findFirst({
    where: { whatsappJid: jid },
  });

  if (!user) {
    return sendMessageToJid(jid,
      `⚠️ Akun WhatsApp Anda belum terdaftar.\nKetik *daftar* untuk registrasi otomatis.`
    );
  }

  const activeLoans = await prisma.loan.findMany({
    where: {
      userId: user.id,
      status: { in: ['PENDING', 'APPROVED', 'ONGOING'] },
    },
    include: { asset: true },
    orderBy: { createdAt: 'desc' },
  });

  if (activeLoans.length === 0) {
    return sendMessageToJid(jid,
      `📋 *Status Peminjaman ${user.nama}*\n\nAnda tidak memiliki peminjaman aktif saat ini.`
    );
  }

  let statusMsg = `📋 *Status Peminjaman ${user.nama}* (${activeLoans.length} Aktif):\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  activeLoans.forEach((loan, idx) => {
    const statusBadge =
      loan.status === 'ONGOING' ? '🟢 AKTIF' :
      loan.status === 'APPROVED' ? '🟡 DISETUJUI' : '⏳ PENDING';
    statusMsg +=
      `*${idx + 1}. ${loan.asset.namaTv}* [${statusBadge}]\n` +
      `   📋 Keperluan: ${loan.keperluan}\n` +
      `   📅 Mulai: ${new Date(loan.tglPinjam).toLocaleString('id-ID')}\n` +
      `   📅 Sampai: ${new Date(loan.tglKembaliRencana).toLocaleString('id-ID')}\n\n`;
  });

  return sendMessageToJid(jid, statusMsg);
}

async function handlePinjamCommand(jid) {
  const user = await prisma.user.findFirst({
    where: { whatsappJid: jid },
  });

  if (!user) {
    return sendMessageToJid(jid,
      `⚠️ *Akun Belum Terdaftar*\n\nKetik *daftar* terlebih dahulu untuk registrasi otomatis.`
    );
  }


  const availableAssets = await prisma.asset.findMany({
    where: { status: 'TERSEDIA' },
    orderBy: { namaTv: 'asc' },
  });

  if (availableAssets.length === 0) {
    return sendMessageToJid(jid,
      `😔 Maaf, saat ini seluruh unit Smart TV sedang dipinjam atau dalam maintenance.`
    );
  }

  let tvList = `🚀 *Form Peminjaman Smart TV (Step 1/5)*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\nPilih unit Smart TV:\n\n`;
  availableAssets.forEach((tv, idx) => {
    tvList += `*${idx + 1}.* 📺 ${tv.namaTv} (${tv.lokasi})\n`;
  });
  tvList += `\n_Balas dengan *angka* untuk memilih:_`;

  waUserStates.set(jid, {
    step: 'SELECT_TV',
    assets: availableAssets.map((a) => ({ id: a.id, name: a.namaTv, lokasi: a.lokasi })),
  });

  return sendMessageToJid(jid, tvList);
}

// ============================================================
// Wizard State Machine
// ============================================================

async function handleWizardInput(jid, text, state) {
  const input = text.trim();

  switch (state.step) {
    case 'SELECT_TV':
      return handleSelectTv(jid, input, state);
    case 'SELECT_DATE':
      return handleSelectDate(jid, input, state);
    case 'SELECT_TIME':
      return handleSelectTime(jid, input, state);
    case 'SELECT_DURATION':
      return handleSelectDuration(jid, input, state);
    case 'SELECT_PURPOSE':
      return handleSelectPurpose(jid, input, state);
    default:
      waUserStates.delete(jid);
      return sendMessageToJid(jid, `⚠️ Session tidak valid. Ketik *pinjam* untuk mulai ulang.`);
  }
}

async function handleSelectTv(jid, input, state) {
  const idx = parseInt(input, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= state.assets.length) {
    return sendMessageToJid(jid,
      `⚠️ Pilihan tidak valid. Balas dengan angka *1* sampai *${state.assets.length}*`
    );
  }

  const selected = state.assets[idx];
  const scheduleInfo = await getAssetScheduleText(selected.id);

  waUserStates.set(jid, {
    step: 'SELECT_DATE',
    assetId: selected.id,
    assetName: selected.name,
  });

  return sendMessageToJid(jid,
    `📺 Unit: *${selected.name}* (${selected.lokasi})\n${scheduleInfo}\n\n` +
    `📅 *Form Peminjaman Smart TV (Step 2/5)*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\nPilih tanggal mulai:\n\n` +
    `*1.* 📅 Hari Ini\n` +
    `*2.* 📅 Besok\n` +
    `*3.* 📅 Lusa (2 Hari Lagi)\n\n` +
    `_Balas dengan angka:_`
  );
}

async function handleSelectDate(jid, input, state) {
  const dateOptions = ['today', 'tomorrow', 'aftertomorrow'];
  const idx = parseInt(input, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= dateOptions.length) {
    return sendMessageToJid(jid, `⚠️ Pilihan tidak valid. Balas *1*, *2*, atau *3*`);
  }

  const dateType = dateOptions[idx];
  const dateLabel = dateType === 'tomorrow' ? 'Besok' : dateType === 'aftertomorrow' ? 'Lusa' : 'Hari Ini';

  waUserStates.set(jid, {
    ...state,
    step: 'SELECT_TIME',
    dateType,
  });

  return sendMessageToJid(jid,
    `🕒 *Form Peminjaman Smart TV (Step 3/5)*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Unit: *${state.assetName}*\nTanggal: *${dateLabel}*\n\n` +
    `Pilih Jam Mulai:\n\n` +
    `*1.* 🕒 08:00    *4.* 🕒 13:00\n` +
    `*2.* 🕒 09:00    *5.* 🕒 14:00\n` +
    `*3.* 🕒 10:00    *6.* 🕒 15:00\n\n` +
    `_Atau ketik jam khusus (misal: 14:30):_`
  );
}

async function handleSelectTime(jid, input, state) {
  const timeOptions = [8, 9, 10, 13, 14, 15];
  let startHour, startMin = 0;

  const idx = parseInt(input, 10);
  if (idx >= 1 && idx <= 6) {
    startHour = timeOptions[idx - 1];
  } else if (input.includes(':')) {
    const parts = input.split(':');
    startHour = parseInt(parts[0], 10);
    startMin = parseInt(parts[1], 10) || 0;
    if (isNaN(startHour) || startHour < 0 || startHour > 23) {
      return sendMessageToJid(jid, `⚠️ Format jam tidak valid. Gunakan format HH:MM (misal: 14:30)`);
    }
  } else {
    return sendMessageToJid(jid, `⚠️ Pilihan tidak valid. Balas angka *1-6* atau ketik jam (misal: 14:30)`);
  }

  const timeFormatted = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
  const dateLabel = state.dateType === 'tomorrow' ? 'Besok' : state.dateType === 'aftertomorrow' ? 'Lusa' : 'Hari Ini';

  waUserStates.set(jid, {
    ...state,
    step: 'SELECT_DURATION',
    startHour,
    startMin,
  });

  return sendMessageToJid(jid,
    `⏱️ *Form Peminjaman Smart TV (Step 4/5)*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Unit: *${state.assetName}*\nMulai: *${dateLabel} jam ${timeFormatted}*\n\n` +
    `Pilih durasi peminjaman:\n\n` +
    `*1.* ⏱️ 1 Jam\n` +
    `*2.* ⏱️ 2 Jam\n` +
    `*3.* ⏱️ 4 Jam (Setengah Hari)\n` +
    `*4.* ⏱️ 8 Jam (Seharian Kerja)\n\n` +
    `_Balas dengan angka:_`
  );
}

async function handleSelectDuration(jid, input, state) {
  const durationOptions = [1, 2, 4, 8];
  const idx = parseInt(input, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= durationOptions.length) {
    return sendMessageToJid(jid, `⚠️ Pilihan tidak valid. Balas angka *1* sampai *4*`);
  }

  const durationHours = durationOptions[idx];
  const timeFormatted = `${String(state.startHour).padStart(2, '0')}:${String(state.startMin).padStart(2, '0')}`;
  const dateLabel = state.dateType === 'tomorrow' ? 'Besok' : state.dateType === 'aftertomorrow' ? 'Lusa' : 'Hari Ini';

  waUserStates.set(jid, {
    ...state,
    step: 'SELECT_PURPOSE',
    durationHours,
  });

  let purposeMsg =
    `📋 *Form Peminjaman Smart TV (Step 5/5)*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Unit: *${state.assetName}*\nMulai: *${dateLabel} jam ${timeFormatted}*\nDurasi: *${durationHours} Jam*\n\n` +
    `Pilih keperluan:\n\n`;

  PURPOSES.forEach((p, i) => {
    purposeMsg += `*${i + 1}.* ${p}\n`;
  });

  purposeMsg += `\n_Atau ketik keperluan khusus:_`;

  return sendMessageToJid(jid, purposeMsg);
}

async function handleSelectPurpose(jid, input, state) {
  let keperluan;
  const idx = parseInt(input, 10) - 1;
  if (!isNaN(idx) && idx >= 0 && idx < PURPOSES.length) {
    keperluan = PURPOSES[idx];
  } else {
    keperluan = input; // Custom purpose
  }

  // Find user
  const user = await prisma.user.findFirst({
    where: { whatsappJid: jid },
  });

  if (!user) {
    waUserStates.delete(jid);
    return sendMessageToJid(jid, `❌ Akun tidak ditemukan. Ketik *daftar* untuk registrasi.`);
  }

  // Calculate dates
  let tglPinjam = new Date();
  if (state.dateType === 'tomorrow') {
    tglPinjam.setDate(tglPinjam.getDate() + 1);
  } else if (state.dateType === 'aftertomorrow') {
    tglPinjam.setDate(tglPinjam.getDate() + 2);
  }
  tglPinjam.setHours(state.startHour || 9, state.startMin || 0, 0, 0);

  const tglKembaliRencana = new Date(tglPinjam.getTime() + (state.durationHours || 2) * 3600000);

  waUserStates.delete(jid);

  return processWALoanCreation(jid, user, state.assetId, state.durationHours || 2, keperluan, tglPinjam, tglKembaliRencana);
}

// ============================================================
// Loan Creation from WhatsApp
// ============================================================

async function processWALoanCreation(jid, user, assetId, durationHours, keperluan, tglPinjam, tglKembaliRencana) {
  try {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      return sendMessageToJid(jid, `❌ Unit TV tidak ditemukan.`);
    }

    // Conflict check
    const conflict = await prisma.loan.findFirst({
      where: {
        assetId,
        status: { in: ['APPROVED', 'ONGOING'] },
        OR: [
          {
            tglPinjam: { lte: tglKembaliRencana },
            tglKembaliRencana: { gte: tglPinjam },
          },
        ],
      },
    });

    if (conflict) {
      const scheduleInfo = await getAssetScheduleText(assetId);
      return sendMessageToJid(jid,
        `⚠️ *Jadwal Bentrok!*\n\nMaaf, unit *${asset.namaTv}* sudah dipinjam pada rentang waktu tersebut.\n\n${scheduleInfo}\n\nSilakan coba jam/hari lain via *pinjam*.`
      );
    }

    // Create loan
    const loan = await prisma.loan.create({
      data: {
        assetId,
        userId: user.id,
        tglPinjam,
        tglKembaliRencana,
        status: 'PENDING',
        keperluan,
        departemen: user.departemen || 'Umum',
        source: 'WHATSAPP',
      },
    });

    // Confirm to borrower
    await sendMessageToJid(jid,
      `🎉 *Pengajuan Peminjaman Berhasil Dikirim!*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 *Peminjam:* ${user.nama} (${user.departemen})\n` +
      `📺 *Unit TV:* ${asset.namaTv} (${asset.lokasi})\n` +
      `📅 *Mulai:* ${tglPinjam.toLocaleString('id-ID')}\n` +
      `📅 *Selesai:* ${tglKembaliRencana.toLocaleString('id-ID')}\n` +
      `⏱️ *Durasi:* ${durationHours} Jam\n` +
      `📋 *Keperluan:* ${keperluan}\n\n` +
      `⏳ Status: *PENDING (Diteruskan ke Admin)*\n\n` +
      `_Notifikasi persetujuan akan dikirim ke sini setelah Admin approve._`
    );

    // Send to admin group via WA
    await sendLoanNotificationWA(
      loan,
      user.nama,
      asset.namaTv,
      keperluan,
      user.departemen,
      tglPinjam,
      tglKembaliRencana,
      user.noHp
    );

  } catch (error) {
    console.error('[WhatsApp Loan Error]:', error);
    sendMessageToJid(jid, `❌ Terjadi kesalahan saat memproses pengajuan. Silakan coba lagi.`);
  }
}

// ============================================================
// Helpers
// ============================================================

/**
 * Format upcoming schedule for an asset
 */
async function getAssetScheduleText(assetId) {
  const upcomingLoans = await prisma.loan.findMany({
    where: {
      assetId,
      status: { in: ['APPROVED', 'ONGOING', 'PENDING'] },
      tglKembaliRencana: { gte: new Date() },
    },
    include: { user: { select: { nama: true, departemen: true } } },
    orderBy: { tglPinjam: 'asc' },
    take: 5,
  });

  if (upcomingLoans.length === 0) {
    return `🟢 _Belum ada jadwal terisi (Bebas dipinjam kapan saja)_`;
  }

  let text = `📅 *Jadwal Peminjaman Terisi:*\n`;
  upcomingLoans.forEach((loan) => {
    const startStr = new Date(loan.tglPinjam).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
    const endStr = new Date(loan.tglKembaliRencana).toLocaleString('id-ID', {
      hour: '2-digit', minute: '2-digit'
    });
    const statusIcon = loan.status === 'ONGOING' ? '🟢 Dipinjam' : loan.status === 'APPROVED' ? '🟡 Disetujui' : '⏳ Pending';
    text += `• ${startStr} s/d ${endStr} — ${loan.user.nama} (${statusIcon})\n`;
  });
  return text;
}
