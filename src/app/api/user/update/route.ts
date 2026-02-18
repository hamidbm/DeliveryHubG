
import { NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getDb } from '../../../../services/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('nexus_auth_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.id as string;
    const { role, password } = await request.json();

    const db = await getDb();
    const updateData: any = {};
    const now = new Date().toISOString();

    if (role) {
      updateData.role = role;
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No update data provided' }, { status: 400 });
    }

    const result = await db.collection('users').findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { 
        $set: { ...updateData, updatedAt: now },
        $push: { 
          securityLog: { 
            action: role ? 'ROLE_CHANGE' : 'PASSWORD_RESET', 
            role: role || undefined, 
            timestamp: now 
          } as any
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Re-issue JWT with updated data
    const newToken = await new SignJWT({ 
      id: userId, 
      email: result.email, 
      name: result.name, 
      username: result.username,
      role: result.role,
      team: result.team
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(payload.exp ? (payload.exp - Math.floor(Date.now() / 1000)) + 's' : '24h')
      .sign(JWT_SECRET);

    const response = NextResponse.json({ 
      message: 'Profile updated successfully',
      user: { name: result.name, email: result.email, role: result.role, team: result.team, username: result.username }
    });

    response.cookies.set('nexus_auth_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
