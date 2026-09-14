import { useState, useCallback } from 'react';
import client from '../api/client';

export default function useAssets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAssets = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/assets', { params });
      setAssets(res.data.assets);
      return res.data.assets;
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Gagal memuat data aset';
      setError(errMsg);
      throw errMsg;
    } finally {
      setLoading(false);
    }
  }, []);

  const createAsset = async (formData) => {
    setLoading(true);
    try {
      const res = await client.post('/assets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.asset;
    } catch (err) {
      throw err.response?.data?.error || 'Gagal menambahkan aset';
    } finally {
      setLoading(false);
    }
  };

  const updateAsset = async (id, formData) => {
    setLoading(true);
    try {
      const res = await client.put(`/assets/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.asset;
    } catch (err) {
      throw err.response?.data?.error || 'Gagal memperbarui aset';
    } finally {
      setLoading(false);
    }
  };

  const deleteAsset = async (id) => {
    setLoading(true);
    try {
      await client.delete(`/assets/${id}`);
    } catch (err) {
      throw err.response?.data?.error || 'Gagal menghapus aset';
    } finally {
      setLoading(false);
    }
  };

  const generateQR = async (id) => {
    setLoading(true);
    try {
      const res = await client.get(`/assets/${id}/qrcode`);
      return res.data.qrCodeUrl;
    } catch (err) {
      throw err.response?.data?.error || 'Gagal membuat QR Code';
    } finally {
      setLoading(false);
    }
  };

  return {
    assets,
    loading,
    error,
    fetchAssets,
    createAsset,
    updateAsset,
    deleteAsset,
    generateQR,
  };
}
