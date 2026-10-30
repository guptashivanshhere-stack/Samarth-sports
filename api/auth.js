// /api/auth.js - Vercel Serverless Function
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const allowlist = (process.env.OWNER_EMAIL_ALLOWLIST || 'guptashivansh724@gmail.com')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  if (req.method === 'POST') {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const isAllowed = allowlist.includes(email.trim().toLowerCase());
    if (!isAllowed) {
      return res.status(403).json({
        authorized: false,
        error: 'Forbidden: This email address is not in the Owner Allowlist.'
      });
    }

    return res.status(200).json({
      authorized: true,
      email: email.trim().toLowerCase(),
      role: 'owner'
    });
  }

  // GET: Check allowlist status
  return res.status(200).json({
    status: 'active',
    allowlistCount: allowlist.length,
    service: 'Samarth Sports Owner Auth Gateway'
  });
}
