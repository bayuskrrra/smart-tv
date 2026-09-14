import { Router } from 'express';
import {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  generateQRCode,
  getAssetByKode,
} from '../controllers/asset.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { upload, setUploadSubDir } from '../middleware/upload.js';
import { validateAsset } from '../middleware/validate.js';

const router = Router();

router.use(authenticate);

router.get('/', getAssets);
router.get('/scan/:kode', getAssetByKode);
router.get('/:id', getAssetById);
router.post('/', authorize('ADMIN'), setUploadSubDir('assets'), upload.single('foto'), validateAsset, createAsset);
router.put('/:id', authorize('ADMIN'), setUploadSubDir('assets'), upload.single('foto'), updateAsset);
router.delete('/:id', authorize('ADMIN'), deleteAsset);
router.get('/:id/qrcode', authorize('ADMIN'), generateQRCode);

export default router;
