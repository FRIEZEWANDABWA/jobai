export interface UserProfile {
    id: string; // uuid
    full_name: string | null;
    email: string;
    cv_text: string | null;
    cv_embedding: number[] | null;
    telegram_chat_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface JobSource {
    id: string; // uuid
    name: string;
    base_url: string;
    type: 'rss' | 'api' | 'html' | 'google';
    category: string;
    parsing_config: any | null; // JSON config
    active: boolean;
    last_run_at: string | null;
    created_at: string;
}
