import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    const newSources = [
        {
            name: 'CareerJet IT Manager',
            base_url: 'https://www.careerjet.co.ke/jobs?s=IT+Manager&l=Nairobi&radius=25&ct=p&cp=f&cmp=&sort=date',
            type: 'html',
            category: 'IT Management',
            active: true,
            parsing_config: { priority_level: 1, site_url: 'https://www.careerjet.co.ke' }
        },
        {
            name: 'CareerJet IT',
            base_url: 'https://www.careerjet.co.ke/jobs?s=IT&l=Nairobi',
            type: 'html',
            category: 'IT',
            active: true,
            parsing_config: { priority_level: 1, site_url: 'https://www.careerjet.co.ke' }
        },
        {
            name: 'CareerJet InfoTech',
            base_url: 'https://www.careerjet.co.ke/jobs?s=information+technology&l=Nairobi',
            type: 'html',
            category: 'IT',
            active: true,
            parsing_config: { priority_level: 1, site_url: 'https://www.careerjet.co.ke' }
        }
    ];

    const { data, error } = await supabase.from('job_sources').insert(newSources).select();

    if (error) {
        return NextResponse.json({ success: false, error });
    }

    return NextResponse.json({ success: true, inserted: data });
}
