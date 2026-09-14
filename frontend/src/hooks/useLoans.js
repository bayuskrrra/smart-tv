import { useState, useCallback } from 'react';
import client from '../api/client';

export default function useLoans() {
  const [loans, setLoans] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLoans = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/loans', { params });
      setLoans(res.data.loans);
      setPagination(res.data.pagination || { page: 1, totalPages: 1, total: res.data.loans.length });
      return res.data.loans;
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Gagal memuat data peminjaman';
      setError(errMsg);
      throw errMsg;
    } finally {
      setLoading(false);
    }
  }, []);

  const createLoan = async (loanData) => {
    setLoading(true);
    try {
      const res = await client.post('/loans', loanData);
      return res.data.loan;
    } catch (err) {
      throw err.response?.data?.error || 'Gagal mengajukan peminjaman';
    } finally {
      setLoading(false);
    }
  };

  const approveLoan = async (id, catatanAdmin) => {
    setLoading(true);
    try {
      const res = await client.put(`/loans/${id}/approve`, { catatanAdmin });
      return res.data.loan;
    } catch (err) {
      throw err.response?.data?.error || 'Gagal menyetujui peminjaman';
    } finally {
      setLoading(false);
    }
  };

  const rejectLoan = async (id, catatanAdmin) => {
    setLoading(true);
    try {
      const res = await client.put(`/loans/${id}/reject`, { catatanAdmin });
      return res.data.loan;
    } catch (err) {
      throw err.response?.data?.error || 'Gagal menolak peminjaman';
    } finally {
      setLoading(false);
    }
  };

  const extendLoan = async (id, extendData) => {
    setLoading(true);
    try {
      const res = await client.post(`/loans/${id}/extend`, extendData);
      return res.data.extension;
    } catch (err) {
      throw err.response?.data?.error || 'Gagal memperpanjang peminjaman';
    } finally {
      setLoading(false);
    }
  };

  const recordPickup = async (loanId, formData) => {
    setLoading(true);
    try {
      const res = await client.post(`/handover/pickup/${loanId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.handoverLog;
    } catch (err) {
      throw err.response?.data?.error || 'Gagal mencatat serah terima';
    } finally {
      setLoading(false);
    }
  };

  const recordReturn = async (loanId, formData) => {
    setLoading(true);
    try {
      const res = await client.post(`/handover/return/${loanId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.handoverLog;
    } catch (err) {
      throw err.response?.data?.error || 'Gagal mencatat pengembalian';
    } finally {
      setLoading(false);
    }
  };

  return {
    loans,
    pagination,
    loading,
    error,
    fetchLoans,
    createLoan,
    approveLoan,
    rejectLoan,
    extendLoan,
    recordPickup,
    recordReturn,
  };
}
