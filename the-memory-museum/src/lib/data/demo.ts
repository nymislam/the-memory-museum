import type { AvatarConfig, MemoryData, MuseumData, RoomData } from '../types';

/**
 * Demo museum. It has exactly the same shape as a museum loaded from Supabase,
 * so the 3D experience can be explored before a backend exists. The "photographs"
 * are generated placeholder artworks — no real images are bundled.
 */

const PALETTES = [
  ['#E9C9A0', '#B5723F', '#4A3525'],
  ['#F1D9C0', '#C98B7A', '#5B3040'],
  ['#D7E0E4', '#7C98A8', '#283845'],
  ['#EFE2B8', '#C6A36B', '#4A3525'],
  ['#E6D3DC', '#A9788F', '#3B2533'],
  ['#DCE5D2', '#8AA07A', '#2F3B2A'],
];

function artwork(seed: number, portrait: boolean, label: string): { url: string; w: number; h: number } {
  const w = portrait ? 900 : 1350;
  const h = portrait ? 1200 : 900;
  const [a, b, c] = PALETTES[seed % PALETTES.length];
  const sunX = 0.25 * w + ((seed * 137) % (w * 0.5));
  const sunY = 0.22 * h + ((seed * 53) % (h * 0.12));
  const ridge = (off: number, amp: number) => {
    let d = `M0 ${h}`;
    for (let i = 0; i <= 8; i++) {
      const y = h * off + Math.sin(i * 1.3 + seed) * amp + Math.cos(i * 0.7 + seed * 2) * amp * 0.5;
      d += ` L${(w / 8) * i} ${y.toFixed(0)}`;
    }
    return `${d} L${w} ${h} Z`;
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<circle cx="${sunX.toFixed(0)}" cy="${sunY.toFixed(0)}" r="${(h * 0.09).toFixed(0)}" fill="#fff" opacity=".55"/>
<path d="${ridge(0.62, h * 0.05)}" fill="${b}" opacity=".7"/>
<path d="${ridge(0.74, h * 0.04)}" fill="${c}" opacity=".75"/>
<path d="${ridge(0.86, h * 0.03)}" fill="${c}"/>
<text x="${w / 2}" y="${h * 0.95}" text-anchor="middle" font-family="Georgia,serif" font-size="${h * 0.035}" fill="#F3EBDD" opacity=".85" letter-spacing="6">${label.toUpperCase()}</text>
</svg>`;
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, w, h };
}

const rooms: RoomData[] = [
  { id: 'r-entrance', kind: 'entrance', title: 'The Grand Entrance', subtitle: 'Welcome', position: 0, width: 16, depth: 14, height: 8, wallColor: '#F3EBDD' },
  { id: 'r-first', kind: 'first_memories', title: 'The First Memories Gallery', subtitle: 'Where it began', position: 1, width: 13, depth: 16, height: 6.5, wallColor: '#EFE4D2' },
  { id: 'r-love', kind: 'love', title: 'The Love Gallery', subtitle: 'The years between', position: 2, width: 14, depth: 18, height: 7, wallColor: '#EADBCB' },
  { id: 'r-journey', kind: 'journey', title: 'The Journey Gallery', subtitle: 'Everywhere, together', position: 3, width: 13, depth: 16, height: 6.5, wallColor: '#DDCFBB' },
  { id: 'r-final', kind: 'final', title: 'The Final Memory Room', subtitle: 'For you', position: 4, width: 14, depth: 14, height: 8, wallColor: '#4A3525' },
];

const seedMemories: [string, string, string, string, string, boolean][] = [
  ['r-first', 'The first evening', '2021-02-14', 'A table by the window, and a conversation that did not want to end.', 'I remember deciding, somewhere around dessert, that I would like to know you for a very long time.', false],
  ['r-first', 'The walk home', '2021-02-27', 'Four kilometres on foot because neither of us suggested the tram.', '', true],
  ['r-first', 'First photograph together', '2021-03-21', 'Slightly out of focus. Entirely perfect.', '', false],
  ['r-first', 'The note on the door', '2021-04-09', '“Back in ten minutes. Missing you already.”', 'I kept it. It is in the drawer with the tickets.', true],
  ['r-love', 'One year', '2022-02-14', 'The same table by the same window.', 'A year felt like a week, and I would do every day of it again.', true],
  ['r-love', 'Sunday mornings', '2022-06-05', 'Coffee, the radio, nothing to do.', '', false],
  ['r-love', 'The surprise', '2022-09-18', 'You pretended not to know. Thank you for that.', '', false],
  ['r-love', 'Two years', '2023-02-14', 'Rain all day. We stayed in and cooked.', 'This is the day I knew what home meant.', true],
  ['r-love', 'Dancing in the kitchen', '2023-08-02', 'No music, technically.', '', false],
  ['r-love', 'The letter', '2023-12-24', 'Three pages, front and back.', 'I meant every line of it.', true],
  ['r-journey', 'The lake', '2022-07-16', 'Up before sunrise for a view we nearly missed.', '', false],
  ['r-journey', 'Night train', '2022-10-29', 'Two bunks, one window, eleven hours.', '', true],
  ['r-journey', 'The island', '2023-05-13', 'The last ferry back, with seconds to spare.', 'Next time we stay the night.', false],
  ['r-journey', 'Mountains', '2024-01-06', 'Snow up to our knees and tea from a flask.', '', false],
  ['r-final', 'Our favourite', '2024-02-14', 'If I could keep only one photograph, it would be this one.', 'Thank you for every day so far. Here is to all the rooms we have not built yet.', false],
];

const memories: MemoryData[] = seedMemories.map(([roomId, title, date, caption, message, portrait], i) => {
  const art = artwork(i + 1, portrait, title);
  return {
    id: `m-${i}`, roomId, title, caption, message, date, position: i, kind: 'photo',
    imageUrl: art.url, videoUrl: null, width: art.w, height: art.h,
  };
});

export const DEMO_MUSEUM: MuseumData = {
  id: 'demo',
  slug: 'demo',
  name: 'The Museum of Aurelia & Matteo',
  status: 'published',
  plan: 'premium',
  partnerOne: 'Aurelia',
  partnerTwo: 'Matteo',
  anniversary: '2021-02-14',
  welcomeMessage: 'Everything in these rooms happened to us. Take your time, and take my hand.',
  finalMessage: 'You are my favourite memory, and the one I am still making. I love you.',
  musicUrl: null,
  musicVolume: 0.4,
  rooms,
  memories,
};

export const DEMO_AVATARS: [AvatarConfig, AvatarConfig] = [
  { skin: '#E3B590', hair: '#3A2418', hairStyle: 'long', outfit: 'dress', outfitColor: '#7A2E3A', accentColor: '#C6A36B', height: 0.97 },
  { skin: '#C99873', hair: '#17130F', hairStyle: 'short', outfit: 'suit', outfitColor: '#1E2430', accentColor: '#C6A36B', height: 1.04 },
];
