
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { normalizeAccountType } from '../../../../services/authPrincipal';
import { updateUserById } from '../../../../server/db/repositories/usersRepo';
import { requireStandardUser } from '../../../../shared/auth/guards';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'nexus_super_secret_key_123');

export async function POST(request: Request) {
  const auth = await requireStandardUser();
  if (!auth.ok) return auth.response;

  try {
    const { principal } = auth;
    const userId = principal.userId;
    const { role, password } = await request.json();

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

    const result = await updateUserById(
      userId,
      { 
        $set: { ...updateData, updatedAt: now },
        $push: { 
          securityLog: { 
            action: role ? 'ROLE_CHANGE' : 'PASSWORD_RESET', 
            role: role || undefined, 
            timestamp: now 
          }
        }
      } as any
    );

    if (!result) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const accountType = normalizeAccountType((result as any).accountType);

    // Re-issue JWT with updated data
    const newToken = await new SignJWT({ 
      id: userId, 
      email: result.email, 
      name: result.name, 
      username: result.username,
      role: result.role,
      team: result.team,
      accountType
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(JWT_SECRET);

    const response = NextResponse.json({ 
      message: 'Profile updated successfully',
      user: { name: result.name, email: result.email, role: result.role, team: result.team, username: result.username, accountType }
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
