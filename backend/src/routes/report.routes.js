import { Router } from 'express';
import {
  getDashboard,
  getLoanReport,
  exportReport,
  getOverdueReport,
} from '../controllers/report.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/dashboard', getDashboard);
router.get('/loans', getLoanReport);
router.get('/export', exportReport);
router.get('/overdue', getOverdueReport);

export default router;
