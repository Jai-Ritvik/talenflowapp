import React, { useState, useEffect, useCallback, useMemo } from 'react';
// Cleaned up imports: Removed unused icons to resolve ESLint warnings
import { Plus, Edit, Archive, Users, FileText, Menu, X, ArrowLeft, Calendar, User, Mail, AlertCircle, Upload } from 'lucide-react';

// Mock MSW-like API with IndexedDB persistence
class MockAPI {
    constructor() {
        this.dbName = 'talentflow';
        this.initDB();
        this.seedData();
    }

    async initDB() {
        // Simple IndexedDB wrapper - in real app would use Dexie
        if (typeof window !== 'undefined' && !this.db) {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('jobs')) {
                    db.createObjectStore('jobs', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('candidates')) {
                    db.createObjectStore('candidates', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('assessments')) {
                    db.createObjectStore('assessments', { keyPath: 'jobId' });
                }
            };

            this.db = await new Promise((resolve) => {
                request.onsuccess = () => resolve(request.result);
            });
        }
    }

    async delay() {
        const delay = 200 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));

        // 5% error rate on writes
        if (Math.random() < 0.05) {
            throw new Error('Network error');
        }
    }

    async seedData() {
        await this.initDB();

        const transaction = this.db?.transaction(['jobs', 'candidates', 'assessments'], 'readwrite');
        if (!transaction) return;

        const jobsStore = transaction.objectStore('jobs');
        const candidatesStore = transaction.objectStore('candidates');
        const assessmentsStore = transaction.objectStore('assessments');

        // Check if data already exists
        const existingJobs = await new Promise(resolve => {
            const request = jobsStore.count();
            request.onsuccess = () => resolve(request.result);
        });

        if (existingJobs > 0) return; // Already seeded

        // Seed jobs
        const jobs = Array.from({ length: 25 }, (_, i) => ({
            id: `job-${i + 1}`,
            title: `${['Frontend Developer', 'Backend Engineer', 'Full Stack Developer', 'DevOps Engineer', 'Product Manager'][i % 5]} ${Math.floor(i / 5) + 1}`,
            slug: `job-${i + 1}-slug`,
            status: Math.random() > 0.3 ? 'active' : 'archived',
            tags: ['React', 'Node.js', 'TypeScript', 'AWS', 'Python'].slice(0, Math.floor(Math.random() * 3) + 1),
            order: i + 1,
            description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
            createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
        }));

        jobs.forEach(job => jobsStore.add(job));

        // Seed candidates
        const stages = ['applied', 'screen', 'tech', 'offer', 'hired', 'rejected'];
        const candidates = Array.from({ length: 1000 }, (_, i) => ({
            id: `candidate-${i + 1}`,
            name: `Candidate ${i + 1}`,
            email: `candidate${i + 1}@email.com`,
            stage: stages[Math.floor(Math.random() * stages.length)],
            jobId: `job-${Math.floor(Math.random() * 25) + 1}`,
            appliedAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
            notes: []
        }));

        candidates.forEach(candidate => candidatesStore.add(candidate));

        // Seed assessments
        const questionTypes = ['single-choice', 'multi-choice', 'short-text', 'long-text', 'numeric', 'file-upload'];
        for (let i = 1; i <= 3; i++) {
            const assessment = {
                jobId: `job-${i}`,
                title: `Assessment for Job ${i}`,
                sections: [{
                    id: 'section-1',
                    title: 'Technical Skills',
                    questions: Array.from({ length: 12 }, (_, qIndex) => ({
                        id: `q-${qIndex + 1}`,
                        type: questionTypes[qIndex % questionTypes.length],
                        question: `Question ${qIndex + 1}: What is your experience with...?`,
                        required: qIndex < 6,
                        options: ['single-choice', 'multi-choice'].includes(questionTypes[qIndex % questionTypes.length])
                            ? ['Beginner', 'Intermediate', 'Advanced', 'Expert'] : undefined,
                        validation: questionTypes[qIndex % questionTypes.length] === 'numeric'
                            ? { min: 0, max: 10 } : { maxLength: 500 }
                    }))
                }]
            };
            assessmentsStore.add(assessment);
        }
    }

    async getJobs(params = {}) {
        await this.delay();
        await this.initDB();

        const transaction = this.db.transaction(['jobs'], 'readonly');
        const store = transaction.objectStore('jobs');

        const jobs = await new Promise(resolve => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
        });

        let filtered = jobs;

        if (params.search) {
            filtered = filtered.filter(job =>
                job.title.toLowerCase().includes(params.search.toLowerCase())
            );
        }

        if (params.status) {
            filtered = filtered.filter(job => job.status === params.status);
        }

        const total = filtered.length;
        const page = parseInt(params.page) || 1;
        const pageSize = parseInt(params.pageSize) || 10;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;

        return {
            data: filtered.slice(start, end),
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        };
    }

    async createJob(job) {
        await this.delay();
        await this.initDB();

        const newJob = {
            ...job,
            id: `job-${Date.now()}`,
            createdAt: new Date()
        };

        const transaction = this.db.transaction(['jobs'], 'readwrite');
        const store = transaction.objectStore('jobs');
        store.add(newJob);

        return newJob;
    }

    async updateJob(id, updates) {
        await this.delay();
        await this.initDB();

        const transaction = this.db.transaction(['jobs'], 'readwrite');
        const store = transaction.objectStore('jobs');

        const job = await new Promise(resolve => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
        });

        const updatedJob = { ...job, ...updates };
        store.put(updatedJob);

        return updatedJob;
    }

    async getCandidates(params = {}) {
        await this.delay();
        await this.initDB();

        const transaction = this.db.transaction(['candidates'], 'readonly');
        const store = transaction.objectStore('candidates');

        const candidates = await new Promise(resolve => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
        });

        let filtered = candidates;

        if (params.search) {
            const search = params.search.toLowerCase();
            filtered = filtered.filter(candidate =>
                candidate.name.toLowerCase().includes(search) ||
                candidate.email.toLowerCase().includes(search)
            );
        }

        if (params.stage) {
            filtered = filtered.filter(candidate => candidate.stage === params.stage);
        }

        const total = filtered.length;
        const page = parseInt(params.page) || 1;
        const pageSize = parseInt(params.pageSize) || 50;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;

        return {
            data: filtered.slice(start, end),
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        };
    }

    async updateCandidate(id, updates) {
        await this.delay();
        await this.initDB();

        const transaction = this.db.transaction(['candidates'], 'readwrite');
        const store = transaction.objectStore('candidates');

        const candidate = await new Promise(resolve => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
        });

        const updatedCandidate = { ...candidate, ...updates };
        store.put(updatedCandidate);

        return updatedCandidate;
    }

    async getAssessment(jobId) {
        await this.delay();
        await this.initDB();

        const transaction = this.db.transaction(['assessments'], 'readonly');
        const store = transaction.objectStore('assessments');

        return new Promise(resolve => {
            const request = store.get(jobId);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async updateAssessment(jobId, assessment) {
        await this.delay();
        await this.initDB();

        const transaction = this.db.transaction(['assessments'], 'readwrite');
        const store = transaction.objectStore('assessments');

        const updatedAssessment = { ...assessment, jobId };
        store.put(updatedAssessment);

        return updatedAssessment;
    }
}

const api = new MockAPI();

// Main App Component
export default function TalentFlow() {
    const [currentView, setCurrentView] = useState('jobs');
    const [selectedJob, setSelectedJob] = useState(null);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [selectedAssessment, setSelectedAssessment] = useState(null);

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm border-b">
                {/* FIX: The inner container must be full width */}
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <h1 className="text-2xl font-bold text-blue-600">TalentFlow</h1>
                        </div>
                        <div className="flex space-x-4">
                            {['jobs', 'candidates', 'assessments'].map(view => (
                                <button
                                    key={view}
                                    onClick={() => {
                                        setCurrentView(view);
                                        setSelectedJob(null);
                                        setSelectedCandidate(null);
                                        setSelectedAssessment(null);
                                    }}
                                    className={`px-3 py-2 rounded-md text-sm font-medium capitalize ${
                                        currentView === view
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    {view}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </nav>

            {/* FIX: Removed all horizontal padding from the main wrapper */}
            <main className="py-6">
                {currentView === 'jobs' && !selectedJob && !selectedAssessment && (
                    <JobsView onSelectJob={setSelectedJob} onSelectAssessment={setSelectedAssessment} />
                )}

                {selectedJob && (
                    <JobDetail
                        job={selectedJob}
                        onBack={() => setSelectedJob(null)}
                        onSelectAssessment={setSelectedAssessment}
                    />
                )}

                {selectedAssessment && (
                    <AssessmentBuilder
                        jobId={selectedAssessment}
                        onBack={() => setSelectedAssessment(null)}
                    />
                )}

                {currentView === 'candidates' && !selectedCandidate && (
                    <CandidatesView onSelectCandidate={setSelectedCandidate} />
                )}

                {selectedCandidate && (
                    <CandidateDetail
                        candidateId={selectedCandidate}
                        onBack={() => setSelectedCandidate(null)}
                    />
                )}

                {currentView === 'assessments' && !selectedAssessment && (
                    <AssessmentsView onSelectAssessment={setSelectedAssessment} />
                )}
            </main>
        </div>
    );
}

// Jobs View Component
function JobsView({ onSelectJob, onSelectAssessment }) {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ search: '', status: '', page: 1 });
    const [pagination, setPagination] = useState({});
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [draggedJob, setDraggedJob] = useState(null);

    const loadJobs = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.getJobs(filters);
            setJobs(response.data);
            setPagination(response.pagination);
        } catch (error) {
            console.error('Failed to load jobs:', error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadJobs();
    }, [loadJobs]);

    const handleDragStart = (job) => {
        setDraggedJob(job);
    };

    const handleDrop = async (targetJob) => {
        if (!draggedJob || draggedJob.id === targetJob.id) return;

        const optimisticJobs = [...jobs];
        const draggedIndex = optimisticJobs.findIndex(j => j.id === draggedJob.id);
        const targetIndex = optimisticJobs.findIndex(j => j.id === targetJob.id);

        // Optimistic update
        const [draggedItem] = optimisticJobs.splice(draggedIndex, 1);
        optimisticJobs.splice(targetIndex, 0, draggedItem);
        setJobs(optimisticJobs);

        try {
            // Simulate reorder API call that might fail
            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (Math.random() < 0.1) reject(new Error('Reorder failed'));
                    else resolve();
                }, 500);
            });
        } catch {
            // Rollback on failure
            loadJobs();
            // ESLint: 'alert' is not defined (This is a global browser function, but better practice is to avoid it)
            alert('Reorder failed, rolling back...');
        }

        setDraggedJob(null);
    };

    return (
        // FIX: Removed w-full, but kept horizontal padding for content spacing
        <div className="px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Jobs</h2>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Job
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow mb-6">
                <div className="flex space-x-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            placeholder="Search jobs..."
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                    >
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>
            </div>

            {/* Jobs List */}
            {loading ? (
                <div className="text-center py-8">Loading...</div>
            ) : (
                <div className="space-y-4">
                    {jobs.map((job) => (
                        <div
                            key={job.id}
                            draggable
                            onDragStart={() => handleDragStart(job)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDrop(job)}
                            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow cursor-move"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <Menu className="h-5 w-5 text-gray-400" />
                                    <div>
                                        <h3
                                            className="text-lg font-semibold text-blue-600 cursor-pointer hover:underline"
                                            onClick={() => onSelectJob(job)}
                                        >
                                            {job.title}
                                        </h3>
                                        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                      <span className={`px-2 py-1 rounded ${
                          job.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {job.status}
                      </span>
                                            <span>{job.tags.join(', ')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => onSelectAssessment(job.id)}
                                        className="p-2 text-gray-400 hover:text-blue-600"
                                    >
                                        <FileText className="h-5 w-5" />
                                    </button>
                                    <button className="p-2 text-gray-400 hover:text-blue-600">
                                        <Edit className="h-5 w-5" />
                                    </button>
                                    <button className="p-2 text-gray-400 hover:text-red-600">
                                        <Archive className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex justify-center space-x-2 mt-6">
                    {Array.from({ length: pagination.totalPages }, (_, i) => (
                        <button
                            key={i + 1}
                            onClick={() => setFilters({ ...filters, page: i + 1 })}
                            className={`px-3 py-2 rounded ${
                                pagination.page === i + 1
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>
            )}

            {/* Create Job Modal */}
            {showCreateModal && (
                <CreateJobModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={() => {
                        setShowCreateModal(false);
                        loadJobs();
                    }}
                />
            )}
        </div>
    );
}

// Job Detail Component
function JobDetail({ job, onBack, onSelectAssessment }) {
    return (
        <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className="mr-4 p-2 text-gray-400 hover:text-gray-600">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <h2 className="text-3xl font-bold text-gray-900">{job.title}</h2>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Job Details</h3>
                        <p className="text-gray-600 mb-4">{job.description}</p>
                        <div className="space-y-2">
                            <div className="flex items-center">
                                <span className="font-medium mr-2">Status:</span>
                                <span className={`px-2 py-1 rounded text-sm ${
                                    job.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                  {job.status}
                </span>
                            </div>
                            <div className="flex items-center">
                                <span className="font-medium mr-2">Tags:</span>
                                <span>{job.tags.join(', ')}</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Actions</h3>
                        <div className="space-y-2">
                            <button
                                onClick={() => onSelectAssessment(job.id)}
                                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center justify-center"
                            >
                                <FileText className="h-4 w-4 mr-2" />
                                Manage Assessment
                            </button>
                            <button className="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 flex items-center justify-center">
                                <Users className="h-4 w-4 mr-2" />
                                View Candidates
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Create Job Modal Component
function CreateJobModal({ onClose, onCreated }) {
    const [formData, setFormData] = useState({
        title: '',
        slug: '',
        tags: '',
        status: 'active'
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            // ESLint: 'alert' is not defined
            alert('Title is required');
            return;
        }

        setLoading(true);
        try {
            await api.createJob({
                ...formData,
                tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
                slug: formData.slug || formData.title.toLowerCase().replace(/\s+/g, '-')
            });
            onCreated();
        } catch {
            // ESLint: 'alert' is not defined
            alert('Failed to create job');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Create New Job</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Title *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Slug
                        </label>
                        <input
                            type="text"
                            value={formData.slug}
                            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tags (comma-separated)
                        </label>
                        <input
                            type="text"
                            value={formData.tags}
                            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                            placeholder="React, Node.js, TypeScript"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Status
                        </label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Create Job'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Candidates View Component
function CandidatesView({ onSelectCandidate }) {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ search: '', stage: '', page: 1 });
    const [pagination, setPagination] = useState({});
    const [viewMode, setViewMode] = useState('list');

    const loadCandidates = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.getCandidates(filters);
            setCandidates(response.data);
            setPagination(response.pagination);
        } catch (error) {
            console.error('Failed to load candidates:', error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadCandidates();
    }, [loadCandidates]);

    const stages = ['applied', 'screen', 'tech', 'offer', 'hired', 'rejected'];
    const stageColors = {
        applied: 'bg-blue-100 text-blue-800',
        screen: 'bg-yellow-100 text-yellow-800',
        tech: 'bg-purple-100 text-purple-800',
        offer: 'bg-orange-100 text-orange-800',
        hired: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800'
    };

    if (viewMode === 'kanban') {
        return <KanbanBoard candidates={candidates} onSelectCandidate={onSelectCandidate} onUpdateCandidate={loadCandidates} />;
    }

    return (
        // FIX: Removed horizontal padding to let content expand fully
        <div className="w-full">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 px-4 sm:px-6 lg:px-8">
                <h2 className="text-3xl font-bold text-gray-900">Candidates</h2>
                <div className="flex space-x-2">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-4 py-2 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                    >
                        List View
                    </button>
                    <button
                        onClick={() => setViewMode('kanban')}
                        className={`px-4 py-2 rounded ${viewMode === 'kanban' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                    >
                        Kanban View
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow mb-6 mx-4 sm:mx-6 lg:mx-8">
                <div className="flex space-x-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            placeholder="Search candidates..."
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>
                    <select
                        value={filters.stage}
                        onChange={(e) => setFilters({ ...filters, stage: e.target.value, page: 1 })}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                    >
                        <option value="">All Stages</option>
                        {stages.map(stage => (
                            <option key={stage} value={stage} className="capitalize">{stage}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Candidates List */}
            <div className="bg-white rounded-lg shadow overflow-hidden mx-4 sm:mx-6 lg:mx-8">
                {loading ? (
                    <div className="text-center py-8">Loading...</div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {candidates.map((candidate) => (
                            <div
                                key={candidate.id}
                                className="p-4 hover:bg-gray-50 cursor-pointer"
                                onClick={() => onSelectCandidate(candidate.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                                            {candidate.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-medium text-gray-900">{candidate.name}</h3>
                                            <p className="text-gray-500">{candidate.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                <span className={`px-2 py-1 rounded text-sm capitalize ${stageColors[candidate.stage]}`}>
                                    {candidate.stage}
                                </span>
                                        <span className="text-gray-400">{new Date(candidate.appliedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="flex justify-center space-x-2 mt-6">
                    {Array.from({ length: pagination.totalPages }, (_, i) => (
                        <button
                            key={i + 1}
                            onClick={() => setFilters({ ...filters, page: i + 1 })}
                            className={`px-3 py-2 rounded ${
                                pagination.page === i + 1
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// Kanban Board Component
function KanbanBoard({ candidates, onSelectCandidate, onUpdateCandidate }) {
    const [draggedCandidate, setDraggedCandidate] = useState(null);

    const stages = ['applied', 'screen', 'tech', 'offer', 'hired', 'rejected'];
    const stageLabels = {
        applied: 'Applied',
        screen: 'Screening',
        tech: 'Technical',
        offer: 'Offer',
        hired: 'Hired',
        rejected: 'Rejected'
    };

    const candidatesByStage = useMemo(() => {
        return stages.reduce((acc, stage) => {
            acc[stage] = candidates.filter(c => c.stage === stage);
            return acc;
        }, {});
    }, [candidates]);

    const handleDragStart = (candidate) => {
        setDraggedCandidate(candidate);
    };

    const handleDrop = async (stage) => {
        if (!draggedCandidate || draggedCandidate.stage === stage) return;

        try {
            await api.updateCandidate(draggedCandidate.id, { stage });
            onUpdateCandidate();
        } catch {
            // ESLint: 'alert' is not defined
            alert('Failed to update candidate stage');
        }

        setDraggedCandidate(null);
    };

    return (
        // FIX: Removed horizontal padding to let content expand fully
        <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Candidates - Kanban View</h2>
            </div>

            <div className="flex space-x-6 overflow-x-auto pb-4">
                {stages.map((stage) => (
                    <div
                        key={stage}
                        className="flex-shrink-0 w-80 bg-gray-100 rounded-lg p-4"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop(stage)}
                    >
                        <h3 className="font-semibold text-gray-700 mb-4">
                            {stageLabels[stage]} ({candidatesByStage[stage]?.length || 0})
                        </h3>
                        <div className="space-y-3">
                            {candidatesByStage[stage]?.map((candidate) => (
                                <div
                                    key={candidate.id}
                                    draggable
                                    onDragStart={() => handleDragStart(candidate)}
                                    className="bg-white p-4 rounded-lg shadow-sm cursor-move hover:shadow-md transition-shadow"
                                    onClick={() => onSelectCandidate(candidate.id)}
                                >
                                    <h4 className="font-medium text-gray-900">{candidate.name}</h4>
                                    <p className="text-sm text-gray-500">{candidate.email}</p>
                                    <p className="text-xs text-gray-400 mt-2">
                                        Applied: {new Date(candidate.appliedAt).toLocaleDateString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Candidate Detail Component
function CandidateDetail({ candidateId, onBack }) {
    const [candidate, setCandidate] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadCandidate = async () => {
            try {
                const response = await api.getCandidates({ search: candidateId });
                setCandidate(response.data.find(c => c.id === candidateId));
            } catch (error) {
                console.error('Failed to load candidate:', error);
            } finally {
                setLoading(false);
            }
        };

        loadCandidate();
    }, [candidateId]);

    if (loading) {
        return <div className="text-center py-8">Loading...</div>;
    }

    if (!candidate) {
        return <div className="text-center py-8">Candidate not found</div>;
    }

    return (
        // FIX: Removed horizontal padding to let content expand fully
        <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className="mr-4 p-2 text-gray-400 hover:text-gray-600">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <h2 className="text-3xl font-bold text-gray-900">{candidate.name}</h2>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Candidate Information</h3>
                        <div className="space-y-2">
                            <div className="flex items-center">
                                <Mail className="h-5 w-5 text-gray-400 mr-2" />
                                <span>{candidate.email}</span>
                            </div>
                            <div className="flex items-center">
                                <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                                <span>Applied: {new Date(candidate.appliedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Current Status</h3>
                        <span className="px-3 py-1 rounded text-sm capitalize bg-blue-100 text-blue-800">
              {candidate.stage}
            </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Assessment Builder Component
function AssessmentBuilder({ jobId, onBack }) {
    const [assessment, setAssessment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        const loadAssessment = async () => {
            try {
                const data = await api.getAssessment(jobId);
                setAssessment(data || {
                    jobId,
                    title: 'New Assessment',
                    sections: []
                });
            } catch (error) {
                console.error('Failed to load assessment:', error);
            } finally {
                setLoading(false);
            }
        };

        loadAssessment();
    }, [jobId]);

    const saveAssessment = async () => {
        try {
            await api.updateAssessment(jobId, assessment);
            // ESLint: 'alert' is not defined
            alert('Assessment saved successfully!');
        } catch {
            // ESLint: 'alert' is not defined
            alert('Failed to save assessment');
        }
    };

    if (loading) {
        return <div className="text-center py-8">Loading...</div>;
    }

    return (
        // FIX: Removed horizontal padding to let content expand fully
        <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <button onClick={onBack} className="mr-4 p-2 text-gray-400 hover:text-gray-600">
                        <ArrowLeft className="h-6 w-6" />
                    </button>
                    <h2 className="text-3xl font-bold text-gray-900">Assessment Builder</h2>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                        {showPreview ? 'Edit' : 'Preview'}
                    </button>
                    <button
                        onClick={saveAssessment}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Save Assessment
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                {showPreview ? (
                    <AssessmentPreview assessment={assessment} />
                ) : (
                    <AssessmentEditor assessment={assessment} onChange={setAssessment} />
                )}
            </div>
        </div>
    );
}

// Assessment Editor Component
function AssessmentEditor({ assessment, onChange }) {
    const addSection = () => {
        const newSection = {
            id: `section-${Date.now()}`,
            title: 'New Section',
            questions: []
        };

        onChange({
            ...assessment,
            sections: [...(assessment.sections || []), newSection]
        });
    };

    const updateSection = (sectionId, updates) => {
        onChange({
            ...assessment,
            sections: assessment.sections.map(section =>
                section.id === sectionId ? { ...section, ...updates } : section
            )
        });
    };

    const addQuestion = (sectionId) => {
        const newQuestion = {
            id: `q-${Date.now()}`,
            type: 'short-text',
            question: 'New Question',
            required: false,
            options: [],
            validation: {}
        };

        onChange({
            ...assessment,
            sections: assessment.sections.map(section =>
                section.id === sectionId
                    ? { ...section, questions: [...section.questions, newQuestion] }
                    : section
            )
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assessment Title
                </label>
                <input
                    type="text"
                    value={assessment.title || ''}
                    onChange={(e) => onChange({ ...assessment, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Sections</h3>
                    <button
                        onClick={addSection}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Section
                    </button>
                </div>

                {assessment.sections?.map((section) => (
                    <div key={section.id} className="border border-gray-200 rounded p-4 mb-4">
                        <div className="flex justify-between items-center mb-4">
                            <input
                                type="text"
                                value={section.title}
                                onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                className="text-lg font-medium bg-transparent border-none focus:outline-none focus:ring-0"
                            />
                            <button
                                onClick={() => addQuestion(section.id)}
                                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                            >
                                Add Question
                            </button>
                        </div>

                        <div className="space-y-4">
                            {section.questions?.map((question) => (
                                <QuestionEditor
                                    key={question.id}
                                    question={question}
                                    onChange={(updatedQuestion) => {
                                        updateSection(section.id, {
                                            questions: section.questions.map(q =>
                                                q.id === question.id ? updatedQuestion : q
                                            )
                                        });
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Question Editor Component
function QuestionEditor({ question, onChange }) {
    const questionTypes = [
        'single-choice',
        'multi-choice',
        'short-text',
        'long-text',
        'numeric',
        'file-upload'
    ];

    return (
        <div className="border-l-4 border-blue-500 pl-4 py-2">
            <div className="grid grid-cols-2 gap-4 mb-2">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Question
                    </label>
                    <input
                        type="text"
                        value={question.question}
                        onChange={(e) => onChange({ ...question, question: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type
                    </label>
                    <select
                        value={question.type}
                        onChange={(e) => onChange({ ...question, type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                        {questionTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex items-center mb-2">
                <input
                    type="checkbox"
                    checked={question.required}
                    onChange={(e) => onChange({ ...question, required: e.target.checked })}
                    className="mr-2"
                />
                <label className="text-sm text-gray-700">Required</label>
            </div>

            {['single-choice', 'multi-choice'].includes(question.type) && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Options (one per line)
                    </label>
                    <textarea
                        value={question.options?.join('\n') || ''}
                        onChange={(e) => onChange({
                            ...question,
                            options: e.target.value.split('\n').filter(Boolean)
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        rows={3}
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                    />
                </div>
            )}
        </div>
    );
}

// Assessment Preview Component
function AssessmentPreview({ assessment }) {
    const [responses, setResponses] = useState({});

    const updateResponse = (questionId, value) => {
        setResponses({ ...responses, [questionId]: value });
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">{assessment.title}</h2>

            {assessment.sections?.map((section) => (
                <div key={section.id} className="mb-8">
                    <h3 className="text-xl font-semibold mb-4">{section.title}</h3>

                    {section.questions?.map((question) => (
                        <div key={question.id} className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {question.question}
                                {question.required && <span className="text-red-500 ml-1">*</span>}
                            </label>

                            <QuestionInput
                                question={question}
                                value={responses[question.id]}
                                onChange={(value) => updateResponse(question.id, value)}
                            />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

// Question Input Component
function QuestionInput({ question, value, onChange }) {
    switch (question.type) {
        case 'single-choice':
            return (
                <div className="space-y-2">
                    {question.options?.map((option) => (
                        <label key={option} className="flex items-center">
                            <input
                                type="radio"
                                name={question.id}
                                value={option}
                                checked={value === option}
                                onChange={(e) => onChange(e.target.value)}
                                className="mr-2"
                            />
                            {option}
                        </label>
                    ))}
                </div>
            );

        case 'multi-choice':
            return (
                <div className="space-y-2">
                    {question.options?.map((option) => (
                        <label key={option} className="flex items-center">
                            <input
                                type="checkbox"
                                checked={(value || []).includes(option)}
                                onChange={(e) => {
                                    const currentValues = value || [];
                                    if (e.target.checked) {
                                        onChange([...currentValues, option]);
                                    } else {
                                        onChange(currentValues.filter(v => v !== option));
                                    }
                                }}
                                className="mr-2"
                            />
                            {option}
                        </label>
                    ))}
                </div>
            );

        case 'short-text':
            return (
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
            );

        case 'long-text':
            return (
                <textarea
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
            );

        case 'numeric':
            return (
                <input
                    type="number"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    min={question.validation?.min}
                    max={question.validation?.max}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
            );

        case 'file-upload':
            return (
                <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Click to upload or drag and drop</p>
                    <p className="text-xs text-gray-400">File upload functionality would be implemented here</p>
                </div>
            );

        default:
            return null;
    }
}

// Assessments View Component
function AssessmentsView({ onSelectAssessment }) {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadJobs = async () => {
            try {
                const response = await api.getJobs({ status: 'active' });
                setJobs(response.data);
            } catch (error) {
                console.error('Failed to load jobs:', error);
            } finally {
                setLoading(false);
            }
        };

        loadJobs();
    }, []);

    return (
        // FIX: Removed horizontal padding to let content expand fully
        <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Assessments</h2>
            </div>

            {loading ? (
                <div className="text-center py-8">Loading...</div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {jobs.map((job) => (
                        <div
                            key={job.id}
                            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => onSelectAssessment(job.id)}
                        >
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">{job.title}</h3>
                            <p className="text-gray-600 mb-4">Manage assessment for this position</p>
                            <div className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded text-sm ${
                    job.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {job.status}
                </span>
                                <FileText className="h-5 w-5 text-blue-600" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
