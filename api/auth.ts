import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';

function sha256(message: string): string {
  return createHash('sha256').update(message).digest('hex');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body || {};

  if (!password || !ADMIN_PASSWORD_HASH) {
    return res.status(401).json({ success: false, error: '認証に失敗しました' });
  }

  if (sha256(password) === ADMIN_PASSWORD_HASH) {
    return res.status(200).json({ success: true });
  }
  return res.status(401).json({ success: false, error: 'パスワードが違います' });
}
