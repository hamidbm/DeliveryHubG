import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { ensureUserIndexes, getAdminBootstrapEmails, getDb, upsertAdmin } from '../../../../services/db';
import { normalizeAccountType } from '../../../../services/authPrincipal';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function POST(request: Request) {
  try {
    const { email, password, rememberMe } = await request.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const db = await getDb();
    await ensureUserIndexes(db);
    const user = await db.collection('users').findOne({ email: normalizedEmail });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const accountType = normalizeAccountType((user as any).accountType);

    // Determine session duration based on 'Remember Me'
    const expirationTime = rememberMe ? '30d' : '24h';
    const cookieMaxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24;

    const token = await new SignJWT({ 
      id: user._id.toString(), 
      email: user.email, 
      name: user.name, 
      username: user.username,
      role: user.role,
      team: user.team,
      accountType
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expirationTime)
      .sign(JWT_SECRET);

    const bootstrapEmails = getAdminBootstrapEmails();
    const isBootstrapAdmin = bootstrapEmails.has(String(user.email || '').toLowerCase());
    if (isBootstrapAdmin) {
      await upsertAdmin(String(user._id), 'system');
    }

    const response = NextResponse.json({ 
      message: 'Logged in successfully',
      user: { name: user.name, role: user.role, team: user.team, username: user.username, email: user.email, accountType }
    });

    response.cookies.set('nexus_auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: cookieMaxAge,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
