# THE MEMORY MUSEUM — LAUGNA DIGITALE

*Every love story deserves its own museum.*

A private, two-visitor 3D palace built from a couple's photographs.
Next.js · React · TypeScript · Tailwind · Three.js / React Three Fiber / Drei · Supabase.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Without any configuration the site runs in **demo mode**: open `/museum/demo`, choose a visitor and
walk. Open the same address in a second tab and enter as the other person to see two visitors together
(tabs are linked with BroadcastChannel — same browser only).

Controls: **W A S D** walk (Shift strides) · drag to look · click a frame or press **E** beside it ·
on touch screens a joystick and drag-to-look · "Test partner (arrows)" adds a second local avatar on
the arrow keys · `?room=2` starts in that room.

## Connect Supabase (accounts, uploads, real two-device multiplayer)

1. Create a free Supabase project.
2. SQL editor → paste and run `supabase/migrations/0001_init.sql`.
3. `cp .env.example .env.local` and fill in the project URL and anon key (Settings → API).
4. Sign up in the app, then make yourself an administrator in the SQL editor:
   `update public.users set role = 'admin' where email = 'you@example.com';`
5. Deploy: import the repository in Vercel and add the same two environment variables.
   In Supabase → Authentication → URL configuration, set the site URL to the Vercel address.

No service-role key is used anywhere; the browser only ever holds the public anon key.

## How it is organised

```
src/lib/types.ts                 domain types the 3D layer consumes
src/lib/palace/layout.ts         rooms + memories  →  walls, doors, frame slots, colliders
src/lib/data/museum.ts           loads a museum for a visitor (signed URLs), or the demo
src/lib/data/editor.ts           every dashboard mutation (uploads, rooms, invitations, deletion)
src/lib/net/transport.ts         multiplayer: Supabase Realtime channel / local demo transport
src/components/museum/           Palace, PhotoFrame, Avatar, Players, Controls, MemoryViewer
src/components/dashboard/        MuseumEditor (shared by customers and admins), AvatarEditor
src/app/                         landing, login, signup, dashboard, editor, invite, museum, admin
supabase/migrations/0001_init.sql  12 tables, RLS, storage + realtime policies, RPCs
```

Nothing about a couple is in the 3D code. The palace is generated from the `rooms` and `memories`
rows: add a room in the dashboard and a new gallery and corridor appear; add photographs and the
gallery lengthens to make wall space.

## Security model

- Row-level security on every table; membership helpers are `SECURITY DEFINER` functions.
- One **private** storage bucket; images are served only through signed URLs that expire.
- A museum has exactly one owner and at most one partner (unique constraint).
- Invitation tokens: 256-bit random, shown once, stored only as a SHA-256 hash, single use, 14-day expiry, revocable.
- Realtime Authorization restricts the `museum:<id>` channel to members.
- Uploads: type and size checked in the browser and again by the bucket; images are re-encoded
  (max 2048 px, EXIF/GPS stripped) before leaving the device.
- Consent is recorded for photographs (`photo_assets.consent_confirmed_at`) and avatar reference photos.
- Rate limits: invitations (10/hour/museum) and museum creation in the database; sign-in/sign-up by Supabase Auth.
- Customers cannot change their role, a museum's package or its owner (trigger).
- Deleting a museum or an account removes rows (cascade) and stored files.

## Status — what is verified and what is not

Verified in this build (production build + headless Chrome): the palace renders, walking and wall
collision, camera, arrow-key test partner, photo frames loading from data, the memory viewer (click and
E), two visitors seeing each other move through the demo transport, a departed visitor disappearing,
the touch joystick layout, and all site pages rendering.

**Not yet exercised against a live Supabase project:** the SQL migration, sign-up/sign-in, uploads,
the dashboards' save actions, invitations, and Realtime multiplayer across two devices. The code is
written against the documented APIs, but expect to fix small things on first contact.

Not built yet:
- **Payments.** Packages and limits exist; choosing one is free until Stripe (or similar) is added.
- **Photo-to-avatar generation.** Avatars are stylised figures customised by hand; a reference photo
  can be stored with consent, but no likeness is generated.
- **Blender architecture.** The palace is procedural geometry and canvas textures (zero binary assets).
  Modelled GLB rooms with compressed textures can replace `Palace.tsx` room by room.
- Server-side rendering of signed-in pages (auth is client-side; RLS is the security boundary),
  automated tests, email delivery of invitations, moderation tools.
