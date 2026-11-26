// Weather provider hook (M3-S01/M3-S02). No weather source is approved yet, so this
// returns null and the UI shows the weather chip as "chưa mở". To switch on, return
// { temp_c, label, source, observed_at } from a real provider here (e.g. Open-Meteo)
// for the given coordinates. The seeded `weather` (26°C) is NOT a live reading.
export async function currentWeather(/* { lat, lng } */) {
  return null;
}
