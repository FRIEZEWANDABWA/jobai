"use client";
import { useEffect, useState } from "react";

export default function DashboardPage() {
    const [jobs, setJobs] = useState({ highMatches: [], strongMatches: [], otherJobs: [] });
    const [skills, setSkills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'high' | 'strong' | 'all'>('high');

    const [velocity, setVelocity] = useState({ jobsFound: 0, highMatches: 0, applicationsSent: 0, conversionRate: 0 });

    useEffect(() => {
        // In a real app, userId comes from Auth Session context
        const mockUserId = "00000000-0000-0000-0000-000000000000";

        Promise.all([
            fetch(`/api/jobs?userId=${mockUserId}`).then(res => res.json()),
            fetch('/api/skills').then(res => res.json()),
            fetch(`/api/velocity?userId=${mockUserId}`).then(res => res.json())
        ]).then(([jobsData, skillsData, velocityData]) => {
            if (!jobsData.error) setJobs(jobsData);
            if (!skillsData.error && Array.isArray(skillsData)) setSkills(skillsData);
            if (!velocityData.error) setVelocity(velocityData);
        })
            .finally(() => setLoading(false));
    }, []);

    const renderJobCard = (job: any, isHigh: boolean = false) => (
        <div key={job.id} className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{job.title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">{job.company} • {job.location || 'Remote/Unknown'}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${isHigh ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                    Match: {(job.match_score * 100).toFixed(0)}%
                </div>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-3 mb-6">
                {job.description}
            </p>
            <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                    Posted: {job.posted_date ? new Date(job.posted_date).toLocaleDateString() : 'Recent'}
                </span>
                <a href={job.url} target="_blank" rel="noopener noreferrer"
                    className="px-5 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium text-sm hover:opacity-90 transition-opacity">
                    Apply Now
                </a>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-10 flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">Executive Intelligence</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-lg">Your private AI recruiter. Matching top-tier market opportunities with your CV.</p>
                    </div>
                    <a href="/admin" className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:opacity-90 transition shadow-sm flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        Admin Panel
                    </a>
                </header>

                {/* Velocity Tracker */}
                {!loading && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center">
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Jobs Found (7d)</span>
                            <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{velocity.jobsFound}</span>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center">
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">High Matches (7d)</span>
                            <span className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{velocity.highMatches}</span>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center">
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Apps Sent (7d)</span>
                            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{velocity.applicationsSent}</span>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center">
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Interview Rate</span>
                            <span className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{velocity.conversionRate}%</span>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-800 mb-8">
                    <button
                        onClick={() => setActiveTab('high')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'high' ? 'border-orange-500 text-orange-600 dark:text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                        🔥 High Matches ({jobs.highMatches.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('strong')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'strong' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                        ⚡ Strong Matches ({jobs.strongMatches.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all' ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                        📊 All Jobs ({jobs.otherJobs.length})
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 animate-pulse mt-8">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-56 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Left Column: Job Cards */}
                        <div className="flex-1 grid gap-6 grid-cols-1 xl:grid-cols-2 content-start">
                            {activeTab === 'high' && jobs.highMatches.map(j => renderJobCard(j, true))}
                            {activeTab === 'strong' && jobs.strongMatches.map(j => renderJobCard(j, false))}
                            {activeTab === 'all' && jobs.otherJobs.map(j => renderJobCard(j, false))}

                            {((activeTab === 'high' && jobs.highMatches.length === 0) ||
                                (activeTab === 'strong' && jobs.strongMatches.length === 0) ||
                                (activeTab === 'all' && jobs.otherJobs.length === 0)) && (
                                    <div className="col-span-full border-dashed border-2 border-gray-300 dark:border-gray-700 rounded-xl py-20 text-center flex flex-col items-center justify-center bg-white/50 dark:bg-gray-800/50">
                                        <span className="text-4xl mb-4">🤷‍♂️</span>
                                        <p className="text-gray-500 dark:text-gray-400">No jobs found in this category right now.</p>
                                    </div>
                                )}
                        </div>

                        {/* Right Column: Trending Skills Widget */}
                        {skills.length > 0 && (
                            <div className="w-full lg:w-80 shrink-0">
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 sticky top-8">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                        <span>📈</span> IT Leadership Trends
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                                        Most requested skills in recent high-match executive roles.
                                    </p>
                                    <ul className="space-y-4">
                                        {skills.map((skill, idx) => (
                                            <li key={skill.id} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}.</span>
                                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{skill.skill}</span>
                                                </div>
                                                <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-1 px-2 rounded-full">
                                                    {skill.frequency}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
