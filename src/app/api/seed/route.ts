
import { NextResponse } from 'next/server';
import { seedDatabase } from '../../../shared/bootstrap/seedDatabase';
import { APPLICATIONS, WORK_ITEMS, WIKI_PAGES } from '../../../constants';

export async function GET() {
  const result = await seedDatabase(APPLICATIONS, WORK_ITEMS, WIKI_PAGES);
  if (result.success) {
    return NextResponse.json({ message: "Database seeded successfully" });
  } else {
    return NextResponse.json({ message: "Seeding failed" }, { status: 500 });
  }
}
