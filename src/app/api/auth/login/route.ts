import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { getDb } from '../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function POST(request: Request) {
  try {
    const { email, password, rememberMe } = await request.json();

    const db = await getDb();
    const user = await db.collection('users').findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Determine session duration based on 'Remember Me'
    const expirationTime = rememberMe ? '30d' : '24h';
    const cookieMaxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24;

    const token = await new SignJWT({ 
      id: user._id.toString(), 
      email: user.email, 
      name: user.name, 
      role: user.role 
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expirationTime)
      .sign(JWT_SECRET);

    const response = NextResponse.json({ 
      message: 'Logged in successfully',
      user: { name: user.name, role: user.role, email: user.email }
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