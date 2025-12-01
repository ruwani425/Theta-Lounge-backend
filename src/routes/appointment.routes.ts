// src/routes/AppointmentRoutes.ts

import { Router } from 'express';
import { createAppointment, getAppointmentCounts, getAppointmentDetails } from '../controllers/appointment.controller';

const router = Router();

router.post('/', createAppointment);
router.get('/counts', getAppointmentCounts);
router.get('/', getAppointmentDetails);
export default router;