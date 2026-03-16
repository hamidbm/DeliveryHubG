import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ensureUserIndexes, getDb } from '../../../../services/db';

const GUEST_TEAM = 'External';
const GUEST_ROLE = 'Guest Viewer';

const normalizeUsernameBase = (email: string) => {
  const local = String(email.split('@')[0] || 'guest').trim().toLowerCase();
  const sanitized = local.replace(/[^a-z0-9._-]+/g, '.').replace(/\.{2,}/g, '.').replace(/^\.|\.$/g, '');
  return sanitized || 'guest';
};

const buildGuestUsername = async (db: any, email: string) => {
  const base = `guest.${normalizeUsernameBase(email)}`;
  let candidate = base;
  let suffix = 2;
  while (await db.collection('users').findOne({ username: candidate }, { projection: { _id: 1 } })) {
    candidate = `${base}.${suffix}`;
    suffix += 1;
  }
  return candidate;
};

export async function POST(request: Request) {
  try {
    const { fullName, email, password } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedName = String(fullName || '').trim();

    if (!normalizedName || !normalizedEmail || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (String(password).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    const db = await getDb();
    await ensureUserIndexes(db);

    const existingUser = await db.collection('users').findOne({ email: normalizedEmail }, { projection: { _id: 1 } });
    if (existingUser) {
      return NextResponse.json({ error: 'Account already exists' }, { status: 409 });
    }

    const username = await buildGuestUsername(db, normalizedEmail);
    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await db.collection('users').insertOne({
      name: normalizedName,
      username,
      email: normalizedEmail,
      password: hashedPassword,
      team: GUEST_TEAM,
      role: GUEST_ROLE,
      accountType: 'GUEST',
      createdAt: new Date(),
    });

    return NextResponse.json({
      message: 'Guest account created successfully',
      userId: result.insertedId,
      username
    }, { status: 201 });
  } catch (error) {
    console.error('Guest registration error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
