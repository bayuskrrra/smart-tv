import { Router } from 'express';
import { recordPickup, recordReturn, getHandoverLogs } from '../controllers/handover.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { upload, setUploadSubDir } from '../middleware/upload.js';

const router = Router();

router.use(authenticate);

router.post('/pickup/:loanId', authorize('ADMIN'), setUploadSubDir('handover'), upload.single('foto'), recordPickup);
router.post('/return/:loanId', authorize('ADMIN'), setUploadSubDir('handover'), upload.single('foto'), recordReturn);
router.get('/:loanId', getHandoverLogs);

export default router;
