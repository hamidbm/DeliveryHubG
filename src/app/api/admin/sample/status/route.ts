import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSampleStatus } from '../../../../../shared/bootstrap/seed';
import { requireAdmin } from '../../../../../shared/auth/guards';
const SAMPLE_DIR = process.env.SEED_SAMPLE_DIR || path.join(process.cwd(), 'seed', 'sample');

const listSampleCollections = () => {
  if (!fs.existsSync(SAMPLE_DIR)) return [];
  return fs.readdirSync(SAMPLE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.basename(f, '.json'));
};

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const collections = listSampleCollections();
    const status = await getSampleStatus();
    return NextResponse.json({ collections, status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load sample status' }, { status: 500 });
  }
}
