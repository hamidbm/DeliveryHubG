
import { NextResponse } from 'next/server';
import { fetchAllBundles } from '../../../services/db';

export async function GET() {
  const bundles = await fetchAllBundles();
  return NextResponse.json(bundles);
}
