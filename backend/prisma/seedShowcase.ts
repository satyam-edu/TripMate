import { PrismaClient, type RequestStatus } from '@prisma/client';
import * as dotenv from 'dotenv';
import { findCoverImage } from '../src/services/coverImage';
import { uniqueTripSlug } from '../src/controllers/trip.controller';

dotenv.config();

const prisma = new PrismaClient();

/**
 * Showcase data: Indian trips (famous + offbeat), demo travellers, and activity on every real
 * account (hosted, joined, completed trips, requests, chats, reviews, notifications).
 * Additive and re-runnable: it first removes only what a previous run created.
 *
 *   npm run seed:showcase           → clean previous showcase data, then seed
 *   npm run seed:showcase -- --clean → only clean
 */

// Real accounts we leave untouched (not the owner's).
const SKIP_ACCOUNTS = ['Avinash Pandey Official'];

const DAY = 24 * 60 * 60 * 1000;
const today = new Date(new Date().toISOString().slice(0, 10));
const day = (offset: number) => new Date(today.getTime() + offset * DAY);
const ago = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);
const pick = <T>(list: T[], i: number): T => list[i % list.length]!;

/* ── Demo travellers ──────────────────────────────────────────────────────────── */
const portrait = (g: 'women' | 'men', n: number) => `https://randomuser.me/api/portraits/${g}/${n}.jpg`;
const DEMO_USERS = [
  { key: 'aditi', name: 'Aditi Sharma', gender: 'Woman', avatar: portrait('women', 44), location: 'Jaipur, Rajasthan', bio: 'Heritage walks, street food and long train rides. 19 states down.', tags: ['Sightseeing', 'Food & Cafés'], verified: true },
  { key: 'arjun', name: 'Arjun Reddy', gender: 'Man', avatar: portrait('men', 32), location: 'Hyderabad, Telangana', bio: 'Weekend trekker, weekday coder. Always up for a sunrise summit.', tags: ['Trekking', 'Photography'], verified: true },
  { key: 'nisha', name: 'Nisha Das', gender: 'Woman', avatar: portrait('women', 68), location: 'Guwahati, Assam', bio: 'Northeast is my backyard. Happy to show you the hidden corners.', tags: ['Photography', 'Relaxation'], verified: true },
  { key: 'vikram', name: 'Vikram Rathore', gender: 'Man', avatar: portrait('men', 46), location: 'Jodhpur, Rajasthan', bio: 'Road trips in an old Thar. Desert nights > city lights.', tags: ['Sightseeing', 'Nightlife'], verified: false },
  { key: 'sneha', name: 'Sneha Kulkarni', gender: 'Woman', avatar: portrait('women', 21), location: 'Pune, Maharashtra', bio: 'Monsoon chaser. Forts, waterfalls and vada pav.', tags: ['Trekking', 'Food & Cafés'], verified: true },
  { key: 'rahul', name: 'Rahul Verma', gender: 'Man', avatar: portrait('men', 12), location: 'Lucknow, Uttar Pradesh', bio: 'History nerd. I will tell you the story behind every ruin.', tags: ['Sightseeing', 'Photography'], verified: false },
  { key: 'tenzin', name: 'Tenzin Dolma', gender: 'Woman', avatar: portrait('women', 90), location: 'Dharamshala, Himachal Pradesh', bio: 'Mountain girl. Monasteries, momos and slow mornings.', tags: ['Relaxation', 'Trekking'], verified: true },
  { key: 'farhan', name: 'Farhan Qureshi', gender: 'Man', avatar: portrait('men', 75), location: 'Mumbai, Maharashtra', bio: 'Scuba diver and beach bum. Ask me about the Andamans.', tags: ['Beach Time', 'Nightlife'], verified: true },
  { key: 'lakshmi', name: 'Lakshmi Menon', gender: 'Woman', avatar: portrait('women', 33), location: 'Kochi, Kerala', bio: 'Backwaters, temples and tea estates. Kerala local, India explorer.', tags: ['Relaxation', 'Food & Cafés'], verified: true },
  { key: 'karan', name: 'Karan Gill', gender: 'Man', avatar: portrait('men', 52), location: 'Chandigarh, Punjab', bio: 'Bikes, mountains and dhaba parathas. Ladakh 4 times and counting.', tags: ['Trekking', 'Shopping'], verified: false },
  { key: 'ishita', name: 'Ishita Banerjee', gender: 'Woman', avatar: portrait('women', 57), location: 'Kolkata, West Bengal', bio: 'Wildlife photographer. Patient enough to wait 6 hours for a tiger.', tags: ['Photography', 'Sightseeing'], verified: true },
  { key: 'dev', name: 'Dev Patel', gender: 'Man', avatar: portrait('men', 64), location: 'Ahmedabad, Gujarat', bio: 'Festival hopper. Rann Utsav, Hornbill, Ziro: been there, danced there.', tags: ['Nightlife', 'Food & Cafés'], verified: false },
] as const;
type DemoKey = (typeof DEMO_USERS)[number]['key'];

/* ── Trips ─────────────────────────────────────────────────────────────────────── */
// `place` is what we look up on Wikipedia for the cover photo.
interface TripSeed {
  title: string;
  place: string;
  state: string;
  start: number; // days from today
  nights: number;
  budget: number;
  maxGuests: number;
  tags: string[];
  description: string;
  womenOnly?: boolean;
}

const UPCOMING: TripSeed[] = [
  { title: 'Ziro Valley Music Festival', place: 'Ziro', state: 'Arunachal Pradesh', start: 9, nights: 4, budget: 24000, maxGuests: 6, tags: ['Culture', 'Nightlife', 'Photography'], description: 'Four days of indie music in rice fields, Apatani villages and bamboo camps. Inner Line Permit sorted together.' },
  { title: 'Gokarna Beach Trek', place: 'Gokarna', state: 'Karnataka', start: 12, nights: 3, budget: 9000, maxGuests: 6, tags: ['Beaches', 'Trekking', 'Beach Time'], description: 'Walk the cliff trail from Kudle to Half Moon and Paradise beach. Hammocks, shacks and sunsets.' },
  { title: 'Chopta, Tungnath & Chandrashila', place: 'Tungnath', state: 'Uttarakhand', start: 16, nights: 4, budget: 12000, maxGuests: 8, tags: ['Mountains', 'Trekking', 'Photography'], description: 'The highest Shiva temple in the world and a 360° Himalayan sunrise from Chandrashila summit. Beginner friendly.' },
  { title: 'Majuli River Island Stay', place: 'Majuli', state: 'Assam', start: 20, nights: 3, budget: 14000, maxGuests: 5, tags: ['Culture', 'Relaxation', 'Photography'], description: 'The world’s largest river island: satras, mask making, Mishing homestays and Brahmaputra sunsets.' },
  { title: 'Meghalaya Living Root Bridges', place: 'Living root bridge', state: 'Meghalaya', start: 24, nights: 5, budget: 21000, maxGuests: 6, tags: ['Adventure', 'Trekking', 'Photography'], description: 'Nongriat double-decker bridge, Rainbow Falls, Dawki’s glass-clear river and Mawlynnong village.' },
  { title: 'Tawang Monastery Road Trip', place: 'Tawang', state: 'Arunachal Pradesh', start: 30, nights: 6, budget: 32000, maxGuests: 5, tags: ['Road Trip', 'Mountains', 'Sightseeing'], description: 'Sela Pass, Jaswant Garh, Madhuri Lake and the 400-year-old Tawang Monastery. Shared SUV from Guwahati.' },
  { title: 'Rann Utsav under the Full Moon', place: 'Rann of Kutch', state: 'Gujarat', start: 35, nights: 3, budget: 26000, maxGuests: 8, tags: ['Culture', 'Road Trip', 'Shopping'], description: 'White desert at full moon, tent city, Kala Dungar and the craft villages of Hodka and Bhujodi.' },
  { title: 'Varanasi Ghats & Sarnath', place: 'Varanasi', state: 'Uttar Pradesh', start: 14, nights: 3, budget: 11000, maxGuests: 6, tags: ['Culture', 'Sightseeing', 'Food & Cafés'], description: 'Dawn boat ride, Ganga aarti at Dashashwamedh, kachori gali breakfasts and a day at Sarnath.' },
  { title: 'Havelock Island Scuba', place: 'Swaraj Dweep', state: 'Andaman & Nicobar', start: 40, nights: 5, budget: 38000, maxGuests: 6, tags: ['Beaches', 'Adventure', 'Beach Time'], description: 'Radhanagar beach, beginner scuba at Elephant beach and a night kayak through bioluminescence.' },
  { title: 'Coorg Coffee Trail', place: 'Kodagu district', state: 'Karnataka', start: 18, nights: 3, budget: 13000, maxGuests: 6, tags: ['Mountains', 'Relaxation', 'Food & Cafés'], description: 'Plantation homestay, Abbey Falls, Dubare elephant camp and a lot of filter coffee.' },
  { title: 'Jaisalmer Desert Camp', place: 'Jaisalmer', state: 'Rajasthan', start: 27, nights: 3, budget: 15000, maxGuests: 8, tags: ['Road Trip', 'Culture', 'Nightlife'], description: 'Living fort, Patwon ki Haveli, Sam dunes at sunset and a night of folk music under the stars.' },
  { title: 'Gurez Valley Escape', place: 'Gurez', state: 'Jammu & Kashmir', start: 45, nights: 5, budget: 27000, maxGuests: 5, tags: ['Mountains', 'Road Trip', 'Photography'], description: 'Hidden valley on the Kishanganga: Habba Khatoon peak, wooden villages and almost no tourists.' },
  { title: 'Dzükou Valley Trek', place: 'Dzüko Valley', state: 'Nagaland', start: 33, nights: 3, budget: 16000, maxGuests: 6, tags: ['Adventure', 'Trekking', 'Mountains'], description: 'Rolling green valley above Kohima, camping at the rest house and a stop at Khonoma green village.' },
  { title: 'Gandikota Canyon Camping', place: 'Gandikota', state: 'Andhra Pradesh', start: 11, nights: 2, budget: 7000, maxGuests: 8, tags: ['Adventure', 'Road Trip', 'Photography'], description: 'India’s Grand Canyon: sunrise over the Penna gorge, the old fort and a night camping on the rim.' },
  { title: 'Lonar Crater Weekend', place: 'Lonar crater', state: 'Maharashtra', start: 8, nights: 2, budget: 6000, maxGuests: 6, tags: ['Adventure', 'Sightseeing'], description: 'A 50,000-year-old meteor crater lake, ancient temples on the rim and a stop at the Ajanta caves.' },
  { title: 'Chettinad Mansions & Food Trail', place: 'Chettinad', state: 'Tamil Nadu', start: 22, nights: 3, budget: 17000, maxGuests: 6, tags: ['Culture', 'Food & Cafés', 'Photography'], description: 'Stay in a 100-year-old mansion, Athangudi tile workshops and the spiciest chicken of your life.' },
  { title: 'Valley of Flowers Trek', place: 'Valley of Flowers National Park', state: 'Uttarakhand', start: 52, nights: 6, budget: 19000, maxGuests: 8, tags: ['Mountains', 'Trekking', 'Photography'], description: 'Ghangaria base, the Valley of Flowers and Hemkund Sahib. Early booking for the season opener.' },
  { title: 'Munnar Tea Gardens', place: 'Munnar', state: 'Kerala', start: 15, nights: 3, budget: 12500, maxGuests: 6, tags: ['Mountains', 'Relaxation', 'Photography'], description: 'Tea estates, Eravikulam park, Top Station views and a cooking class with a local family.' },
  { title: 'Kaziranga Rhino Safari', place: 'Kaziranga National Park', state: 'Assam', start: 26, nights: 3, budget: 22000, maxGuests: 3, tags: ['Wildlife', 'Photography'], description: 'Elephant and jeep safaris for one-horned rhinos, tea garden walk and Assamese thali night.' },
];
const WOMEN_ONLY: TripSeed = { title: 'Pondicherry & Auroville Girls Trip', place: 'Pondicherry', state: 'Puducherry', start: 19, nights: 3, budget: 14000, maxGuests: 6, tags: ['Beaches', 'Culture', 'Food & Cafés'], description: 'French quarter cafés, cycling to Auroville, Paradise beach and a sunrise yoga session. Women only.', womenOnly: true };
const ONGOING: TripSeed = { title: 'Chikmagalur Coffee Hills', place: 'Chikmagalur', state: 'Karnataka', start: -1, nights: 4, budget: 11000, maxGuests: 6, tags: ['Mountains', 'Relaxation'], description: 'Mullayanagiri summit, Hebbe falls and a lazy plantation stay. Happening right now!' };
const COMPLETED: TripSeed[] = [
  { title: 'Hampi Boulder Trails', place: 'Hampi', state: 'Karnataka', start: -40, nights: 3, budget: 9500, maxGuests: 6, tags: ['Culture', 'Adventure', 'Sightseeing'], description: 'Virupaksha temple, coracle rides, Matanga hill sunrise and bouldering on the other side of the river.' },
  { title: 'Rishikesh Yoga & Rafting', place: 'Rishikesh', state: 'Uttarakhand', start: -55, nights: 3, budget: 8000, maxGuests: 8, tags: ['Adventure', 'Relaxation'], description: '16 km rafting from Shivpuri, cliff jumping, Beatles ashram and evening aarti at Triveni Ghat.' },
  { title: 'Darjeeling Toy Train & Tea', place: 'Darjeeling', state: 'West Bengal', start: -70, nights: 4, budget: 16000, maxGuests: 6, tags: ['Mountains', 'Sightseeing'], description: 'Tiger Hill sunrise over Kanchenjunga, the toy train, Happy Valley tea estate and Glenary’s breakfasts.' },
  { title: 'Pushkar Camel Fair', place: 'Pushkar', state: 'Rajasthan', start: -25, nights: 2, budget: 7500, maxGuests: 6, tags: ['Culture', 'Photography', 'Shopping'], description: 'The colours of the camel fair, Brahma temple, ghats at sunset and rooftop cafés.' },
  { title: 'Sundarbans Mangrove Cruise', place: 'Sundarbans', state: 'West Bengal', start: -85, nights: 3, budget: 14500, maxGuests: 6, tags: ['Wildlife', 'Photography'], description: 'Boat stay in the mangroves, watchtowers, crocodiles and (if we are lucky) a Royal Bengal tiger.' },
  { title: 'Kanha Tiger Safari', place: 'Kanha Tiger Reserve', state: 'Madhya Pradesh', start: -100, nights: 3, budget: 23000, maxGuests: 5, tags: ['Wildlife', 'Photography'], description: 'Four jeep safaris in the land of the Jungle Book. Barasingha, gaur and two tiger sightings.' },
  { title: 'Khajjiar & Dalhousie', place: 'Khajjiar', state: 'Himachal Pradesh', start: -30, nights: 3, budget: 10500, maxGuests: 6, tags: ['Mountains', 'Relaxation'], description: '“Mini Switzerland” meadows, deodar forests, Dainkund peak and colonial Dalhousie.' },
  { title: 'Mandu Monsoon Ruins', place: 'Mandu, Madhya Pradesh', state: 'Madhya Pradesh', start: -60, nights: 2, budget: 6500, maxGuests: 6, tags: ['Culture', 'Sightseeing', 'Photography'], description: 'Jahaz Mahal floating in monsoon green, Rani Roopmati’s pavilion and the Afghan-era city of joy.' },
];
// Hosted by the real accounts (one upcoming + one completed each).
const REAL_UPCOMING: TripSeed[] = [
  { title: 'Kedarkantha Winter Trek', place: 'Kedarkantha', state: 'Uttarakhand', start: 38, nights: 5, budget: 13500, maxGuests: 6, tags: ['Mountains', 'Trekking'], description: 'Snow trek through pine forests to a 12,500 ft summit. Perfect first Himalayan trek.' },
  { title: 'Bir Billing Paragliding', place: 'Bir, Himachal Pradesh', state: 'Himachal Pradesh', start: 21, nights: 3, budget: 10000, maxGuests: 6, tags: ['Adventure', 'Mountains'], description: 'Tandem paragliding from Billing, Tibetan colony cafés and a monastery walk.' },
  { title: 'McLeodganj & Triund', place: 'Triund', state: 'Himachal Pradesh', start: 13, nights: 3, budget: 8500, maxGuests: 6, tags: ['Mountains', 'Trekking', 'Food & Cafés'], description: 'Overnight at Triund ridge facing the Dhauladhars, then cafés and the Dalai Lama temple.' },
  { title: 'Ooty Nilgiri Toy Train', place: 'Ooty', state: 'Tamil Nadu', start: 29, nights: 3, budget: 11000, maxGuests: 5, tags: ['Mountains', 'Relaxation', 'Sightseeing'], description: 'Nilgiri Mountain Railway from Mettupalayam, botanical gardens, Pykara lake and tea factories.' },
  { title: 'Orchha Hidden Temples', place: 'Orchha', state: 'Madhya Pradesh', start: 17, nights: 2, budget: 7000, maxGuests: 6, tags: ['Culture', 'Sightseeing', 'Photography'], description: 'The underrated town of cenotaphs and palaces on the Betwa river. Sound and light show included.' },
  { title: 'Auli Snow Weekend', place: 'Auli', state: 'Uttarakhand', start: 48, nights: 3, budget: 15500, maxGuests: 6, tags: ['Mountains', 'Adventure'], description: 'Ropeway, beginner skiing on the slopes and Nanda Devi views from Gorson Bugyal.' },
];
const REAL_COMPLETED: TripSeed[] = [
  { title: 'Nainital Lake Weekend', place: 'Nainital', state: 'Uttarakhand', start: -35, nights: 2, budget: 7000, maxGuests: 6, tags: ['Mountains', 'Relaxation'], description: 'Boating on Naini lake, Snow View point, Mall Road and a day trip to Bhimtal.' },
  { title: 'Amritsar Golden Temple Trip', place: 'Golden Temple', state: 'Punjab', start: -50, nights: 2, budget: 6000, maxGuests: 6, tags: ['Culture', 'Food & Cafés'], description: 'Langar seva, the temple at night, Wagah border ceremony and Kesar da Dhaba.' },
  { title: 'Agra & Fatehpur Sikri', place: 'Fatehpur Sikri', state: 'Uttar Pradesh', start: -45, nights: 2, budget: 7500, maxGuests: 6, tags: ['Culture', 'Sightseeing'], description: 'Taj Mahal at sunrise, Agra Fort and the abandoned Mughal capital of Fatehpur Sikri.' },
  { title: 'Lansdowne Quiet Escape', place: 'Lansdowne', state: 'Uttarakhand', start: -28, nights: 2, budget: 6500, maxGuests: 5, tags: ['Mountains', 'Relaxation'], description: 'A sleepy cantonment town: Tip-n-Top viewpoint, Bhulla Tal and long forest walks.' },
  { title: 'Mahabaleshwar Strawberry Trail', place: 'Mahabaleshwar', state: 'Maharashtra', start: -65, nights: 2, budget: 8000, maxGuests: 6, tags: ['Mountains', 'Food & Cafés'], description: 'Strawberry farms, Pratapgad fort, Venna lake and the best mulberry cream in Maharashtra.' },
  { title: 'Bhopal & Bhimbetka', place: 'Bhimbetka rock shelters', state: 'Madhya Pradesh', start: -75, nights: 2, budget: 6500, maxGuests: 6, tags: ['Culture', 'Sightseeing'], description: '30,000-year-old rock paintings at Bhimbetka, Sanchi stupa and the lakes of Bhopal.' },
];

/* ── Chat lines ────────────────────────────────────────────────────────────────── */
const GROUP_CHAT = [
  'Hey everyone! So excited for this one 🙌',
  'Same! Has anyone booked their train/flight yet?',
  'I’m taking the overnight train, reaching a day early.',
  'Let’s make a packing list. Warm layers + power bank for sure.',
  'I can carry a first-aid kit and a speaker 🎶',
  'Budget update: stays are confirmed, sharing the split sheet tonight.',
  'Perfect. See you all at the meeting point!',
];
const INQUIRY_CHAT = [
  'Hi! Is this trip okay for a first-timer?',
  'Absolutely, the pace is easy and we’ll take breaks. Have you trekked before?',
  'Only short day hikes, but I’m fit and very keen 😄',
  'That works. I’ll review your request today!',
];
const REVIEW_TEXT = [
  'Super organised host, every day was planned but never rushed. Would travel again!',
  'Great company and full of good stories. Made the trip 10x better.',
  'Punctual, friendly and split costs fairly. 10/10 travel buddy.',
  'Knew all the local spots. The food recommendations alone were worth it.',
  'Chill vibe, helpful on the tough stretches. Highly recommend.',
];
const PITCHES = [
  'I’ve been wanting to do this one for years. Easygoing, punctual and I bring snacks 🙂',
  'Solo traveller from Delhi, done a few Himalayan treks. Would love to join!',
  'Photography is my thing, happy to click everyone’s pictures 📸',
  'Looking for a fun group for this. I can help with planning and bookings.',
];

/* ── Cleanup of a previous run ─────────────────────────────────────────────────── */
async function clean(realIds: string[]) {
  const demoUsers = await prisma.user.findMany({ where: { googleId: { startsWith: 'demo-' } }, select: { id: true } });
  const demoIds = demoUsers.map((u) => u.id);
  const realTitles = [...REAL_UPCOMING, ...REAL_COMPLETED].map((t) => t.title);
  const trips = await prisma.trip.findMany({
    where: { OR: [{ hostId: { in: demoIds } }, { hostId: { in: realIds }, destination: { in: realTitles } }] },
    select: { id: true },
  });
  const tripIds = trips.map((t) => t.id);

  await prisma.message.deleteMany({ where: { OR: [{ tripId: { in: tripIds } }, { senderId: { in: demoIds } }] } });
  await prisma.review.deleteMany({ where: { tripId: { in: tripIds } } });
  await prisma.request.deleteMany({ where: { OR: [{ tripId: { in: tripIds } }, { userId: { in: demoIds } }] } });
  await prisma.trip.deleteMany({ where: { id: { in: tripIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: realIds }, text: { startsWith: '​' } } }); // zero-width marker
  await prisma.user.deleteMany({ where: { id: { in: demoIds } } }); // cascades their notifications, reviews, chat reads
  console.log(`🧹  Removed previous showcase data (${tripIds.length} trips, ${demoIds.length} demo users).`);
}

/* ── Seed ──────────────────────────────────────────────────────────────────────── */
async function main(): Promise<void> {
  const realUsers = await prisma.user.findMany({
    where: { NOT: [{ googleId: { startsWith: 'seed-' } }, { googleId: { startsWith: 'demo-' } }, { name: { in: SKIP_ACCOUNTS } }] },
    orderBy: { createdAt: 'asc' },
  });
  const realIds = realUsers.map((u) => u.id);
  await clean(realIds);
  if (process.argv.includes('--clean')) return;

  // Older seed users were saved with "Female"/"Male"; the app uses "Woman"/"Man".
  await prisma.user.updateMany({ where: { gender: 'Female' }, data: { gender: 'Woman' } });
  await prisma.user.updateMany({ where: { gender: 'Male' }, data: { gender: 'Man' } });

  const demo = {} as Record<DemoKey, { id: string; name: string }>;
  for (const u of DEMO_USERS) {
    const { key, verified, ...data } = u;
    demo[key] = await prisma.user.create({
      data: { ...data, tags: [...data.tags], googleId: `demo-${key}`, phoneVerified: verified, verified },
      select: { id: true, name: true },
    });
  }
  const demoList = Object.values(demo);
  const women = DEMO_USERS.filter((u) => u.gender === 'Woman').map((u) => demo[u.key]);
  console.log(`👤  ${demoList.length} demo travellers.`);

  const createTrip = async (t: TripSeed, hostId: string) => {
    const startDate = day(t.start);
    const trip = await prisma.trip.create({
      data: {
        hostId,
        destination: t.title,
        country: t.state,
        startDate,
        endDate: new Date(startDate.getTime() + t.nights * DAY),
        budget: t.budget,
        maxGuests: t.maxGuests,
        tags: t.tags,
        description: t.description,
        womenOnly: t.womenOnly ?? false,
        coverImage: await findCoverImage(t.place, t.state),
        slug: await uniqueTripSlug(t.title),
        createdAt: ago(24 * Math.max(1, 30 - t.start)), // posted ~a month before it starts
      },
    });
    console.log(`   🧭 ${t.title}${trip.coverImage?.includes('picsum') ? '  (no Wikipedia photo, random cover)' : ''}`);
    return trip;
  };
  const request = (tripId: string, userId: string, status: RequestStatus, hoursAgo: number, i = 0) =>
    prisma.request.create({ data: { tripId, userId, status, message: pick(PITCHES, i), createdAt: ago(hoursAgo) } });
  const groupChat = async (tripId: string, people: string[], lines = GROUP_CHAT.length, startHoursAgo = 30) => {
    for (let i = 0; i < lines; i++) {
      await prisma.message.create({
        data: { tripId, senderId: pick(people, i), text: GROUP_CHAT[i]!, createdAt: ago(startHoursAgo - i * 3) },
      });
    }
  };
  const review = (tripId: string, reviewerId: string, revieweeId: string, i: number, rating = 5) =>
    prisma.review.create({ data: { tripId, reviewerId, revieweeId, rating, text: pick(REVIEW_TEXT, i), createdAt: ago(48 + i) } });
  const notify = (userId: string, type: 'NEW_REQUEST' | 'REQUEST_APPROVED' | 'REQUEST_DECLINED' | 'REVIEW_RECEIVED', text: string, link: string, hoursAgo: number, read = false) =>
    prisma.notification.create({ data: { userId, type, text: `​${text}`, link, read, createdAt: ago(hoursAgo) } });

  // ── Demo-hosted trips (the public feed) ─────────────────────────────────────
  console.log('🗺️   Trips:');
  const upcoming = [];
  for (const [i, t] of UPCOMING.entries()) {
    const host = pick(demoList, i);
    const trip = await createTrip(t, host.id);
    // A couple of demo travellers already going + one waiting, so cards look alive.
    const others = demoList.filter((u) => u.id !== host.id);
    const going = t.maxGuests === 3 ? 2 : (i % 3) + 1; // Kaziranga (max 3) ends up full
    for (let g = 0; g < going; g++) await request(trip.id, pick(others, i + g).id, 'APPROVED', 100 + g, g);
    if (t.maxGuests !== 3) await request(trip.id, pick(others, i + going).id, 'PENDING', 20, i);
    if (i % 2 === 0) await groupChat(trip.id, [host.id, ...others.slice(0, going).map((u) => u.id)], 4, 60);
    upcoming.push({ trip, host });
  }
  const womenTrip = await createTrip(WOMEN_ONLY, women[0]!.id);
  await request(womenTrip.id, women[1]!.id, 'APPROVED', 70);
  await request(womenTrip.id, women[2]!.id, 'APPROVED', 65);
  const ongoing = await createTrip(ONGOING, demo.lakshmi.id);
  await request(ongoing.id, demo.arjun.id, 'APPROVED', 200);
  await request(ongoing.id, demo.sneha.id, 'APPROVED', 190);
  await groupChat(ongoing.id, [demo.lakshmi.id, demo.arjun.id, demo.sneha.id], GROUP_CHAT.length, 24);

  const completed = [];
  for (const [i, t] of COMPLETED.entries()) {
    const host = pick(demoList, i + 5);
    const trip = await createTrip(t, host.id);
    const others = demoList.filter((u) => u.id !== host.id);
    const crew = [pick(others, i), pick(others, i + 1)];
    for (const [g, u] of crew.entries()) {
      await request(trip.id, u.id, 'APPROVED', 24 * (80 - t.start) + g, g);
      await review(trip.id, u.id, host.id, i + g, 4 + ((i + g) % 2));
      await review(trip.id, host.id, u.id, i + g + 1, 5);
    }
    await groupChat(trip.id, [host.id, ...crew.map((u) => u.id)], 5, 24 * -t.start);
    completed.push({ trip, host, crew });
  }

  // ── Activity on every real account ──────────────────────────────────────────
  console.log(`🙋  Real accounts: ${realUsers.map((u) => u.name).join(', ')}`);
  for (const [i, me] of realUsers.entries()) {
    const first = me.name.split(' ')[0];

    // 1. Hosting an upcoming trip: 2 going, 2 waiting (badge), 1 declined, group + inquiry chats.
    const mine = await createTrip(pick(REAL_UPCOMING, i), me.id);
    const [g1, g2, p1, p2, r1] = [0, 1, 2, 3, 4].map((k) => pick(demoList, i * 2 + k));
    await request(mine.id, g1!.id, 'APPROVED', 90, 0);
    await request(mine.id, g2!.id, 'APPROVED', 80, 1);
    const ask1 = await request(mine.id, p1!.id, 'PENDING', 6, 2);
    await request(mine.id, p2!.id, 'PENDING', 3, 3);
    await request(mine.id, r1!.id, 'REJECTED', 50, 1);
    await groupChat(mine.id, [me.id, g1!.id, g2!.id], 6, 40);
    for (const [k, text] of INQUIRY_CHAT.entries()) {
      await prisma.message.create({
        data: { tripId: mine.id, requestId: ask1.id, senderId: k % 2 === 0 ? p1!.id : me.id, text, createdAt: ago(5 - k) },
      });
    }
    await notify(me.id, 'NEW_REQUEST', `${p1!.name} requested to join ${mine.destination}`, '/requests', 6);
    await notify(me.id, 'NEW_REQUEST', `${p2!.name} requested to join ${mine.destination}`, '/requests', 3);

    // 2. Hosted a completed trip: travellers reviewed you; you can still rate one of them.
    const past = await createTrip(pick(REAL_COMPLETED, i), me.id);
    const [c1, c2] = [pick(demoList, i + 3), pick(demoList, i + 7)];
    await request(past.id, c1.id, 'APPROVED', 24 * 90, 0);
    await request(past.id, c2.id, 'APPROVED', 24 * 89, 1);
    await review(past.id, c1.id, me.id, i, 5);
    await review(past.id, c2.id, me.id, i + 1, 4);
    await review(past.id, me.id, c1.id, i + 2, 5);
    await groupChat(past.id, [me.id, c1.id, c2.id], 5, 24 * 40);
    await notify(me.id, 'REVIEW_RECEIVED', `${c1.name} left you a review`, `/users/${me.id}`, 48, true);
    await notify(me.id, 'REVIEW_RECEIVED', `${c2.name} left you a review`, `/users/${me.id}`, 47);

    // 3. Joined a completed trip (host reviewed you, "Rate your trip" waiting for you).
    const joinedPast = pick(completed, i);
    await request(joinedPast.trip.id, me.id, 'APPROVED', 24 * 100, 2);
    await review(joinedPast.trip.id, joinedPast.host.id, me.id, i + 3, 5);

    // 4. Going on an upcoming trip with an active group chat.
    const going = pick(upcoming, i * 3);
    await request(going.trip.id, me.id, 'APPROVED', 30, 3);
    await prisma.message.create({ data: { tripId: going.trip.id, senderId: going.host.id, text: `Welcome aboard ${first}! 🎉`, createdAt: ago(2) } });
    await notify(me.id, 'REQUEST_APPROVED', `You're in! ${going.host.name} accepted you for ${going.trip.destination}`, `/trips/${going.trip.slug}`, 29);

    // 5. A pending request and a declined one.
    const waiting = pick(upcoming, i * 3 + 1);
    const ask = await request(waiting.trip.id, me.id, 'PENDING', 10, 0);
    await prisma.message.create({ data: { tripId: waiting.trip.id, requestId: ask.id, senderId: waiting.host.id, text: `Hey ${first}, thanks for asking! Have you done a trip like this before?`, createdAt: ago(8) } });
    const declined = pick(upcoming, i * 3 + 2);
    await request(declined.trip.id, me.id, 'REJECTED', 70, 1);
    await notify(me.id, 'REQUEST_DECLINED', `${declined.host.name} declined your request for ${declined.trip.destination}`, '/requests?tab=sent', 60, true);
  }

  const counts = await Promise.all([prisma.trip.count(), prisma.request.count(), prisma.message.count(), prisma.review.count()]);
  console.log(`✅  Done. Totals now: ${counts[0]} trips, ${counts[1]} requests, ${counts[2]} messages, ${counts[3]} reviews.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
