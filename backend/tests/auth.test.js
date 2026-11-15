const request = require('supertest');
const app = require('../src/app');
const AuditLog = require('../src/models/AuditLog');
const {
  connectTestDatabase,
  clearTestDatabase,
  disconnectTestDatabase,
} = require('./helpers/db');
const { createUser, DEFAULT_PASSWORD } = require('./helpers/factories');

describe('Authentication', () => {
  beforeAll(connectTestDatabase);
  afterAll(disconnectTestDatabase);
  beforeEach(clearTestDatabase);

  test('GET /api/health is public', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  test('logs in with valid credentials and returns a cookie plus bearer token', async () => {
    const { user } = await createUser({ role: 'ADMIN', email: 'admin@test.local' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({
      id: String(user._id),
      email: 'admin@test.local',
      role: 'ADMIN',
    });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    const cookies = res.headers['set-cookie'].join(';');
    expect(cookies).toContain('hms_token=');
    expect(cookies).toContain('HttpOnly');

    const audit = await AuditLog.findOne({ action: 'AUTH_LOGIN', outcome: 'SUCCESS' });
    expect(audit).not.toBeNull();
    expect(String(audit.actor)).toBe(String(user._id));
  });

  test('rejects wrong credentials and records a failed audit entry', async () => {
    await createUser({ role: 'ADMIN', email: 'admin@test.local' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: 'WrongPassword1!' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');

    const audit = await AuditLog.findOne({ action: 'AUTH_LOGIN', outcome: 'FAILURE' });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit.metadata)).not.toContain('WrongPassword1!');
  });

  test('rejects login for inactive accounts', async () => {
    await createUser({ role: 'RECEPTIONIST', email: 'inactive@test.local', status: 'INACTIVE' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inactive@test.local', password: DEFAULT_PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });

  test('returns the current user for a valid bearer token and rejects missing tokens', async () => {
    const { user, token } = await createUser({ role: 'RECEPTIONIST', email: 'me@test.local' });

    const ok = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.email).toBe(user.email);

    const missing = await request(app).get('/api/auth/me');
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('AUTH_TOKEN_MISSING');

    const malformed = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt');
    expect(malformed.status).toBe(401);
    expect(malformed.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });

  test('authenticates with the httpOnly cookie and clears it on logout', async () => {
    await createUser({ role: 'ADMIN', email: 'cookie@test.local' });
    const agent = request.agent(app);

    const login = await agent.post('/api/auth/login').send({ email: 'cookie@test.local', password: DEFAULT_PASSWORD });
    expect(login.status).toBe(200);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);

    const after = await agent.get('/api/auth/me');
    expect(after.status).toBe(401);
  });

  test('changes password only when the current password is correct', async () => {
    const { token } = await createUser({ role: 'ADMIN', email: 'change@test.local' });

    const wrong = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPassword1!', newPassword: 'BrandNewPass1!' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('INVALID_CURRENT_PASSWORD');

    const ok = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'BrandNewPass1!' });
    expect(ok.status).toBe(200);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'change@test.local', password: DEFAULT_PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'change@test.local', password: 'BrandNewPass1!' });
    expect(newLogin.status).toBe(200);
  });

  test('validates the login payload', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
