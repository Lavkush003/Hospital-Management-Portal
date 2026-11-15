const { z, email } = require('./common');

const loginSchema = z.object({
  email: email,
  password: z.string().min(1, 'Password is required').max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

module.exports = { loginSchema, changePasswordSchema };
