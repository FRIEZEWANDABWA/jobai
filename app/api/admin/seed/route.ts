import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    const newSources = [
        {
            name: 'Safal Group',
            base_url: 'https://safal.mcidirecthire.com/default/External/CurrentOpportunities?Ref=TEkBhDYErs0qhHgueWeCgt_yRI-cnPLR1MRk1RR6CprzB-U-2v9zdrDRc_O8UHXm',
            type: 'html',
            category: 'Other',
            active: true,
            parsing_config: { priority_level: 1, site_url: 'https://safal.mcidirecthire.com/default/External/CurrentOpportunities?Ref=TEkBhDYErs0qhHgueWeCgt_yRI-cnPLR1MRk1RR6CprzB-U-2v9zdrDRc_O8UHXm' }
        },
        {
            name: 'Corporate Staffing IT',
            base_url: 'https://www.corporatestaffing.co.ke/category/it-jobs-in-kenya/',
            type: 'html',
            category: 'IT',
            active: true,
            parsing_config: { priority_level: 1, site_url: 'https://www.corporatestaffing.co.ke/category/it-jobs-in-kenya/' }
        },
        {
            name: 'KenyaJob IT & Telecoms',
            base_url: 'https://www.kenyajob.com/job-vacancies-search-kenya/?f%5B0%5D=im_field_offre_metiers%3A31',
            type: 'html',
            category: 'IT',
            active: true,
            parsing_config: { priority_level: 1, site_url: 'https://www.kenyajob.com/job-vacancies-search-kenya/?f%5B0%5D=im_field_offre_metiers%3A31' }
        }
    ];

    const { data, error } = await supabase.from('job_sources').insert(newSources).select();

    if (error) {
        return NextResponse.json({ success: false, error });
    }

    return NextResponse.json({ success: true, inserted: data });
}
