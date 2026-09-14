import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database (Clean version)...');

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.handoverLog.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  const passwordHash = await bcrypt.hash('password123', 10);
  const adminPasswordHash = await bcrypt.hash('jegsubagood', 10);

  // Real Admin User (credentials: admin@admin.com / jegsubagood)
  await prisma.user.create({
    data: {
      nama: 'Administrator',
      email: 'admin@admin.com',
      passwordHash: adminPasswordHash,
      departemen: 'IT',
      noHp: '081234567800',
      role: 'ADMIN',
    },
  });

  // Legacy Demo Admin User
  await prisma.user.create({
    data: {
      nama: 'Admin Aset',
      email: 'admin@company.com',
      passwordHash,
      departemen: 'IT',
      noHp: '081234567890',
      role: 'ADMIN',
    },
  });

  // Employee Users
  await prisma.user.create({
    data: {
      nama: 'Budi Santoso',
      email: 'budi@company.com',
      passwordHash,
      departemen: 'Marketing',
      noHp: '081234567891',
      role: 'KARYAWAN',
    },
  });

  await prisma.user.create({
    data: {
      nama: 'Siti Rahayu',
      email: 'siti@company.com',
      passwordHash,
      departemen: 'HR',
      noHp: '081234567892',
      role: 'KARYAWAN',
    },
  });

  await prisma.user.create({
    data: {
      nama: 'Andi Wijaya',
      email: 'andi@company.com',
      passwordHash,
      departemen: 'Finance',
      noHp: '081234567893',
      role: 'KARYAWAN',
    },
  });

  await prisma.user.create({
    data: {
      nama: 'Dewi Lestari',
      email: 'dewi@company.com',
      passwordHash,
      departemen: 'Engineering',
      noHp: '081234567894',
      role: 'KARYAWAN',
    },
  });

  console.log('✅ Users created successfully');

  // Create default Smart TV Assets
  await prisma.asset.create({
    data: {
      namaTv: 'Smart TV Ruang Rapat Utama',
      kodeInventaris: 'TV-001',
      merk: 'Samsung',
      ukuran: '65 inch',
      lokasi: 'Gedung A Lt.2',
      status: 'TERSEDIA',
      kondisi: 'Baik',
    },
  });

  await prisma.asset.create({
    data: {
      namaTv: 'Smart TV Ruang Training',
      kodeInventaris: 'TV-002',
      merk: 'LG',
      ukuran: '55 inch',
      lokasi: 'Gedung B Lt.1',
      status: 'TERSEDIA',
      kondisi: 'Baik',
    },
  });

  await prisma.asset.create({
    data: {
      namaTv: 'Smart TV Lobby',
      kodeInventaris: 'TV-003',
      merk: 'Sony',
      ukuran: '50 inch',
      lokasi: 'Gedung A Lt.1',
      status: 'TERSEDIA',
      kondisi: 'Baik',
    },
  });

  await prisma.asset.create({
    data: {
      namaTv: 'Smart TV Ruang Direksi',
      kodeInventaris: 'TV-004',
      merk: 'Samsung',
      ukuran: '75 inch',
      lokasi: 'Gedung A Lt.3',
      status: 'TERSEDIA',
      kondisi: 'Baik',
    },
  });

  await prisma.asset.create({
    data: {
      namaTv: 'Smart TV Aula Serbaguna',
      kodeInventaris: 'TV-005',
      merk: 'TCL',
      ukuran: '65 inch',
      lokasi: 'Gedung C Lt.1',
      status: 'TERSEDIA',
      kondisi: 'Baik',
    },
  });

  console.log('✅ Default Smart TV Assets created successfully');
  console.log('');
  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
