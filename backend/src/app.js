const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const routes = require('./routes');
const requestId = require('./middleware/requestId');
const sanitize = require('./middleware/sanitize');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimit');
const openapi = require('./docs/openapi');

const app = express();

app.disable('x-powered-by');
if (env.isProduction) app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const allowedOrigins = new Set([
  ...env.corsOrigins,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
app.use(requestId);
app.use(sanitize);
if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'));

app.get('/', (req, res) => {
  res.json({ success: true, data: { name: 'Hospital Management System API', docs: '/api/docs', health: '/api/health' } });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'HMS API Docs' }));
app.get('/api/docs/openapi.json', (req, res) => res.json(openapi));

app.use('/api', apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
