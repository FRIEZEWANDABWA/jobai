"use client";
import { useEffect, useState } from "react";

export default function DashboardPage() {
    const [jobs, setJobs] = useState<{ highMatches: any[], strongMatches: any[], otherJobs: any[], appliedJobs: any[], archivedJobs: any[] }>({ highMatches: [], strongMatches: [], otherJobs: [], appliedJobs: [], archivedJobs: [] });
    const [skills, setSkills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'high' | 'strong' | 'all' | 'applied' | 'archived'>('high');
    const [searchQuery, setSearchQuery] = useState('');

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

    const handleUpdateStatus = async (jobId: string, status: string) => {
        try {
            const res = await fetch('/api/applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_id: jobId, status })
            });

            if (res.ok) {
                const allJobs = [...jobs.highMatches, ...jobs.strongMatches, ...jobs.otherJobs, ...jobs.appliedJobs, ...jobs.archivedJobs];
                const jobToMove = allJobs.find(j => j.id === jobId);

                const removeFromAll = (prev: typeof jobs) => ({
                    highMatches: prev.highMatches.filter((j: any) => j.id !== jobId),
                    strongMatches: prev.strongMatches.filter((j: any) => j.id !== jobId),
                    otherJobs: prev.otherJobs.filter((j: any) => j.id !== jobId),
                    appliedJobs: prev.appliedJobs.filter((j: any) => j.id !== jobId),
                    archivedJobs: prev.archivedJobs.filter((j: any) => j.id !== jobId)
                });

                if (status === 'rejected') {
                    const archivedJob = { ...jobToMove, status: 'rejected' };
                    setJobs(prev => ({
                        ...removeFromAll(prev),
                        archivedJobs: [archivedJob, ...prev.archivedJobs.filter((j: any) => j.id !== jobId)]
                    }));
                } else if (status === 'unarchive') {
                    // Restore to main feed by setting status to null
                    const restoredJob = { ...jobToMove, status: null };
                    setJobs(prev => ({
                        ...removeFromAll(prev),
                        strongMatches: [restoredJob, ...prev.strongMatches]
                    }));
                } else {
                    const updatedJob = { ...jobToMove, status };
                    setJobs(prev => ({
                        ...removeFromAll(prev),
                        appliedJobs: [updatedJob, ...prev.appliedJobs.filter((j: any) => j.id !== jobId)]
                    }));
                }

                // Optimistically update apps sent if marked applied
                if (status === 'applied') {
                    setVelocity(v => ({ ...v, applicationsSent: v.applicationsSent + 1 }));
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteJob = async (jobId: string) => {
        if (!confirm('⚠️ Permanently delete this job? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/applications?job_id=${jobId}`, { method: 'DELETE' });
            if (res.ok) {
                setJobs(prev => ({
                    ...prev,
                    archivedJobs: prev.archivedJobs.filter((j: any) => j.id !== jobId)
                }));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleUnarchive = async (jobId: string) => {
        try {
            // Delete the 'rejected' application record to restore the job
            const res = await fetch('/api/applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_id: jobId, status: 'unarchive' })
            });
            if (res.ok) {
                const jobToRestore = jobs.archivedJobs.find(j => j.id === jobId);
                if (jobToRestore) {
                    const restoredJob = { ...jobToRestore, status: null };
                    setJobs(prev => ({
                        ...prev,
                        archivedJobs: prev.archivedJobs.filter((j: any) => j.id !== jobId),
                        strongMatches: [restoredJob, ...prev.strongMatches]
                    }));
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const filterJobs = (jobList: any[]) => {
        if (!searchQuery.trim()) return jobList;
        const lowerQuery = searchQuery.toLowerCase();
        return jobList.filter(j =>
            j.title.toLowerCase().includes(lowerQuery) ||
            j.company.toLowerCase().includes(lowerQuery) ||
            (j.location && j.location.toLowerCase().includes(lowerQuery))
        );
    };

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
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex gap-2">
                    {job.status === 'applied' || job.status === 'interviewing' || job.status === 'offer' ? (
                        <span className="px-3 py-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-semibold rounded-lg text-sm flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                        </span>
                    ) : (
                        <button onClick={() => handleUpdateStatus(job.id, 'applied')} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 transition">
                            Mark as Applied
                        </button>
                    )}
                    <button onClick={() => handleUpdateStatus(job.id, 'rejected')} className="px-3 py-1.5 text-sm font-semibold rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                        Archive
                    </button>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                        {job.posted_date ? new Date(job.posted_date).toLocaleDateString() : 'Recent'}
                    </span>
                    <a href={job.url} target="_blank" rel="noopener noreferrer"
                        className="px-5 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg font-bold text-sm hover:scale-105 transition-transform shadow-sm">
                        Apply Link
                    </a>
                </div>
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
                    <div className="flex gap-3">
                        <a href="https://chatgpt.com/share/69a3345e-4420-8002-b549-c1955f2d07d5" target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 bg-[#10a37f] text-white font-semibold rounded-xl hover:bg-[#0e906f] transition shadow-sm flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                            AI CV Assistant
                        </a>
                        <a href="https://cv-ecru-two.vercel.app/" target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition shadow-sm flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            CV Builder
                        </a>
                        <a href="/admin" className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:opacity-90 transition shadow-sm flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            Admin
                        </a>
                    </div>
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
                        <div
                            onClick={() => setActiveTab('applied')}
                            className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center cursor-pointer hover:border-blue-500 transition-colors">
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Apps Sent (7d)</span>
                            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{velocity.applicationsSent}</span>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-center">
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Interview Rate</span>
                            <span className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{velocity.conversionRate}%</span>
                        </div>
                    </div>
                )}

                {/* Tabs & Search */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 dark:border-gray-800 mb-8 gap-4 pb-2 sm:pb-0">
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setActiveTab('high')}
                            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'high' ? 'border-orange-500 text-orange-600 dark:text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                            🔥 High Matches ({jobs.highMatches.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('strong')}
                            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'strong' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                            ⚡ Strong Matches ({jobs.strongMatches.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'all' ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                            📊 All Jobs ({jobs.otherJobs.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('applied')}
                            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'applied' ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                            ✅ Applied ({jobs.appliedJobs.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('archived')}
                            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'archived' ? 'border-red-500 text-red-600 dark:text-red-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                            🗄️ Archived ({jobs.archivedJobs.length})
                        </button>
                    </div>
                    <div className="relative w-full sm:w-64 pb-2 sm:pb-0">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none pb-2 sm:pb-0">
                            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Filter jobs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                        />
                    </div>
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
                            {activeTab === 'high' && filterJobs(jobs.highMatches).map(j => renderJobCard(j, true))}
                            {activeTab === 'strong' && filterJobs(jobs.strongMatches).map(j => renderJobCard(j, false))}
                            {activeTab === 'all' && filterJobs(jobs.otherJobs).map(j => renderJobCard(j, false))}
                            {activeTab === 'applied' && filterJobs(jobs.appliedJobs).map(j => renderJobCard(j, false))}

                            {/* Archived Job Cards with Restore & Delete */}
                            {activeTab === 'archived' && filterJobs(jobs.archivedJobs).map((job: any) => (
                                <div key={job.id} className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-red-200 dark:border-red-900/50 hover:shadow-md transition-shadow opacity-80">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{job.title}</h3>
                                            <p className="text-gray-500 dark:text-gray-400 font-medium">{job.company} • {job.location || 'Remote/Unknown'}</p>
                                        </div>
                                        <div className="px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                            Archived
                                        </div>
                                    </div>
                                    <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-3 mb-6">
                                        {job.description}
                                    </p>
                                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                        <div className="flex gap-2">
                                            <button onClick={() => handleUnarchive(job.id)} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 transition flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                                                Restore
                                            </button>
                                            <button onClick={() => handleDeleteJob(job.id)} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 transition flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                Delete Forever
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                                                Match: {(job.match_score * 100).toFixed(0)}%
                                            </span>
                                            <a href={job.url} target="_blank" rel="noopener noreferrer"
                                                className="px-5 py-2 bg-gray-500 text-white rounded-lg font-bold text-sm hover:scale-105 transition-transform shadow-sm">
                                                View Job
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {(activeTab === 'high' && filterJobs(jobs.highMatches).length === 0) && (
                                <div className="col-span-full border-dashed border-2 border-gray-300 dark:border-gray-700 rounded-xl py-20 text-center flex flex-col items-center justify-center bg-white/50 dark:bg-gray-800/50">
                                    <span className="text-4xl mb-4">🤷‍♂️</span>
                                    <p className="text-gray-500 dark:text-gray-400">No high match jobs found yet. Check back later!</p>
                                </div>
                            )}

                            {(activeTab === 'strong' && filterJobs(jobs.strongMatches).length === 0) && (
                                <div className="col-span-full border-dashed border-2 border-gray-300 dark:border-gray-700 rounded-xl py-20 text-center flex flex-col items-center justify-center bg-white/50 dark:bg-gray-800/50">
                                    <span className="text-4xl mb-4">🤷‍♂️</span>
                                    <p className="text-gray-500 dark:text-gray-400">No strong match jobs found yet.</p>
                                </div>
                            )}

                            {(activeTab === 'all' && filterJobs(jobs.otherJobs).length === 0) && (
                                <div className="col-span-full border-dashed border-2 border-gray-300 dark:border-gray-700 rounded-xl py-20 text-center flex flex-col items-center justify-center bg-white/50 dark:bg-gray-800/50">
                                    <span className="text-4xl mb-4">🤷‍♂️</span>
                                    <p className="text-gray-500 dark:text-gray-400">No jobs in your feed right now.</p>
                                </div>
                            )}

                            {(activeTab === 'applied' && filterJobs(jobs.appliedJobs).length === 0) && (
                                <div className="col-span-full border-dashed border-2 border-gray-300 dark:border-gray-700 rounded-xl py-20 text-center flex flex-col items-center justify-center bg-white/50 dark:bg-gray-800/50">
                                    <span className="text-4xl mb-4">💼</span>
                                    <p className="text-gray-500 dark:text-gray-400">You haven't sent any applications yet. Go get 'em!</p>
                                </div>
                            )}

                            {(activeTab === 'archived' && filterJobs(jobs.archivedJobs).length === 0) && (
                                <div className="col-span-full border-dashed border-2 border-gray-300 dark:border-gray-700 rounded-xl py-20 text-center flex flex-col items-center justify-center bg-white/50 dark:bg-gray-800/50">
                                    <span className="text-4xl mb-4">✨</span>
                                    <p className="text-gray-500 dark:text-gray-400">No archived jobs. Your feed is clean!</p>
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
