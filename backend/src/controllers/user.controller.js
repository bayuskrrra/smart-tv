import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '../utils/helpers.js';

const prisma = new PrismaClient();

export async function getUsers(req, res) {
  try {
    const { search, role } = req.query;
    const where = {};

    if (role) where.role = role;

    if (search) {
      where.OR = [
        { nama: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { departemen: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        nama: true,
        email: true,
        departemen: true,
        noHp: true,
        role: true,
        lateCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
