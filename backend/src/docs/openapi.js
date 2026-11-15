const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Hospital Management System API',
    version: '1.0.0',
    description:
      'REST API for the MERN Hospital Management System. Authentication uses an httpOnly JWT cookie or a Bearer access token.',
  },
  servers: [{ url: '/api', description: 'Current server' }],
  tags: [
    { name: 'Auth' },
    { name: 'Patients' },
    { name: 'Doctors' },
    { name: 'Departments' },
    { name: 'Staff' },
    { name: 'Schedules' },
    { name: 'Appointments' },
    { name: 'Clinical' },
    { name: 'Billing' },
    { name: 'Dashboard' },
    { name: 'Reports' },
    { name: 'Audit' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'hms_token' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate and receive a JWT',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Authenticated' }, 401: { description: 'Invalid credentials' } },
      },
    },
    '/auth/me': { get: { tags: ['Auth'], summary: 'Current authenticated user', responses: { 200: { description: 'OK' } } } },
    '/auth/logout': { post: { tags: ['Auth'], summary: 'Clear auth cookie', responses: { 200: { description: 'OK' } } } },
    '/patients': {
      get: { tags: ['Patients'], summary: 'List/search patients with pagination', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Patients'], summary: 'Register a patient', responses: { 201: { description: 'Created' } } },
    },
    '/patients/{id}': {
      get: { tags: ['Patients'], summary: 'Get patient', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } },
      put: { tags: ['Patients'], summary: 'Update patient', responses: { 200: { description: 'OK' } } },
    },
    '/patients/{id}/history': {
      get: { tags: ['Patients'], summary: 'Patient history (appointments, clinical, billing)', responses: { 200: { description: 'OK' } } },
    },
    '/doctors': {
      get: { tags: ['Doctors'], summary: 'List doctors', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Doctors'], summary: 'Create doctor account/profile', responses: { 201: { description: 'Created' } } },
    },
    '/doctors/{id}/availability': {
      get: {
        tags: ['Doctors'],
        summary: 'Available appointment slots for a date',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'date', in: 'query', required: true, schema: { type: 'string', example: '2026-06-01' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/departments': {
      get: { tags: ['Departments'], summary: 'List departments', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Departments'], summary: 'Create department', responses: { 201: { description: 'Created' } } },
    },
    '/staff': {
      get: { tags: ['Staff'], summary: 'List staff', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Staff'], summary: 'Create staff account', responses: { 201: { description: 'Created' } } },
    },
    '/schedules': {
      get: { tags: ['Schedules'], summary: 'List doctor schedules', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Schedules'], summary: 'Create schedule block', responses: { 201: { description: 'Created' } } },
    },
    '/appointments': {
      get: { tags: ['Appointments'], summary: 'List appointments', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Appointments'], summary: 'Book appointment (concurrency-safe)', responses: { 201: { description: 'Created' }, 409: { description: 'Slot taken' } } },
    },
    '/appointments/{id}': {
      get: { tags: ['Appointments'], summary: 'Get appointment', responses: { 200: { description: 'OK' } } },
    },
    '/appointments/{id}/reschedule': {
      patch: { tags: ['Appointments'], summary: 'Reschedule appointment', responses: { 200: { description: 'OK' }, 409: { description: 'Slot taken' } } },
    },
    '/appointments/{id}/cancel': {
      patch: { tags: ['Appointments'], summary: 'Cancel appointment', responses: { 200: { description: 'OK' } } },
    },
    '/appointments/{id}/status': {
      patch: { tags: ['Appointments'], summary: 'Transition appointment status', responses: { 200: { description: 'OK' }, 409: { description: 'Invalid transition' } } },
    },
    '/encounters': {
      get: { tags: ['Clinical'], summary: 'List encounters', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Clinical'], summary: 'Create encounter (doctor)', responses: { 201: { description: 'Created' } } },
    },
    '/prescriptions': {
      get: { tags: ['Clinical'], summary: 'List prescriptions', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Clinical'], summary: 'Create prescription (doctor)', responses: { 201: { description: 'Created' } } },
    },
    '/diagnostic-reports': {
      get: { tags: ['Clinical'], summary: 'List diagnostic reports', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Clinical'], summary: 'Create diagnostic report metadata (doctor)', responses: { 201: { description: 'Created' } } },
    },
    '/invoices': {
      get: { tags: ['Billing'], summary: 'List invoices', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Billing'], summary: 'Generate invoice (server-calculated totals)', responses: { 201: { description: 'Created' } } },
    },
    '/invoices/{id}': { get: { tags: ['Billing'], summary: 'Get invoice with payment history', responses: { 200: { description: 'OK' } } } },
    '/invoices/{id}/payments': {
      post: { tags: ['Billing'], summary: 'Record simulated payment', responses: { 201: { description: 'Created' }, 409: { description: 'Duplicate or overpayment' } } },
    },
    '/payments': { get: { tags: ['Billing'], summary: 'List payment transactions', responses: { 200: { description: 'OK' } } } },
    '/dashboard/admin': { get: { tags: ['Dashboard'], summary: 'Admin dashboard metrics and charts', responses: { 200: { description: 'OK' } } } },
    '/dashboard/receptionist': { get: { tags: ['Dashboard'], summary: 'Receptionist dashboard', responses: { 200: { description: 'OK' } } } },
    '/dashboard/doctor': { get: { tags: ['Dashboard'], summary: 'Doctor dashboard', responses: { 200: { description: 'OK' } } } },
    '/reports/appointments': { get: { tags: ['Reports'], summary: 'Appointment analytics report', responses: { 200: { description: 'OK' } } } },
    '/reports/revenue': { get: { tags: ['Reports'], summary: 'Revenue report', responses: { 200: { description: 'OK' } } } },
    '/reports/patients': { get: { tags: ['Reports'], summary: 'Patient registration report', responses: { 200: { description: 'OK' } } } },
    '/reports/departments': { get: { tags: ['Reports'], summary: 'Department activity report', responses: { 200: { description: 'OK' } } } },
    '/audit-logs': { get: { tags: ['Audit'], summary: 'Immutable audit trail (admin only)', responses: { 200: { description: 'OK' } } } },
  },
};

module.exports = openapi;
