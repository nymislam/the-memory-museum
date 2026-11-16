'use client';
import { useParams } from 'next/navigation';
import { MuseumEditor } from '@/components/dashboard/MuseumEditor';
import { Protected, SiteHeader } from '@/components/site/Chrome';

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <SiteHeader />
      <Protected>{(s) => <MuseumEditor museumId={id} userId={s.session!.user.id} isAdmin={s.role === 'admin'} />}</Protected>
    </>
  );
}
