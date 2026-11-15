const express = require('express');
const authRoutes = require('./auth.routes');
const patientRoutes = require('./patient.routes');
const doctorRoutes = require('./doctor.routes');
const departmentRoutes = require('./department.routes');
const staffRoutes = require('./staff.routes');
const scheduleRoutes = require('./schedule.routes');
const appointmentRoutes = require('./appointment.routes');
const { encounters, prescriptions, reports } = require('./clinical.routes');
const { invoices, payments } = require('./billing.routes');
const dashboardRoutes = require('./dashboard.routes');
const reportRoutes = require('./report.routes');
const auditRoutes = require('./audit.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/doctors', doctorRoutes);
router.use('/departments', departmentRoutes);
router.use('/staff', staffRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/encounters', encounters);
router.use('/prescriptions', prescriptions);
router.use('/diagnostic-reports', reports);
router.use('/invoices', invoices);
router.use('/payments', payments);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/audit-logs', auditRoutes);

module.exports = router;
