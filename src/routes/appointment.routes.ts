// src/routes/AppointmentRoutes.ts

import { Router } from 'express';
import { 
    createAppointment, 
    getAppointmentCounts, 
    getAppointmentDetails,
    updateAppointmentStatus 
} from '../controllers/appointment.controller';

const router = Router();

router.post('/', createAppointment);
router.get('/counts', getAppointmentCounts);
router.get('/', getAppointmentDetails);
router.put('/:id/status', updateAppointmentStatus);

export default router;