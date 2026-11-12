import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './auth-context';
import { authApi } from '@/services/hms';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { FormError } from '@/components/feedback/FormBits';
import { useToast } from '@/components/feedback/toast-context';

export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  function reset() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setMessage('');
    setPending(false);
  }

  async function submit() {
    setError(null);
    setMessage('');
    if (newPassword.length < 12) {
      setMessage('New password must be at least 12 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('New password and confirmation do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setMessage('Choose a new password that differs from your current password.');
      return;
    }

    setPending(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      toast({
        title: 'Password changed',
        description: 'Sign in again with your new password.',
      });
      reset();
      onClose();
      await logout();
      navigate('/login', { replace: true });
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Change password"
      description="Choose a strong password with at least 12 characters."
      size="sm"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={pending}>
            Update password
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Current password" required>
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </Field>
        <Field label="New password" required hint="At least 12 characters.">
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </Field>
        <Field label="Confirm new password" required>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </Field>
        {message ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {message}
          </p>
        ) : null}
        <FormError error={error} />
        <p className="text-xs leading-5 text-slate-500">
          Changing your password signs you out of this device and clears the current refresh
          session.
        </p>
      </div>
    </Modal>
  );
}
