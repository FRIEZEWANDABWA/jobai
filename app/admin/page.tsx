"use client";
import { useEffect, useState } from "react";
import { JobSource } from "@/types/source";

export default function AdminPage() {
    const [sources, setSources] = useState<JobSource[]>([]);
    const [settings, setSettings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isTriggering, setIsTriggering] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [tierFilter, setTierFilter] = useState('all');

    // Form states for adding/editing source
    const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
    const [newSourceName, setNewSourceName] = useState('');
    const [newSourceUrl, setNewSourceUrl] = useState('');
    const [newSourceType, setNewSourceType] = useState('html');
    const [newSourcePriority, setNewSourcePriority] = useState(1);
    const [newSourceActive, setNewSourceActive] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/sources').then(res => res.json()),
            fetch('/api/admin/settings').then(res => res.json())
        ])
            .then(([sourcesData, settingsData]) => {
                if (!sourcesData.error) setSources(sourcesData);
                if (!settingsData.error) setSettings(settingsData);
            })
            .finally(() => setLoading(false));
    }, []);

    const handleAddOrEditSource = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            ...(editingSourceId ? { id: editingSourceId } : {}),
            name: newSourceName,
            base_url: newSourceUrl,
            type: newSourceType,
            category: 'Other',
            active: newSourceActive,
            parsing_config: { priority_level: Number(newSourcePriority), site_url: newSourceUrl }
        };

        const method = editingSourceId ? 'PUT' : 'POST';

        const res = await fetch('/api/admin/sources', {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const result = await res.json();
            if (editingSourceId) {
                setSources(sources.map(s => s.id === editingSourceId ? result : s));
            } else {
                setSources([result, ...sources]);
            }
            resetForm();
        }
    };

    const handleDeleteSource = async (id: string) => {
        if (!confirm('Are you sure you want to delete this source? This will stop future tracking.')) return;

        const res = await fetch(`/api/admin/sources?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            setSources(sources.filter(s => s.id !== id));
        }
    };

    const handleEditClick = (s: JobSource) => {
        setEditingSourceId(s.id);
        setNewSourceName(s.name);
        setNewSourceUrl(s.base_url);
        setNewSourceType(s.type);
        setNewSourceActive(s.active || false);
        setNewSourcePriority(s.parsing_config?.priority_level || 1);
        window.scrollTo({ top: document.getElementById('source-form')?.offsetTop! - 100, behavior: 'smooth' });
    };

    const resetForm = () => {
        setEditingSourceId(null);
        setNewSourceName('');
        setNewSourceUrl('');
        setNewSourceType('html');
        setNewSourcePriority(1);
        setNewSourceActive(true);
    };

    const handleSettingChange = async (key: string, value: string) => {
        const res = await fetch('/api/admin/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value })
        });
        if (res.ok) {
            // Update local state lightly
            setSettings(settings.map(s => s.key === key ? { ...s, value } : s));
            alert('Setting updated!');
        }
    };

    const handleTriggerScan = async () => {
        setIsTriggering(true);
        try {
            const res = await fetch('/api/admin/trigger', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert(`✅ Scan complete!\n\nIngestion: ${data.ingestData.message || 'Done'}\nAI Match: Discovered ${data.matchData.newHighMatches || 0} New High Matches.`);
            } else {
                alert('Scan encountered an error.');
            }
        } catch (error) {
            console.error(error);
            alert('Failed to trigger scan.');
        } finally {
            setIsTriggering(false);
        }
    };

    const filteredSources = sources.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.base_url.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTier = tierFilter === 'all' || s.parsing_config?.priority_level?.toString() === tierFilter;
        return matchesSearch && matchesTier;
    });

    if (loading) return <div className="p-8 text-center mt-20 text-gray-500">Loading admin data...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto space-y-12">
                <header className="flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">Command Center</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-lg">System Settings, AI Thresholds, and Scraper Topology.</p>
                    </div>
                    <a href="/dashboard" className="px-5 py-2.5 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold rounded-xl hover:opacity-90 transition shadow-sm flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        Return to Dashboard
                    </a>
                </header>

                {/* Settings Panel */}
                <section className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100">AI Match Thresholds</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {settings.map(setting => (
                            <div key={setting.key} className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {setting.key.replace('_', ' ').toUpperCase()}
                                </label>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{setting.description}</p>
                                <div className="flex space-x-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        defaultValue={setting.value}
                                        className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                        onBlur={(e) => handleSettingChange(setting.key, e.target.value)}
                                    />
                                    <button
                                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-sm font-medium"
                                        onClick={(e) => {
                                            const el = e.currentTarget.previousSibling as HTMLInputElement;
                                            handleSettingChange(setting.key, el.value);
                                        }}
                                    >Save</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Sources Panel */}
                <section className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div id="source-form" className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                            {editingSourceId ? 'Edit Engine Target' : 'Arm New Target'}
                        </h2>
                        {editingSourceId && (
                            <button onClick={resetForm} className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                Cancel Editing
                            </button>
                        )}
                    </div>

                    <form onSubmit={handleAddOrEditSource} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 items-end">
                        <div className="lg:col-span-1 border-r border-gray-200 dark:border-gray-700 pr-4 flex items-center h-full">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Status</span>
                                <input type="checkbox" checked={newSourceActive} onChange={e => setNewSourceActive(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-900" />
                            </label>
                        </div>
                        <div className="lg:col-span-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Source Name</label>
                            <input required value={newSourceName} onChange={e => setNewSourceName(e.target.value)} type="text" className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 text-sm" placeholder="e.g. Fuzu" />
                        </div>
                        <div className="lg:col-span-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Base URL</label>
                            <input required value={newSourceUrl} onChange={e => setNewSourceUrl(e.target.value)} type="url" className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 text-sm" placeholder="https://" />
                        </div>
                        <div className="lg:col-span-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                            <select value={newSourceType} onChange={e => setNewSourceType(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 text-sm">
                                <option value="html">HTML (Scrape)</option>
                                <option value="api">JSON API</option>
                                <option value="rss">RSS Feed</option>
                            </select>
                        </div>
                        <div className="lg:col-span-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Velocity Priority</label>
                            <select value={newSourcePriority} onChange={e => setNewSourcePriority(Number(e.target.value))} className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 text-sm">
                                <option value={1}>Tier 1 (Hourly)</option>
                                <option value={2}>Tier 2 (6 Hours)</option>
                                <option value={3}>Tier 3 (12 Hours)</option>
                                <option value={4}>Tier 4 (Daily)</option>
                            </select>
                        </div>
                        <div className="lg:col-span-1 flex items-end">
                            <button type="submit" className={`w-full py-2 ${editingSourceId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-md font-medium text-sm transition h-[38px] shadow-sm`}>
                                {editingSourceId ? 'Save Edits' : 'Add Source'}
                            </button>
                        </div>
                    </form>

                    <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="flex gap-4 w-full md:w-auto">
                            <input
                                type="text"
                                placeholder="Search Source Name or URL..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full md:w-64 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                            <select
                                value={tierFilter}
                                onChange={e => setTierFilter(e.target.value)}
                                className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">All Tiers</option>
                                <option value="1">Tier 1 Only</option>
                                <option value="2">Tier 2 Only</option>
                                <option value="3">Tier 3 Only</option>
                                <option value="4">Tier 4 Only</option>
                            </select>
                        </div>
                        <button
                            onClick={handleTriggerScan}
                            disabled={isTriggering}
                            className="w-full md:w-auto px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-lg hover:opacity-90 transition shadow-sm disabled:opacity-50"
                        >
                            {isTriggering ? 'Running Scan... Please wait' : '🛠️ Force AI Scan Now'}
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead>
                                <tr>
                                    <th className="px-4 py-3 text-left leading-4 text-gray-500 tracking-wider">Name</th>
                                    <th className="px-4 py-3 text-left leading-4 text-gray-500 tracking-wider">Priority</th>
                                    <th className="px-4 py-3 text-left leading-4 text-gray-500 tracking-wider">Type</th>
                                    <th className="px-4 py-3 text-left leading-4 text-gray-500 tracking-wider">Site Link</th>
                                    <th className="px-4 py-3 text-left leading-4 text-gray-500 tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left leading-4 text-gray-500 tracking-wider">Last Run</th>
                                    <th className="px-4 py-3 text-right leading-4 text-gray-500 tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {filteredSources.map(s => (
                                    <tr key={s.id}>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</div>
                                            <div className="text-sm text-gray-500">{s.base_url}</div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-600 dark:text-gray-300">
                                            Tier {s.parsing_config?.priority_level || 1}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">{s.type}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                                            {s.parsing_config?.site_url ? (
                                                <a href={s.parsing_config.site_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 hover:underline">
                                                    Visit Site &↗
                                                </a>
                                            ) : (
                                                <span className="text-gray-400">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${s.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {s.active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {s.last_run_at ? new Date(s.last_run_at).toLocaleString() : 'Never'}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleEditClick(s)} className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300 mr-4">Edit</button>
                                            <button onClick={() => handleDeleteSource(s.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
}
