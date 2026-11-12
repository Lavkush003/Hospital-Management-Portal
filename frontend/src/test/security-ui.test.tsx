import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { flattenNavigation } from '../components/layout/navigation';
import { Sidebar } from '../components/layout/Sidebar';
import { Badge } from '../components/ui/Badge';
import { Pagination } from '../components/ui/Pagination';
import { AuthContext, type AuthContextValue } from '../features/auth/auth-context';
import { LoginPage } from '../pages/LoginPage';
import type { SessionUser } from '../types/api';

afterEach(() => {
  cleanup();
});

function createMockAuth(userOverrides?: Partial<SessionUser> | null): AuthContextValue {
  const user: SessionUser | null =
    userOverrides === null
      ? null
      : {
          id: 'test-user-id',
          email: 'frontdesk@example.test',
          role: 'FRONT_DESK',
          status: 'ACTIVE',
          firstName: 'Test',
          lastName: 'User',
          phone: null,
          lastLoginAt: null,
          createdAt: new Date().toISOString(),
          ...userOverrides,
        };

  return {
    user,
    loading: false,
    authError: null,
    login: async () =>
      user ?? {
        id: 'new-id',
        email: 'user@example.test',
        role: 'FRONT_DESK',
        status: 'ACTIVE',
        firstName: 'Test',
        lastName: 'User',
        phone: null,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
      },
    logout: async () => {},
    clearAuthError: () => {},
  };
}

function renderWithProviders(
  ui: React.ReactElement,
  options?: { route?: string; auth?: AuthContextValue },
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const authValue = options?.auth ?? createMockAuth();

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={[options?.route ?? '/']}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('Frontend Security & Workflow Vitest / RTL Suite', () => {
  describe('Authentication UI & Validation (LoginPage)', () => {
    it('renders login form elements and security branding', () => {
      renderWithProviders(<LoginPage />, { auth: createMockAuth(null) });

      expect(screen.getAllByRole('heading', { name: /sign in/i }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in securely/i })).toBeInTheDocument();
    });

    it('validates required email and password fields on submit', () => {
      renderWithProviders(<LoginPage />, { auth: createMockAuth(null) });

      const submitButton = screen.getByRole('button', { name: /sign in securely/i });
      fireEvent.click(submitButton);

      expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    });
  });

  describe('Role-Based Navigation Scoping (Sidebar)', () => {
    it('front desk navigation excludes clinical records and administrative modules', () => {
      const frontDeskItems = flattenNavigation('FRONT_DESK');
      const destinations = frontDeskItems.map((item) => item.to);

      // Front desk can access front-desk routes
      expect(destinations).toContain('/front-desk/patients');
      expect(destinations).toContain('/front-desk/appointments');
      expect(destinations).toContain('/front-desk/billing');

      // Front desk MUST NOT have clinical records or admin routes
      expect(destinations).not.toContain('/clinician/visits');
      expect(destinations).not.toContain('/admin/staff');
      expect(destinations).not.toContain('/admin/reports');
      expect(destinations).not.toContain('/admin/audit-logs');
      expect(destinations).not.toContain('/admin/departments');
    });

    it('clinician navigation includes visits and clinical records but excludes billing and admin tabs', () => {
      const clinicianItems = flattenNavigation('CLINICIAN');
      const destinations = clinicianItems.map((item) => item.to);

      expect(destinations).toContain('/clinician/appointments');
      expect(destinations).toContain('/clinician/visits');
      expect(destinations).toContain('/clinician/notes');
      expect(destinations).toContain('/clinician/prescriptions');

      // Clinician MUST NOT have billing or admin routes
      expect(destinations).not.toContain('/front-desk/billing');
      expect(destinations).not.toContain('/admin/staff');
      expect(destinations).not.toContain('/admin/reports');
      expect(destinations).not.toContain('/admin/audit-logs');
    });

    it('admin navigation contains full system administration modules', () => {
      const adminItems = flattenNavigation('ADMIN');
      const destinations = adminItems.map((item) => item.to);

      expect(destinations).toContain('/admin/staff');
      expect(destinations).toContain('/admin/doctors');
      expect(destinations).toContain('/admin/departments');
      expect(destinations).toContain('/admin/reports');
      expect(destinations).toContain('/admin/audit-logs');
    });

    it('renders active navigation links correctly in Sidebar', () => {
      renderWithProviders(<Sidebar open={true} onClose={() => {}} />, {
        route: '/front-desk/patients',
        auth: createMockAuth({ role: 'FRONT_DESK' }),
      });

      expect(screen.getByText(/Patient directory/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Appointments/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Billing/i)).toBeInTheDocument();
      expect(screen.queryByText(/Audit logs/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Staff/i)).not.toBeInTheDocument();
    });
  });

  describe('UI Component Boundaries & Accessibility', () => {
    it('renders Badge variants accurately without crashing', () => {
      const { rerender } = render(<Badge tone="success">CONFIRMED</Badge>);
      expect(screen.getByText('CONFIRMED')).toBeInTheDocument();

      rerender(<Badge tone="danger">CANCELLED</Badge>);
      expect(screen.getByText('CANCELLED')).toBeInTheDocument();

      rerender(<Badge tone="warning">PENDING</Badge>);
      expect(screen.getByText('PENDING')).toBeInTheDocument();
    });

    it('Pagination controls handle boundary conditions correctly', () => {
      const onPageChange = () => {};
      render(
        <Pagination
          page={1}
          pageSize={10}
          total={25}
          totalPages={3}
          onPageChange={onPageChange}
        />,
      );

      // Previous button should be disabled on page 1
      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeDisabled();

      // Next button should be enabled
      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).not.toBeDisabled();
    });
  });
});
