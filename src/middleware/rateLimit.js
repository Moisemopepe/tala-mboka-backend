const buckets = new Map();
const DAY_MS = 24 * 60 * 60 * 1000;

export function guestReportRateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = buckets.get(ip) || [];
  const recent = bucket.filter((timestamp) => now - timestamp < DAY_MS);

  if (recent.length >= 3) {
    return res.status(429).json({ message: "Limite atteinte: 3 signalements par jour pour cette adresse IP" });
  }

  recent.push(now);
  buckets.set(ip, recent);
  req.clientIp = ip;
  next();
}

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
}
