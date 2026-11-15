import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute, RoleRoute } from './RouteGuards';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));

function renderPrivateRoute() {
  return render(
    <MemoryRouter initialEntries={['/private']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/private" element={<div>Private workspace</div>} />
        </Route>
        <Route path="/login" element={<div>Login screen</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderAdminRoute() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="/admin"
          element={<RoleRoute roles={['ADMIN']}><div>Admin workspace</div></RoleRoute>}
        />
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => useAuth.mockReset());

  it('shows a loading state while the session is restored', () => {
    useAuth.mockReturnValue({ loading: true, isAuthenticated: false });
    renderPrivateRoute();
    expect(screen.getByText('Preparing your workspace…')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', () => {
    useAuth.mockReturnValue({ loading: false, isAuthenticated: false });
    renderPrivateRoute();
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });

  it('renders the private route for authenticated users', () => {
    useAuth.mockReturnValue({ loading: false, isAuthenticated: true });
    renderPrivateRoute();
    expect(screen.getByText('Private workspace')).toBeInTheDocument();
  });
});

describe('RoleRoute', () => {
  beforeEach(() => useAuth.mockReset());

  it('blocks users without the required role', () => {
    useAuth.mockReturnValue({ user: { role: 'RECEPTIONIST' } });
    renderAdminRoute();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('allows users with the required role', () => {
    useAuth.mockReturnValue({ user: { role: 'ADMIN' } });
    renderAdminRoute();
    expect(screen.getByText('Admin workspace')).toBeInTheDocument();
  });
});
