"use client";
import { useEffect, useState } from "react";
import { JobSource } from "@/types/source";

export default function AdminPage() {
    const [sources, setSources] = useState<JobSource[]>([]);
    const [settings, setSettings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Form states for new source
    const [newSourceName, setNewSourceName] = useState('');
    const [newSourceUrl, setNewSourceUrl] = useState('');
    const [newSourceType, setNewSourceType] = useState('html');

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

    const handleAddSource = async (e: React.FormEvent) => {
        e.preventDefault();
        const newSource = {
            name: newSourceName,
            base_url: newSourceUrl,
            type: newSourceType,
            category: 'Other',
            active: true
        };

        const res = await fetch('/api/admin/sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSource)
        });

        if (res.ok) {
            const added = await res.json();
            setSources([added, ...sources]);
            setNewSourceName('');
            setNewSourceUrl('');
        }
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

    if (loading) return <div className="p-8 text-center mt-20 text-gray-500">Loading admin data...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-6xl mx-auto space-y-12">
                <header>
                    <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">Command Center</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">System Settings, AI Thresholds, and Scraper Topology.</p>
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
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Ingestion Topology</h2>
                    </div>

                    <form onSubmit={handleAddSource} className="flex gap-4 mb-8 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700 items-end">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Source Name</label>
                            <input required value={newSourceName} onChange={e => setNewSourceName(e.target.value)} type="text" className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-900" placeholder="e.g. Fuzu Kenya" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Base URL</label>
                            <input required value={newSourceUrl} onChange={e => setNewSourceUrl(e.target.value)} type="url" className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-900" placeholder="https://..." />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                            <select value={newSourceType} onChange={e => setNewSourceType(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-900">
                                <option value="html">HTML (Scrape)</option>
                                <option value="rss">RSS Feed</option>
                                <option value="api">JSON API</option>
                            </select>
                        </div>
                        <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium h-[42px]">
                            Add Source
                        </button>
                    </form>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead>
                                <tr>
                                    <th className="px-4 py-3 text-left leading-4 text-gray-500 tracking-wider">Name</th>
                                    <th className="px-4 py-3 text-left leading-4 text-gray-500 tracking-wider">Type</th>
                                    <th className="px-4 py-3 text-left leading-4 text-gray-500 tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left leading-4 text-gray-500 tracking-wider">Last Run</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {sources.map(s => (
                                    <tr key={s.id}>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</div>
                                            <div className="text-sm text-gray-500">{s.base_url}</div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">{s.type}</td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${s.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {s.active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {s.last_run_at ? new Date(s.last_run_at).toLocaleString() : 'Never'}
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
