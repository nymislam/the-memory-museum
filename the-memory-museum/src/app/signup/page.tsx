import { Suspense } from 'react';
import { AuthForm } from '@/components/site/AuthForm';
import { SiteHeader } from '@/components/site/Chrome';

export const metadata = { title: 'Create an account — The Memory Museum' };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="flex min-h-[80vh] items-center px-5 py-16">
        <Suspense><AuthForm mode="signup" /></Suspense>
      </main>
    </>
  );
}
