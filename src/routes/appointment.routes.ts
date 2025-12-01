// src/routes/AppointmentRoutes.ts

import { Router } from 'express';
import { createAppointment } from '../controllers/appointment.controller';

const router = Router();

router.post('/', createAppointment);

export default router;