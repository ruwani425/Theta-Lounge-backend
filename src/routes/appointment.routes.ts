// src/routes/AppointmentRoutes.ts

import { Router } from 'express';
import { 
    createAppointment, 
    getAppointmentCounts, 
    getAppointmentDetails,
    getBookedTimesByDate,
    updateAppointmentStatus 
} from '../controllers/appointment.controller';

const router = Router();

router.post('/', createAppointment);
router.get('/counts', getAppointmentCounts);
router.get('/', getAppointmentDetails);
router.put('/:id/status', updateAppointmentStatus);
router.get("/booked-times/:date", getBookedTimesByDate)


export default router;