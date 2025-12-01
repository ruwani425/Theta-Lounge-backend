// src/routes/AppointmentRoutes.ts

import { Router } from 'express';
import { createAppointment, getAppointmentCounts } from '../controllers/appointment.controller';

const router = Router();

router.post('/', createAppointment);
router.get('/counts', getAppointmentCounts);

export default router;