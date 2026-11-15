import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { Button } from '../components/ui';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <FileQuestion size={30} />
      </div>
      <h1 className="mt-5 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">The page you are looking for does not exist or may have been moved.</p>
      <Link to="/" className="mt-6"><Button>Return to dashboard</Button></Link>
    </div>
  );
}
