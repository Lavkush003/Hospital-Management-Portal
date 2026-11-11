import { Router } from 'express';
import { accessRoutes } from '../modules/access/access.routes';
import { appointmentRoutes } from '../modules/appointments/appointment.routes';
import { authRoutes } from '../modules/auth/auth.routes';
import { departmentRoutes } from '../modules/departments/department.routes';
import { doctorRoutes } from '../modules/doctors/doctor.routes';
import { healthRoutes } from '../modules/health/health.routes';
import { patientRoutes } from '../modules/patients/patient.routes';
import { staffRoutes } from '../modules/staff/staff.routes';
import { visitRoutes } from '../modules/visits/visit.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/patients', patientRoutes);
apiRouter.use('/doctors', doctorRoutes);
apiRouter.use('/departments', departmentRoutes);
apiRouter.use('/staff', staffRoutes);
apiRouter.use('/appointments', appointmentRoutes);
apiRouter.use('/visits', visitRoutes);
apiRouter.use(accessRoutes);
