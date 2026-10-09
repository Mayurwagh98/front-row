import Movie from '../models/Movie.model.js';

// A Google Images result link is a web page; the real image address is in its `imgurl` parameter.
function cleanPosterUrl(raw = '') {
  try {
    const u = new URL(raw.trim());
    if (/(^|\.)google\.[a-z.]+$/i.test(u.hostname) && u.pathname === '/imgres' && u.searchParams.get('imgurl')) return u.searchParams.get('imgurl');
    return u.href;
  } catch { return raw; }
}

export const listMovies = async (req, res) => res.json(await Movie.find().sort({ createdAt: -1 }));

export async function createMovie(req, res) {
  const { title, description, genre, language, durationMins } = req.body;
  const posterUrl = cleanPosterUrl(req.body.posterUrl);
  if (!title?.trim() || !(Number(durationMins) > 0)) {
    return res.status(400).json({ success: false, message: 'A title and a duration in minutes are required.' });
  }
  if (posterUrl && !/^https?:\/\//i.test(posterUrl)) {
    return res.status(400).json({ success: false, message: 'Poster URL must start with http:// or https://' });
  }
  const movie = await Movie.create({ title, description, genre, language, durationMins: Number(durationMins), posterUrl, createdBy: req.user.id });
  res.status(201).json({ success: true, movie });
}
