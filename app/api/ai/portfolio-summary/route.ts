import { NextResponse } from 'next/server';
import { getPortfolioSummary } from '../../../../services/geminiService';
import { fetchSystemSettings, fetchApplications, fetchBundles } from '../../../../services/db';

export async function POST(request: Request) {
  try {
    const settings = await fetchSystemSettings();
    const model = settings?.ai?.geminiProModel || settings?.ai?.proModel || 'gemini-3-pro-preview';
    
    // Fetch real-time registry data to ensure the AI has the latest context
    const [applications, bundles] = await Promise.all([
      fetchApplications(),
      fetchBundles()
    ]);

    const summary = await getPortfolioSummary({
      applications,
      bundles
    }, model);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Portfolio AI API Error:", error);
    return NextResponse.json({ error: 'AI Synthesis failed' }, { status: 500 });
  }
}
