// "Trending destinations" that follow the calendar.
//
// Each place lists the months it's at its best (1 = Jan … 12 = Dec). Trips are planned a few weeks
// ahead, so a place is scored on the current month AND the next one:
//
//   score = 0.6 × fit(this month) + 0.4 × fit(next month) + popularity
//   fit(m) = 1 if m is a peak month, 0.4 if it sits right next to one, else 0
//
// The top few win. Popularity (0–0.25) only breaks ties between places that are equally in season,
// so the row changes as the months go by instead of always showing the same famous names.

export interface TrendingPlace {
  name: string; // shown on the tile
  search: string; // what tapping the tile searches for (matches trip destination / state text)
  image: string;
}

interface Place extends TrendingPlace {
  peak: number[];
  pop: number;
}

const U = (id: string) => `https://images.unsplash.com/${id}?w=400&h=300&fit=crop&auto=format`;
const W = (path: string) => `https://thumb.wikimedia.org/wikipedia/commons/thumb/${path}`;

const PLACES: Place[] = [
  // Winter sun, beaches, deserts and heritage (Nov–Feb)
  { name: 'Goa', search: 'Goa', image: U('photo-1512343879784-a960bf40e7f2'), peak: [11, 12, 1, 2], pop: 0.25 },
  { name: 'Kerala', search: 'Kerala', image: U('photo-1602216056096-3b40cc0c9944'), peak: [11, 12, 1, 2, 3], pop: 0.2 },
  { name: 'Hampi', search: 'Hampi', image: U('photo-1620766182966-c6eb5ed2b788'), peak: [10, 11, 12, 1, 2], pop: 0.15 },
  { name: 'Jaisalmer', search: 'Jaisalmer', image: W('4/46/Jaisalmer_Fort.jpg/500px-Jaisalmer_Fort.jpg'), peak: [11, 12, 1, 2], pop: 0.12 },
  { name: 'Udaipur', search: 'Udaipur', image: W('6/6f/Evening_view%2C_City_Palace%2C_Udaipur.jpg/500px-Evening_view%2C_City_Palace%2C_Udaipur.jpg'), peak: [10, 11, 12, 1, 2, 3], pop: 0.1 },
  { name: 'Rann of Kutch', search: 'Rann', image: W('b/b2/Rann_of_Kutch_-_White_Desert.jpg/500px-Rann_of_Kutch_-_White_Desert.jpg'), peak: [11, 12, 1, 2], pop: 0.05 },
  { name: 'Gokarna', search: 'Gokarna', image: W('d/dd/Delight_india.jpg/500px-Delight_india.jpg'), peak: [11, 12, 1, 2], pop: 0.04 },
  { name: 'Andaman', search: 'Andaman', image: W('6/63/Havelock%2C_Andaman_%26_Nicobar_Islands.JPG/500px-Havelock%2C_Andaman_%26_Nicobar_Islands.JPG'), peak: [11, 12, 1, 2, 3, 4], pop: 0.1 },
  { name: 'Pushkar', search: 'Pushkar', image: W('d/d0/Pushkar.jpg/500px-Pushkar.jpg'), peak: [10, 11], pop: 0.03 },
  // Snow and crisp air (Dec–Mar)
  { name: 'Manali', search: 'Manali', image: U('photo-1593181629936-11c609b8db9b'), peak: [12, 1, 3, 4, 5, 6], pop: 0.25 },
  { name: 'Kashmir', search: 'Kashmir', image: W('e/e1/Dal_Lake_Hazratbal_Srinagar.jpg/500px-Dal_Lake_Hazratbal_Srinagar.jpg'), peak: [12, 1, 2, 3, 4, 5, 9, 10], pop: 0.1 },
  { name: 'Mussoorie', search: 'Mussoorie', image: W('e/e0/Mussoorie_Snow_Over_Dehradun_%2814831297545%29.jpg/500px-Mussoorie_Snow_Over_Dehradun_%2814831297545%29.jpg'), peak: [12, 1, 2, 4, 5, 6], pop: 0.04 },
  // Summer hills and adventure (Mar–Jun)
  { name: 'Darjeeling', search: 'Darjeeling', image: W('9/96/DarjeelingTrainFruitshop_%282%29.jpg/500px-DarjeelingTrainFruitshop_%282%29.jpg'), peak: [3, 4, 5, 10, 11], pop: 0.08 },
  { name: 'Sikkim', search: 'Sikkim', image: W('5/5f/Gurudongmar_Lake_Sikkim%2C_India_%28edit%29.jpg/500px-Gurudongmar_Lake_Sikkim%2C_India_%28edit%29.jpg'), peak: [3, 4, 5, 10, 11, 12], pop: 0.08 },
  { name: 'Rishikesh', search: 'Rishikesh', image: W('7/74/Trayambakeshwar_Temple_VK.jpg/500px-Trayambakeshwar_Temple_VK.jpg'), peak: [3, 4, 9, 10, 11], pop: 0.12 },
  { name: 'Kasol', search: 'Kasol', image: W('a/a2/Kasol_mountain_view.jpg/500px-Kasol_mountain_view.jpg'), peak: [3, 4, 5, 6, 9, 10], pop: 0.06 },
  { name: 'Spiti', search: 'Spiti', image: U('photo-1626621341517-bbf3d9990a23'), peak: [5, 6, 7, 8, 9, 10], pop: 0.18 },
  { name: 'Ladakh', search: 'Ladakh', image: U('photo-1581791534721-e599df4417f7'), peak: [5, 6, 7, 8, 9], pop: 0.25 },
  { name: 'Nainital', search: 'Nainital', image: W('6/6f/Nainital_metro.jpg/500px-Nainital_metro.jpg'), peak: [4, 5, 6, 9, 10], pop: 0.04 },
  { name: 'Tawang', search: 'Tawang', image: W('d/d9/The_buddist_monastry.jpg/500px-The_buddist_monastry.jpg'), peak: [3, 4, 5, 9, 10], pop: 0.03 },
  // Monsoon greens (Jun–Sep)
  { name: 'Valley of Flowers', search: 'Valley of Flowers', image: W('5/50/Valley_of_flowers_national_park%2C_Uttarakhand%2C_India_03_%28edit%29.jpg/500px-Valley_of_flowers_national_park%2C_Uttarakhand%2C_India_03_%28edit%29.jpg'), peak: [7, 8, 9], pop: 0.1 },
  { name: 'Meghalaya', search: 'Meghalaya', image: W('5/51/Living_root_bridges%2C_Nongriat_village%2C_Meghalaya2.jpg/500px-Living_root_bridges%2C_Nongriat_village%2C_Meghalaya2.jpg'), peak: [6, 7, 8, 9, 10], pop: 0.08 },
  { name: 'Coorg', search: 'Coorg', image: W('1/17/Tadiandamol_Valley%2C_Western_Ghats.jpg/500px-Tadiandamol_Valley%2C_Western_Ghats.jpg'), peak: [6, 7, 8, 9], pop: 0.06 },
  { name: 'Kodaikanal', search: 'Kodaikanal', image: W('d/da/Boating_in_Kodaikanal_Lake_with_Mist.jpg/500px-Boating_in_Kodaikanal_Lake_with_Mist.jpg'), peak: [5, 6, 7, 8, 9], pop: 0.04 },
];

const fit = (peak: number[], month: number): number => {
  if (peak.includes(month)) return 1;
  const prev = month === 1 ? 12 : month - 1;
  const next = month === 12 ? 1 : month + 1;
  return peak.includes(prev) || peak.includes(next) ? 0.4 : 0;
};

export function seasonOf(now: Date = new Date()): 'winter' | 'summer' | 'monsoon' | 'autumn' {
  const m = now.getMonth() + 1;
  if (m === 12 || m <= 2) return 'winter';
  if (m <= 5) return 'summer';
  if (m <= 9) return 'monsoon';
  return 'autumn';
}

export function trendingNow(now: Date = new Date(), count = 6): TrendingPlace[] {
  const m = now.getMonth() + 1;
  const nextM = m === 12 ? 1 : m + 1;
  return PLACES.map((p) => ({ p, score: 0.6 * fit(p.peak, m) + 0.4 * fit(p.peak, nextM) + p.pop }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ p }) => ({ name: p.name, search: p.search, image: p.image }));
}

export const monthName = (now: Date = new Date()) => now.toLocaleDateString('en-IN', { month: 'long' });
