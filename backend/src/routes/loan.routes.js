import { Router } from 'express';
import {
  getLoans,
  getLoanById,
  createLoan,
  approveLoan,
  rejectLoan,
  extendLoan,
  getSchedule,
  checkAvailability,
} from '../controllers/loan.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateLoanRequest } from '../middleware/validate.js';

const router = Router();

router.use(authenticate);

router.get('/', getLoans);
router.get('/schedule', getSchedule);
router.get('/check-availability', checkAvailability);
router.get('/:id', getLoanById);
router.post('/', validateLoanRequest, createLoan);
router.put('/:id/approve', authorize('ADMIN'), approveLoan);
router.put('/:id/reject', authorize('ADMIN'), rejectLoan);
router.post('/:id/extend', extendLoan);

export default router;
