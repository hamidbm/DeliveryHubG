
import { NextResponse } from 'next/server';
import { seedDatabase } from '../../../services/db';
import { APPLICATIONS, WORK_ITEMS } from '../../../constants';

export async function GET() {
  const result = await seedDatabase(APPLICATIONS, WORK_ITEMS);
  if (result.success) {
    return NextResponse.json({ message: "Database seeded successfully" });
  } else {
    return NextResponse.json({ message: "Seeding failed" }, { status: 500 });
  }
}
