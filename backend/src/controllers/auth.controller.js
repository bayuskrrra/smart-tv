import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';

const prisma = new PrismaClient();

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email/Username dan password wajib diisi' });
    }

    const trimmed = email.trim();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: trimmed, mode: 'insensitive' } },
          ...(trimmed.toLowerCase() === 'admin' ? [{ role: 'ADMIN' }, { email: 'admin@admin.com' }] : [])
        ]
      }
    });
    if (!user) {
      return res.status(401).json({ error: 'Email/Username atau password salah' });
    }

    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Akses ditolak. Dashboard hanya untuk Administrator.' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }

    const payload = {
      id: user.id,
      email: user.email,
      nama: user.nama,
      role: user.role,
      departemen: user.departemen,
    };

    const accessToken = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    const refreshToken = jwt.sign({ id: user.id }, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiresIn });

    res.json({
      message: 'Login berhasil',
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        role: user.role,
        departemen: user.departemen,
        noHp: user.noHp,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token wajib diisi' });
    }

    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return res.status(401).json({ error: 'User tidak ditemukan' });
    }

    const payload = {
      id: user.id,
      email: user.email,
      nama: user.nama,
      role: user.role,
      departemen: user.departemen,
    };

    const accessToken = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    res.json({ accessToken });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token tidak valid' });
    }
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMe(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        departemen: true,
        noHp: true,
        lateCount: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }

    res.json({ user });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
