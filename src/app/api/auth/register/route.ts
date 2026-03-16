import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ensureUserIndexes, getDb, getAdminBootstrapEmails, upsertAdmin } from '../../../../services/db';
import { Role, Team, TEAM_ROLE_OPTIONS } from '../../../../types';

export async function POST(request: Request) {
  try {
    const { name, username, email, password, role, team } = await request.json();

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!name || !username || !normalizedEmail || !password || !team) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = await getDb();
    await ensureUserIndexes(db);
    const existingUser = await db.collection('users').findOne({ email: normalizedEmail });
    const existingUsername = await db.collection('users').findOne({ username });

    if (existingUser) {
      return NextResponse.json({ error: 'Account already exists' }, { status: 409 });
    }
    if (existingUsername) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }

    const normalizedTeam = Object.values(Team).includes(team) ? team : null;
    if (!normalizedTeam) {
      return NextResponse.json({ error: 'Invalid team selected' }, { status: 400 });
    }
    const allowedRoles = TEAM_ROLE_OPTIONS[normalizedTeam as Team];
    const normalizedRole = allowedRoles.includes(role) ? role : allowedRoles[0];

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await db.collection('users').insertOne({
      name,
      username,
      email: normalizedEmail,
      password: hashedPassword,
      team: normalizedTeam,
      role: normalizedRole,
      accountType: 'STANDARD',
      createdAt: new Date(),
    });

    const bootstrapEmails = getAdminBootstrapEmails();
    const isBootstrapAdmin = bootstrapEmails.has(normalizedEmail);
    if (isBootstrapAdmin) {
      await upsertAdmin(String(result.insertedId), 'system');
    }

    return NextResponse.json({ message: 'User created successfully', userId: result.insertedId, isAdmin: isBootstrapAdmin });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
