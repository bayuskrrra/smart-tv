import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';

const prisma = new PrismaClient();

export function initScheduler() {
  console.log('⏰ Scheduler initialized');

  // Check overdue loans every hour
  cron.schedule('0 * * * *', async () => {
    console.log('🔍 Checking for overdue loans...');
    try {
      const now = new Date();
      const overdueLoans = await prisma.loan.findMany({
        where: {
          status: 'ONGOING',
          tglKembaliRencana: { lt: now },
        },
        include: {
          asset: { select: { namaTv: true } },
          user: { select: { nama: true } },
        },
      });

      for (const loan of overdueLoans) {
        await prisma.loan.update({
          where: { id: loan.id },
          data: { status: 'OVERDUE' },
        });

        await prisma.notification.create({
          data: {
            userId: loan.userId,
            title: 'Peminjaman Overdue ⚠️',
            message: `Peminjaman ${loan.asset.namaTv} sudah melewati batas waktu pengembalian. Segera kembalikan!`,
            type: 'overdue',
            refId: loan.id,
          },
        });

        // Also notify admins
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            title: 'Peminjaman Overdue',
            message: `Peminjaman ${loan.asset.namaTv} oleh ${loan.user.nama} sudah overdue`,
            type: 'overdue',
            refId: loan.id,
          })),
        });

        console.log(`  ⚠️ Loan ${loan.id} marked as OVERDUE`);
      }

      if (overdueLoans.length > 0) {
        console.log(`  Total: ${overdueLoans.length} loans marked as overdue`);
      }
    } catch (error) {
      console.error('Overdue check error:', error);
    }
  });

  // Send reminders at 8 AM daily for loans due tomorrow
  cron.schedule('0 8 * * *', async () => {
    console.log('📧 Sending return reminders...');
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      const loans = await prisma.loan.findMany({
        where: {
          status: 'ONGOING',
          reminderSent: false,
          tglKembaliRencana: {
            gte: tomorrow,
            lt: dayAfterTomorrow,
          },
        },
        include: {
          asset: { select: { namaTv: true } },
        },
      });

      for (const loan of loans) {
        await prisma.notification.create({
          data: {
            userId: loan.userId,
            title: 'Reminder Pengembalian 📅',
            message: `Pengingat: Peminjaman ${loan.asset.namaTv} harus dikembalikan besok. Pastikan TV dalam kondisi baik.`,
            type: 'reminder',
            refId: loan.id,
          },
        });

        await prisma.loan.update({
          where: { id: loan.id },
          data: { reminderSent: true },
        });

        console.log(`  📧 Reminder sent for loan ${loan.id}`);
      }

      if (loans.length > 0) {
        console.log(`  Total: ${loans.length} reminders sent`);
      }
    } catch (error) {
      console.error('Reminder error:', error);
    }
  });
}
