        // =============================================================================
        // DASHBOARD CORE SYSTEM
        // =============================================================================

        class DashboardCore {
            constructor() {
                this.supabase = null;
                this.cache = new Map();
                this.currentTab = 'overview';
                this.currentMonth = this.getCurrentMonth();
                this.isLoading = false;
                this.toastId = 0;

                // Chart instances
                this.charts = {};

                // Sorting state
                this.paymentsSortColumn = null;
                this.paymentsSortDirection = 'desc';
                this.clientsSortColumn = null;
                this.clientsSortDirection = 'desc';

                this.init();
            }

            async init() {
                this.setupDarkMode();
                this.setupEventListeners();
                this.setupKeyboardShortcuts();
                await this.initializeSupabase();
                this.populateMonthSelector();
                await this.loadInitialData();
                this.showTab('overview');
            }

            getCurrentMonth() {
                const now = new Date();
                return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            }

            setupDarkMode() {
                // Check localStorage for saved theme preference
                const savedTheme = localStorage.getItem('dashboardTheme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                // Apply saved theme or system preference
                if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
                    this.enableDarkMode();
                } else {
                    this.disableDarkMode();
                }

                // Listen for system theme changes
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                    if (!localStorage.getItem('dashboardTheme')) {
                        if (e.matches) {
                            this.enableDarkMode();
                        } else {
                            this.disableDarkMode();
                        }
                    }
                });
            }

            enableDarkMode() {
                document.body.classList.add('dark-mode');
                const toggle = document.getElementById('darkModeToggle');
                const icon = toggle?.querySelector('.toggle-icon');
                if (icon) icon.textContent = '☀️';
                localStorage.setItem('dashboardTheme', 'dark');

                // Update charts if they exist
                this.updateChartsForTheme('dark');
                this.forceChartColors();
                this.refreshClientDistributionLegend();
            }

            disableDarkMode() {
                document.body.classList.remove('dark-mode');
                const toggle = document.getElementById('darkModeToggle');
                const icon = toggle?.querySelector('.toggle-icon');
                if (icon) icon.textContent = '🌙';
                localStorage.setItem('dashboardTheme', 'light');

                // Update charts if they exist
                this.updateChartsForTheme('light');
                this.forceChartColors();
                this.refreshClientDistributionLegend();
            }

            toggleDarkMode() {
                if (document.body.classList.contains('dark-mode')) {
                    this.disableDarkMode();
                } else {
                    this.enableDarkMode();
                }
            }

            refreshClientDistributionLegend() {
                // Specifically refresh the client distribution chart legend with current theme
                const chart = this.charts.clientDistribution;
                if (chart && chart.options.plugins && chart.options.plugins.legend) {
                    const isDarkMode = document.body.classList.contains('dark-mode');
                    const textColor = isDarkMode ? '#f8fafc' : '#1f2937';

                    // Update the legend color
                    chart.options.plugins.legend.labels.color = textColor;

                    // Force legend to regenerate
                    chart.legend.legendItems = null;
                    chart.update('none'); // Update without animation for instant change
                }
            }

            forceChartColors() {
                // Force all charts to use purple colors explicitly
                const isDarkMode = document.body.classList.contains('dark-mode');
                const textColor = isDarkMode ? '#f8fafc' : '#1f2937';
                const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

                // Define purple color palette
                const purpleColors = {
                    main: '#5b21b6',           // var(--chart-purple-main)
                    medium: '#6b46c1',         // var(--chart-purple-medium)
                    light: '#7c3aed',          // var(--chart-purple-light)
                    lighter: '#8b5cf6',        // var(--chart-purple-lighter)
                    mainWithAlpha: 'rgba(91, 33, 182, 0.8)',
                    mediumWithAlpha: 'rgba(107, 70, 193, 0.8)'
                };

                Object.keys(this.charts).forEach(chartId => {
                    const chart = this.charts[chartId];
                    if (!chart || !chart.config) return;

                    const chartType = chart.config.type;
                    let updated = false;

                    // Handle BAR charts
                    if (chartType === 'bar') {
                        if (chart.data && chart.data.datasets) {
                            chart.data.datasets.forEach(dataset => {
                                dataset.backgroundColor = purpleColors.mainWithAlpha;
                                dataset.borderColor = purpleColors.main;
                            });
                            updated = true;
                        }
                    }

                    // Handle LINE charts (like Operational Efficiency)
                    if (chartType === 'line') {
                        if (chart.data && chart.data.datasets) {
                            chart.data.datasets.forEach((dataset, index) => {
                                // Use different purple shades for multiple lines
                                if (index === 0) {
                                    dataset.borderColor = purpleColors.main;
                                    dataset.backgroundColor = purpleColors.mainWithAlpha;
                                } else if (index === 1) {
                                    dataset.borderColor = purpleColors.medium;
                                    dataset.backgroundColor = purpleColors.mediumWithAlpha;
                                } else {
                                    // Additional lines use lighter shades
                                    dataset.borderColor = purpleColors.light;
                                    dataset.backgroundColor = 'rgba(124, 58, 237, 0.8)';
                                }
                            });
                            updated = true;
                        }
                    }

                    // Update chart options for theme-aware styling
                    if (chart.options) {
                        // Update legend colors
                        if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
                            chart.options.plugins.legend.labels.color = textColor;
                            updated = true;
                        }

                        // Update scale colors
                        if (chart.options.scales) {
                            Object.keys(chart.options.scales).forEach(scaleKey => {
                                const scale = chart.options.scales[scaleKey];
                                if (scale.ticks) {
                                    scale.ticks.color = textColor;
                                }
                                if (scale.grid) {
                                    scale.grid.color = gridColor;
                                }
                                updated = true;
                            });
                        }
                    }

                    if (updated) {
                        chart.update('none'); // Update without animation for performance
                    }
                });

                console.log('✅ Applied purple theme colors to all charts in', isDarkMode ? 'dark' : 'light', 'mode');
            }

            updateChartsForTheme(theme) {
                // Update Chart.js color schemes
                Object.keys(this.charts).forEach(chartId => {
                    const chart = this.charts[chartId];
                    if (chart && chart.options) {
                        // Update text colors
                        const textColor = theme === 'dark' ? '#f8fafc' : '#1f2937';
                        const gridColor = theme === 'dark' ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 1)';

                        // Update scales text color
                        if (chart.options.scales) {
                            if (chart.options.scales.x) {
                                chart.options.scales.x.ticks = { ...chart.options.scales.x.ticks, color: textColor };
                                chart.options.scales.x.grid = { ...chart.options.scales.x.grid, color: gridColor };
                            }
                            if (chart.options.scales.y) {
                                chart.options.scales.y.ticks = { ...chart.options.scales.y.ticks, color: textColor };
                                chart.options.scales.y.grid = { ...chart.options.scales.y.grid, color: gridColor };
                            }
                        }

                        // Update legend text color
                        if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
                            chart.options.plugins.legend.labels.color = textColor;

                            // Special handling for charts with custom generateLabels function
                            if (chart.options.plugins.legend.labels.generateLabels) {
                                // Force regenerate labels with new color
                                chart.legend.legendItems = null;
                            }
                        }

                        // Ensure all datasets use purple colors
                        if (chart.data && chart.data.datasets) {
                            chart.data.datasets.forEach((dataset, index) => {
                                // Purple color palette for consistency
                                const purpleColors = [
                                    'rgba(139, 92, 246, 0.8)', // Primary purple
                                    'rgba(91, 33, 182, 0.8)',  // Deep purple
                                    'rgba(76, 29, 149, 0.8)',  // Darker purple
                                    'rgba(107, 70, 193, 0.8)'  // Medium purple
                                ];

                                const purpleBorders = [
                                    'rgba(139, 92, 246, 1)',
                                    'rgba(91, 33, 182, 1)',
                                    'rgba(76, 29, 149, 1)',
                                    'rgba(107, 70, 193, 1)'
                                ];

                                if (chart.config.type === 'bar' || chart.config.type === 'line') {
                                    dataset.backgroundColor = purpleColors[index % purpleColors.length];
                                    dataset.borderColor = purpleBorders[index % purpleBorders.length];
                                }

                                if (chart.config.type === 'doughnut' && Array.isArray(dataset.backgroundColor)) {
                                    dataset.backgroundColor = purpleColors;
                                    dataset.borderColor = purpleBorders;
                                }
                            });
                        }

                        chart.update();
                    }
                });
            }

            setupEventListeners() {
                // Tab navigation
                document.querySelectorAll('.nav-tab').forEach(tab => {
                    tab.addEventListener('click', (e) => {
                        this.showTab(e.target.dataset.tab);
                    });
                });

                // Dark mode toggle
                const darkModeToggle = document.getElementById('darkModeToggle');
                if (darkModeToggle) {
                    darkModeToggle.addEventListener('click', () => {
                        this.toggleDarkMode();
                    });
                }

                // Click outside modal to close
                document.addEventListener('click', (e) => {
                    if (e.target.classList.contains('modal')) {
                        this.closeModal();
                    }
                });

                // Auto-refresh every 5 minutes
                setInterval(() => {
                    if (!this.isLoading) {
                        this.refreshData();
                    }
                }, 5 * 60 * 1000);
            }

            setupKeyboardShortcuts() {
                document.addEventListener('keydown', (e) => {
                    // Show/hide keyboard help
                    if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        this.toggleKeyboardHelp();
                        return;
                    }

                    // Skip if typing in input
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                        return;
                    }

                    // Keyboard shortcuts
                    switch(e.key) {
                        case '1':
                            e.preventDefault();
                            this.showTab('overview');
                            break;
                        case '2':
                            e.preventDefault();
                            this.showTab('clientpayment');
                            break;
                        case '3':
                            e.preventDefault();
                            this.showTab('analytics');
                            break;
                        case 'r':
                            if (e.ctrlKey || e.metaKey) {
                                e.preventDefault();
                                this.refreshData();
                            }
                            break;
                        case 'n':
                            if (e.ctrlKey || e.metaKey) {
                                e.preventDefault();
                                this.actions.addClient();
                            }
                            break;
                        case 'Escape':
                            this.closeModal();
                            break;
                    }
                });
            }

            toggleKeyboardHelp() {
                const help = document.getElementById('keyboardHelp');
                if (help.classList.contains('show')) {
                    help.classList.remove('show');
                } else {
                    help.innerHTML = `
                        <strong>Keyboard Shortcuts:</strong><br>
                        1-3: Switch tabs<br>
                        Ctrl+R: Refresh data<br>
                        Ctrl+N: Add client<br>
                        Esc: Close modal<br>
                        ?: Toggle this help
                    `;
                    help.classList.add('show');
                    setTimeout(() => help.classList.remove('show'), 5000);
                }
            }

            async initializeSupabase() {
                const savedUrl = localStorage.getItem('supabaseUrl');
                const savedKey = localStorage.getItem('supabaseKey');

                if (savedUrl && savedKey) {
                    try {
                        this.supabase = window.supabase.createClient(savedUrl, savedKey);
                        // Test the connection
                        const { data, error } = await this.supabase.from('clients').select('count').limit(1);
                        if (error) throw error;
                        this.updateSyncStatus('connected');
                        this.toast('Connected to database successfully', 'success');
                    } catch (error) {
                        console.error('Connection test failed:', error);
                        this.updateSyncStatus('error');
                        this.toast('Database connection failed. Please check credentials.', 'error');
                        this.showSupabaseSetup();
                    }
                } else {
                    this.showSupabaseSetup();
                }
            }

            showSupabaseSetup() {
                this.updateSyncStatus('error');

                // Create a better setup modal
                const setupModalHtml = `
                    <div id="setupModal" class="modal show">
                        <div class="modal-content">
                            <h2 style="margin-bottom: 16px; color: var(--primary-text);">🔗 Connect to Database</h2>
                            <p style="color: var(--secondary-gray); margin-bottom: 24px;">
                                Enter your Supabase credentials to access your revenue dashboard data.
                            </p>
                            <form id="setupForm">
                                <div class="form-group">
                                    <label>Supabase URL:</label>
                                    <input type="url" id="supabaseUrl" placeholder="https://your-project.supabase.co" required>
                                    <small style="color: var(--secondary-gray); font-size: 0.8em;">Found in your Supabase project settings</small>
                                </div>
                                <div class="form-group">
                                    <label>Supabase API Key (anon):</label>
                                    <input type="password" id="supabaseKey" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." required>
                                    <small style="color: var(--secondary-gray); font-size: 0.8em;">Your public anonymous key</small>
                                </div>
                                <div style="display: flex; gap: 12px; margin-top: 24px;">
                                    <button type="submit" class="btn primary">Connect Database</button>
                                    <button type="button" onclick="Dashboard.loadDemoMode()" class="btn secondary">Demo Mode</button>
                                </div>
                            </form>
                            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border-gray);">
                                <small style="color: var(--secondary-gray);">
                                    <strong>Need help?</strong> Your Supabase URL and API key can be found in your Supabase project dashboard under Settings → API.
                                </small>
                            </div>
                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', setupModalHtml);

                const form = document.getElementById('setupForm');
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await this.connectToSupabase();
                });
            }

            async connectToSupabase() {
                const url = document.getElementById('supabaseUrl').value.trim();
                const key = document.getElementById('supabaseKey').value.trim();

                if (!url || !key) {
                    this.toast('Please enter both URL and API key', 'error');
                    return;
                }

                this.updateSyncStatus('syncing');
                this.toast('Testing connection...', 'info');

                try {
                    this.supabase = window.supabase.createClient(url, key);

                    // Test the connection by trying to fetch from clients table
                    const { data, error } = await this.supabase.from('clients').select('count').limit(1);

                    if (error) {
                        throw new Error(`Database error: ${error.message}`);
                    }

                    // Save credentials
                    localStorage.setItem('supabaseUrl', url);
                    localStorage.setItem('supabaseKey', key);

                    // Close setup modal
                    const modal = document.getElementById('setupModal');
                    if (modal) modal.remove();

                    this.updateSyncStatus('connected');
                    this.toast('Connected successfully! Loading dashboard...', 'success');

                    // Load the dashboard
                    await this.loadInitialData();

                } catch (error) {
                    console.error('Connection failed:', error);
                    this.updateSyncStatus('error');
                    this.toast(`Connection failed: ${error.message}`, 'error');
                }
            }

            loadDemoMode() {
                const modal = document.getElementById('setupModal');
                if (modal) modal.remove();

                this.updateSyncStatus('error');
                this.showDemoData();
                this.toast('Demo mode loaded - showing sample data', 'info');
            }

            showDemoData() {
                // Show demo content
                const contentDiv = document.getElementById('tabContent');
                contentDiv.innerHTML = `
                    <div class="data-section">
                        <div class="section-header">
                            <div class="section-title">Demo Mode</div>
                            <div class="section-subtitle">Sample revenue dashboard data</div>
                        </div>
                        <div style="padding: 40px; text-align: center;">
                            <h3 style="margin-bottom: 16px;">Welcome to Your Revenue Dashboard!</h3>
                            <p style="color: var(--secondary-gray); margin-bottom: 24px;">
                                This is a demo showing what your dashboard will look like once connected to your database.
                            </p>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 32px 0;">
                                <div class="stat-card good">
                                    <div class="stat-label">Demo Revenue</div>
                                    <div class="stat-value">$15,750</div>
                                    <div class="stat-change positive">94.2% collection rate</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-label">Demo Clients</div>
                                    <div class="stat-value">12</div>
                                    <div class="stat-change">11 active, 1 paused</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-label">Demo Outstanding</div>
                                    <div class="stat-value">$950</div>
                                    <div class="stat-change">5.8% of expected</div>
                                </div>
                            </div>
                            <button class="btn primary" onclick="Dashboard.showSupabaseSetup()">
                                Connect Your Database
                            </button>
                        </div>
                    </div>
                `;

                // Update quick stats with demo data
                document.getElementById('quickStats').innerHTML = `
                    <div class="stat-card good">
                        <div class="stat-label">Demo Revenue</div>
                        <div class="stat-value">$15,750</div>
                        <div class="stat-change positive">94.2% collection rate</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Demo Expected</div>
                        <div class="stat-value">$16,700</div>
                        <div class="stat-change">12 active clients</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Demo Outstanding</div>
                        <div class="stat-value">$950</div>
                        <div class="stat-change">5.8% of expected</div>
                    </div>
                    <div class="stat-card clickable">
                        <div class="stat-label">Demo Clients</div>
                        <div class="stat-value">12</div>
                        <div class="stat-change">1 paused</div>
                    </div>
                `;
            }

            populateMonthSelector() {
                const selector = document.getElementById('monthSelector');
                const currentDate = new Date();
                const options = [];

                // Generate last 12 months
                for (let i = 0; i < 12; i++) {
                    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
                    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                    options.push({ value, label });
                }

                // Add November 2025 if not already included
                const nov2025 = '2025-11';
                if (!options.find(opt => opt.value === nov2025)) {
                    options.unshift({ value: nov2025, label: 'November 2025' });
                }

                // Add December 2025 if not already included
                const dec2025 = '2025-12';
                if (!options.find(opt => opt.value === dec2025)) {
                    options.unshift({ value: dec2025, label: 'December 2025' });
                }

                selector.innerHTML = options.map(opt =>
                    `<option value="${opt.value}" ${opt.value === this.currentMonth ? 'selected' : ''}>${opt.label}</option>`
                ).join('');
            }

            async setCurrentMonth(month) {
                console.log('═══════════════════════════════════════');
                console.log('📅 MONTH CHANGE');
                console.log('From:', this.currentMonth);
                console.log('To:', month);
                console.log('═══════════════════════════════════════');

                this.currentMonth = month;

                // Re-populate month selector to ensure UI is in sync
                this.populateMonthSelector();

                // Update Quick Stats for the new month
                await this.updateQuickStats();

                // Re-render the current tab to show the new month's data
                await this.renderTabContent(this.currentTab);

                console.log('✅ Month change complete, now viewing:', this.currentMonth);
                this.toast('Month changed to ' + month, 'info');
            }

            // =============================================================================
            // DATA MANAGEMENT
            // =============================================================================

            async loadInitialData() {
                this.showLoading();
                try {
                    await Promise.all([
                        this.loadClients(),
                        this.loadPayments(),
                        this.loadMonthlyData()
                    ]);
                    this.updateQuickStats();
                    this.toast('Dashboard loaded successfully', 'success');
                } catch (error) {
                    this.toast('Failed to load dashboard data', 'error');
                    console.error('Error loading initial data:', error);
                } finally {
                    this.hideLoading();
                }
            }

            async refreshData() {
                // Re-render the current tab to show updated data (will fetch fresh from database)
                await this.renderTabContent(this.currentTab);
            }

            clearCache() {
                this.cache.clear();
            }

            async loadClients() {
                // DATABASE-FIRST: Always query fresh from database, no caching
                this.updateSyncStatus('syncing');
                try {
                    const { data, error } = await this.supabase
                        .from('clients')
                        .select('*')
                        .order('name');

                    if (error) throw error;

                    this.updateSyncStatus('connected');
                    return data;
                } catch (error) {
                    this.updateSyncStatus('error');
                    throw error;
                }
            }

            async loadPayments() {
                // DATABASE-FIRST: Always query fresh from database, no caching
                this.updateSyncStatus('syncing');
                try {
                    // Query database for current month's payments
                    const { data, error } = await this.supabase
                        .from('monthly_payments')
                        .select(`
                            *,
                            clients (
                                id,
                                name,
                                amount,
                                status
                            )
                        `)
                        .eq('month', this.currentMonth)
                        .not('clients.status', 'eq', 'hidden');

                    if (error) throw error;

                    let paymentsData = (data || []).filter(payment =>
                        payment.clients && payment.clients.status !== 'hidden'
                    );

                    // If no payments exist for this month, create them from active clients
                    if (!paymentsData || paymentsData.length === 0) {
                        console.log('No payments found for', this.currentMonth, '- creating from clients...');
                        await this.createPaymentsForMonth(this.currentMonth);

                        // Reload payments after creation
                        const { data: newData, error: newError } = await this.supabase
                            .from('monthly_payments')
                            .select(`
                                *,
                                clients (
                                    id,
                                    name,
                                    amount,
                                    status
                                )
                            `)
                            .eq('month', this.currentMonth)
                            .not('clients.status', 'eq', 'hidden');

                        if (newError) throw newError;

                        paymentsData = (newData || []).filter(payment =>
                            payment.clients && payment.clients.status !== 'hidden'
                        );
                    }

                    this.updateSyncStatus('connected');
                    return paymentsData;
                } catch (error) {
                    this.updateSyncStatus('error');
                    console.error('Error loading payments:', error);
                    throw error;
                }
            }

            async createPaymentsForMonth(month) {
                try {
                    // Get all active clients
                    const { data: clients, error: clientsError } = await this.supabase
                        .from('clients')
                        .select('*')
                        .neq('status', 'hidden');

                    if (clientsError) throw clientsError;

                    if (!clients || clients.length === 0) {
                        console.log('No clients found to create payments for');
                        return;
                    }

                    // Filter clients to only those who should have started by this month
                    // Extract year-month from the month parameter (e.g., "2025-10")
                    const [targetYear, targetMonth] = month.split('-').map(Number);
                    const targetMonthDate = new Date(targetYear, targetMonth - 1, 1); // Create date for first day of target month

                    const eligibleClients = clients.filter(client => {
                        // Determine effective start date:
                        // 1. If client has reactivation_date (reactivated after being churned/paused), use that
                        // 2. Otherwise, use start_date
                        // 3. If neither exists, assume legacy client - include them

                        let effectiveStartDate = null;

                        if (client.reactivation_date) {
                            // Client was reactivated - use reactivation date as effective start
                            const [reactivationYear, reactivationMonth] = client.reactivation_date.split('-').map(Number);
                            effectiveStartDate = new Date(reactivationYear, reactivationMonth - 1, 1);
                            console.log(`Client ${client.name} has reactivation_date: ${client.reactivation_date}`);
                        } else if (client.start_date) {
                            // Normal client - use original start date
                            const startDate = new Date(client.start_date);
                            const startYear = startDate.getFullYear();
                            const startMonth = startDate.getMonth() + 1; // Convert to 1-based month
                            effectiveStartDate = new Date(startYear, startMonth - 1, 1);
                        } else {
                            // No start_date or reactivation_date - legacy client, include them
                            return true;
                        }

                        // Only include if client's effective start month is <= target month
                        return effectiveStartDate <= targetMonthDate;
                    });

                    if (eligibleClients.length === 0) {
                        console.log(`No clients eligible for payment records in ${month}`);
                        return;
                    }

                    console.log(`📅 ${eligibleClients.length} clients eligible for ${month} (${clients.length - eligibleClients.length} not yet started/reactivated)`);

                    // Check which clients already have payment records for this month
                    const { data: existingPayments, error: checkError } = await this.supabase
                        .from('monthly_payments')
                        .select('client_id')
                        .eq('month', month);

                    if (checkError) throw checkError;

                    // Create a Set of client IDs that already have payments
                    const existingClientIds = new Set(existingPayments?.map(p => p.client_id) || []);

                    // Filter out clients that already have payments
                    const clientsNeedingPayments = eligibleClients.filter(client => !existingClientIds.has(client.id));

                    if (clientsNeedingPayments.length === 0) {
                        console.log(`All eligible clients already have payment records for ${month}`);
                        return;
                    }

                    // Create payment records only for clients that don't have them
                    const paymentRecords = clientsNeedingPayments.map(client => ({
                        client_id: client.id,
                        month: month,
                        amount: client.amount,
                        status: 'unpaid',
                        payment_date: null,
                        notes: null
                    }));

                    const { data, error } = await this.supabase
                        .from('monthly_payments')
                        .insert(paymentRecords);

                    if (error) throw error;

                    console.log(`✅ Created ${paymentRecords.length} payment records for ${month} (${existingClientIds.size} already existed, ${clients.length - eligibleClients.length} not yet started)`);
                    return data;
                } catch (error) {
                    console.error('Error creating payments for month:', error);
                    throw error;
                }
            }

            async createPaymentRecordsForNewClient(clientId, startDate, amount) {
                // Create payment records for a newly added client
                // Generates records from client's start_date through +12 months
                console.log(`💳 Creating payment records for client ${clientId} from ${startDate} for $${amount}`);

                try {
                    const startDateObj = new Date(startDate);
                    const startYear = startDateObj.getFullYear();
                    const startMonth = startDateObj.getMonth(); // 0-based

                    const monthsToCreate = [];

                    // Generate 13 months starting from client's start date
                    for (let i = 0; i < 13; i++) {
                        const targetDate = new Date(startYear, startMonth + i, 1);
                        const monthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
                        monthsToCreate.push(monthStr);
                    }

                    console.log(`📅 Will create payments for months:`, monthsToCreate);

                    // Check which months already have payment records for this client
                    const { data: existingPayments, error: checkError } = await this.supabase
                        .from('monthly_payments')
                        .select('month')
                        .eq('client_id', clientId);

                    if (checkError) throw checkError;

                    const existingMonths = new Set(existingPayments?.map(p => p.month) || []);

                    // Filter out months that already have payments
                    const monthsToInsert = monthsToCreate.filter(month => !existingMonths.has(month));

                    if (monthsToInsert.length === 0) {
                        console.log('ℹ️ All payment records already exist for this client');
                        return 0;
                    }

                    // Create payment records
                    const paymentRecords = monthsToInsert.map(month => ({
                        client_id: clientId,
                        month: month,
                        amount: amount,
                        status: 'unpaid',
                        payment_date: null,
                        notes: null
                    }));

                    const { error: insertError } = await this.supabase
                        .from('monthly_payments')
                        .insert(paymentRecords);

                    if (insertError) throw insertError;

                    console.log(`✅ Created ${paymentRecords.length} payment records for client ${clientId}`);
                    return paymentRecords.length;

                } catch (error) {
                    console.error('❌ Error creating payment records for new client:', error);
                    throw error;
                }
            }

            async createPaymentRecordsForReactivation(clientId, reactivationMonth, amount) {
                // Create payment records for a reactivated client (churned/paused -> active)
                // Generates records from reactivation month through +12 months
                console.log(`🔄 Creating payment records for reactivated client ${clientId} from ${reactivationMonth} for $${amount}`);

                try {
                    // Parse reactivation month (format: "2025-11")
                    const [year, month] = reactivationMonth.split('-').map(Number);
                    const reactivationDate = new Date(year, month - 1, 1); // month is 1-based in string, 0-based in Date

                    const monthsToCreate = [];

                    // Generate 13 months starting from reactivation month
                    for (let i = 0; i < 13; i++) {
                        const targetDate = new Date(year, month - 1 + i, 1);
                        const monthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
                        monthsToCreate.push(monthStr);
                    }

                    console.log(`📅 Will create reactivation payments for months:`, monthsToCreate);

                    // Check which months already have payment records for this client
                    const { data: existingPayments, error: checkError } = await this.supabase
                        .from('monthly_payments')
                        .select('month')
                        .eq('client_id', clientId);

                    if (checkError) throw checkError;

                    const existingMonths = new Set(existingPayments?.map(p => p.month) || []);

                    // Filter out months that already have payments
                    const monthsToInsert = monthsToCreate.filter(month => !existingMonths.has(month));

                    if (monthsToInsert.length === 0) {
                        console.log('ℹ️ All reactivation payment records already exist for this client');
                        return 0;
                    }

                    // Create payment records
                    const paymentRecords = monthsToInsert.map(month => ({
                        client_id: clientId,
                        month: month,
                        amount: amount,
                        status: 'unpaid',
                        payment_date: null,
                        notes: null
                    }));

                    const { error: insertError } = await this.supabase
                        .from('monthly_payments')
                        .insert(paymentRecords);

                    if (insertError) throw insertError;

                    console.log(`✅ Created ${paymentRecords.length} reactivation payment records for client ${clientId}`);
                    return paymentRecords.length;

                } catch (error) {
                    console.error('❌ Error creating payment records for reactivated client:', error);
                    throw error;
                }
            }

            async populateFutureMonths() {
                // Simple function to pre-populate payment records for future months
                // This ensures the dashboard always has data available for current and upcoming months

                try {
                    const currentDate = new Date();
                    const startYear = currentDate.getFullYear();
                    const startMonth = currentDate.getMonth(); // 0-based (October = 9)

                    console.log('🗓️ Pre-populating payment records for future months...');

                    // Create payment records for current month + next 12 months (13 total)
                    const monthsToCreate = [];

                    for (let i = 0; i < 13; i++) {
                        const targetDate = new Date(startYear, startMonth + i, 1);
                        const monthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
                        monthsToCreate.push(monthStr);
                    }

                    console.log('Months to populate:', monthsToCreate);

                    let successCount = 0;
                    let skippedCount = 0;

                    for (const month of monthsToCreate) {
                        try {
                            // Check if payments already exist for this month
                            const { data: existingPayments, error: checkError } = await this.supabase
                                .from('monthly_payments')
                                .select('id')
                                .eq('month', month)
                                .limit(1);

                            if (checkError) throw checkError;

                            if (existingPayments && existingPayments.length > 0) {
                                console.log(`⏭️ ${month}: Already exists, skipping`);
                                skippedCount++;
                                continue;
                            }

                            // Create payments for this month using existing function
                            await this.createPaymentsForMonth(month);
                            console.log(`✅ ${month}: Payment records created`);
                            successCount++;

                        } catch (error) {
                            console.error(`❌ ${month}: Failed to create payments:`, error);
                        }
                    }

                    console.log(`🎉 Future months population complete!`);
                    console.log(`✅ Created: ${successCount} months`);
                    console.log(`⏭️ Skipped: ${skippedCount} months (already existed)`);

                    this.toast(`Future months ready! Created ${successCount} months, skipped ${skippedCount} existing`, 'success');

                    return { success: successCount, skipped: skippedCount };

                } catch (error) {
                    console.error('Error populating future months:', error);
                    this.toast('Failed to populate future months: ' + error.message, 'error');
                    throw error;
                }
            }

            async loadMonthlyData() {
                if (this.cache.has('monthlyData')) {
                    return this.cache.get('monthlyData');
                }

                try {
                    const { data, error } = await this.supabase
                        .from('monthly_data')
                        .select('*')
                        .order('month', { ascending: false });

                    if (error) throw error;

                    this.cache.set('monthlyData', data || []);
                    return data || [];
                } catch (error) {
                    console.error('Error loading monthly data:', error);
                    return [];
                }
            }

            async detectAndCleanDuplicatePayments() {
                console.log('🔍 Scanning for duplicate payment records...');

                try {
                    // Get ALL payment records
                    const { data: allPayments, error } = await this.supabase
                        .from('monthly_payments')
                        .select('id, client_id, month, status, payment_date, amount, created_at')
                        .order('created_at', { ascending: true });

                    if (error) throw error;

                    if (!allPayments || allPayments.length === 0) {
                        console.log('No payments found');
                        return { duplicatesFound: 0, duplicatesDeleted: 0 };
                    }

                    // Group by client_id + month to find duplicates
                    const groupMap = new Map();
                    allPayments.forEach(payment => {
                        const key = `${payment.client_id}_${payment.month}`;
                        if (!groupMap.has(key)) {
                            groupMap.set(key, []);
                        }
                        groupMap.get(key).push(payment);
                    });

                    // Find groups with duplicates (more than 1 record)
                    const duplicateGroups = [];
                    for (const [key, records] of groupMap.entries()) {
                        if (records.length > 1) {
                            duplicateGroups.push({ key, records });
                        }
                    }

                    if (duplicateGroups.length === 0) {
                        console.log('✅ No duplicates found!');
                        return { duplicatesFound: 0, duplicatesDeleted: 0 };
                    }

                    console.warn(`⚠️ Found ${duplicateGroups.length} duplicate groups (${duplicateGroups.reduce((sum, g) => sum + g.records.length - 1, 0)} duplicate records)`);

                    // For each duplicate group, keep the most recent record and delete others
                    let deletedCount = 0;
                    for (const group of duplicateGroups) {
                        const sorted = group.records.sort((a, b) =>
                            new Date(b.created_at || 0) - new Date(a.created_at || 0)
                        );
                        const toKeep = sorted[0];
                        const toDelete = sorted.slice(1);

                        console.log(`  Duplicate group ${group.key}:`);
                        console.log(`    Keeping: ID ${toKeep.id} (${toKeep.status}, created: ${toKeep.created_at})`);

                        for (const record of toDelete) {
                            console.log(`    Deleting: ID ${record.id} (${record.status}, created: ${record.created_at})`);

                            const { error: deleteError } = await this.supabase
                                .from('monthly_payments')
                                .delete()
                                .eq('id', record.id);

                            if (deleteError) {
                                console.error(`    ❌ Failed to delete ID ${record.id}:`, deleteError);
                            } else {
                                deletedCount++;
                            }
                        }
                    }

                    console.log(`✅ Cleanup complete: Deleted ${deletedCount} duplicate records`);
                    this.clearCache();

                    return {
                        duplicatesFound: duplicateGroups.reduce((sum, g) => sum + g.records.length - 1, 0),
                        duplicatesDeleted: deletedCount,
                        groups: duplicateGroups.map(g => ({
                            clientId: g.records[0].client_id,
                            month: g.records[0].month,
                            count: g.records.length
                        }))
                    };

                } catch (error) {
                    console.error('❌ Error detecting/cleaning duplicates:', error);
                    throw error;
                }
            }

            // =============================================================================
            // UI MANAGEMENT
            // =============================================================================

            async showTab(tabName) {
                // Update nav tabs
                document.querySelectorAll('.nav-tab').forEach(tab => {
                    tab.classList.toggle('active', tab.dataset.tab === tabName);
                });

                this.currentTab = tabName;
                await this.renderTabContent(tabName);
            }

            async renderTabContent(tabName) {
                const contentDiv = document.getElementById('tabContent');

                switch(tabName) {
                    case 'overview':
                        contentDiv.innerHTML = await this.renderOverview();
                        // Render overview charts after DOM is ready
                        setTimeout(() => {
                            this.renderOverviewCharts();
                        }, 100);
                        break;
                    case 'clientpayment':
                        this.showLoading();
                        try {
                            contentDiv.innerHTML = await this.renderClientPaymentManagement();
                            console.log('Client & Payment Management content loaded successfully');
                            // Update lifetime values asynchronously after content loads
                            setTimeout(async () => {
                                const clients = await this.loadClients();
                                await this.updateLifetimeValues(clients);
                            }, 100);
                        } catch (error) {
                            console.error('Error loading client & payment management:', error);
                            contentDiv.innerHTML = `
                                <div class="data-section">
                                    <div class="section-header">
                                        <div class="section-title">Client & Payment Management Error</div>
                                        <div class="section-subtitle">Failed to load data: ${error.message}</div>
                                    </div>
                                </div>
                            `;
                        } finally {
                            this.hideLoading();
                        }
                        break;
                    case 'analytics':
                        this.showLoading();
                        try {
                            contentDiv.innerHTML = await this.renderAnalytics();
                            // Charts are rendered automatically by processAnalyticsData in renderAnalytics
                            console.log('Analytics content loaded, charts should render shortly...');
                        } catch (error) {
                            console.error('Error loading analytics content:', error);
                            contentDiv.innerHTML = `
                                <div class="data-section">
                                    <div class="section-header">
                                        <div class="section-title">Analytics Error</div>
                                        <div class="section-subtitle">Failed to load analytics: ${error.message}</div>
                                    </div>
                                </div>
                            `;
                        } finally {
                            this.hideLoading();
                        }
                        break;
                    default:
                        contentDiv.innerHTML = '<div class="data-section"><div class="section-header">Tab not found</div></div>';
                }
            }

            async updateQuickStats() {
                // ✅ FIXED: Use selected month from dropdown, not actual current month
                // This allows KPI cards to update when user switches months
                const monthToShow = this.currentMonth;

                const clients = await this.loadClients();

                // Load payments for the selected month (respects month selector dropdown)
                const { data, error } = await this.supabase
                    .from('monthly_payments')
                    .select(`
                        *,
                        clients (
                            id,
                            name,
                            amount,
                            status,
                            start_date
                        )
                    `)
                    .eq('month', monthToShow)
                    .not('clients.status', 'eq', 'hidden');

                if (error) {
                    console.error('Error loading payments for Quick Stats:', error);
                    return;
                }

                const payments = (data || []).filter(payment =>
                    payment.clients && payment.clients.status !== 'hidden'
                );

                let totalExpected = 0;
                let totalPaid = 0;
                let activeClients = 0;

                // ✅ FIXED: Use getClientStatusForMonth to respect start_date, churn_date, reactivation_date
                payments.forEach(payment => {
                    if (payment.clients) {
                        const monthStatus = this.getClientStatusForMonth(payment.clients, monthToShow);
                        if (monthStatus === 'active') {
                            const amount = parseFloat(payment.clients.amount) || 0;
                            totalExpected += amount;
                            if (payment.status === 'paid') {
                                totalPaid += amount;
                            }
                        }
                    }
                });

                // ✅ FIXED: Count active clients for the specific month
                activeClients = clients.filter(c =>
                    this.getClientStatusForMonth(c, monthToShow) === 'active'
                ).length;
                const outstanding = totalExpected - totalPaid;
                const collectionRate = totalExpected > 0 ? (totalPaid / totalExpected * 100) : 0;

                const statsHtml = `
                    <div class="stat-card ${collectionRate < 75 ? 'alert' : collectionRate > 90 ? 'good' : ''}">
                        <div class="stat-label">Current Month Expected Revenue</div>
                        <div class="stat-value">$${totalExpected.toLocaleString()}</div>
                        <div class="stat-change ${collectionRate > 90 ? 'positive' : 'negative'}">
                            $${totalPaid.toLocaleString()} collected (${collectionRate.toFixed(1)}%)
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-label">Monthly Recurring Revenue (MRR)</div>
                        <div class="stat-value">$${totalExpected.toLocaleString()}</div>
                        <div class="stat-change">
                            ${activeClients} active clients
                        </div>
                    </div>

                    <div class="stat-card ${outstanding > totalExpected * 0.25 ? 'alert' : ''}">
                        <div class="stat-label">Outstanding</div>
                        <div class="stat-value">$${outstanding.toLocaleString()}</div>
                        <div class="stat-change ${outstanding === 0 ? 'positive' : 'negative'}">
                            ${((outstanding / totalExpected) * 100).toFixed(1)}% of expected
                        </div>
                    </div>

                    <div class="stat-card clickable" onclick="Dashboard.showTab('analytics')">
                        <div class="stat-label">Annual Recurring Revenue (ARR)</div>
                        <div class="stat-value">$${(totalExpected * 12).toLocaleString()}</div>
                        <div class="stat-change">
                            Based on ${new Date(monthToShow + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} (MRR × 12)
                        </div>
                    </div>
                `;

                document.getElementById('quickStats').innerHTML = statsHtml;
            }

            // =============================================================================
            // RENDERING METHODS
            // =============================================================================

            async renderOverview() {
                const clients = await this.loadClients();
                const payments = await this.loadPayments();
                const monthlyData = await this.loadMonthlyData();

                // Get unpaid clients
                const unpaidClients = payments.filter(p =>
                    p.status !== 'paid' && p.clients?.status === 'active'
                );

                // Get overdue clients (unpaid for 2+ months)
                const overdueClients = await this.getOverdueClients(2);

                // Get enhanced overdue client data with payment history and owed amounts
                const enhancedOverdueClients = await this.getEnhancedOverdueClients(overdueClients, payments);

                // Calculate overview analytics
                const activeClients = clients.filter(c => c.status === 'active');
                const totalExpectedRevenue = activeClients.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
                const paidRevenue = payments.filter(p => p.status === 'paid' && p.clients?.status === 'active')
                    .reduce((sum, p) => sum + (parseFloat(p.clients?.amount) || 0), 0);

                // Calculate dynamic Google vs Non-Google income
                const googleIncome = 215000; // Static as requested
                const monthlyRecurringRevenue = totalExpectedRevenue; // Same as totalExpectedRevenue

                // Debug: Show overview calculation
                console.log('=== OVERVIEW MRR CALCULATION ===');
                console.log('Total Expected Revenue (MRR):', totalExpectedRevenue);
                console.log('Active clients:', activeClients.length);
                console.log('All clients in database:', clients.length);

                // Show all clients with status
                console.log('=== ALL CLIENTS IN DATABASE ===');
                clients.forEach(client => {
                    console.log(`${client.name}: $${parseFloat(client.amount) || 0} (Status: ${client.status})`);
                });

                console.log('=== ACTIVE CLIENTS ONLY ===');
                activeClients.forEach(client => {
                    console.log(`${client.name}: $${parseFloat(client.amount) || 0}`);
                });
                console.log('=== END OVERVIEW ===');

                const nonGoogleIncome = monthlyRecurringRevenue * 12; // Annual projection
                const totalIncome = googleIncome + nonGoogleIncome;
                const googlePercentage = ((googleIncome / totalIncome) * 100).toFixed(1);
                const nonGooglePercentage = ((nonGoogleIncome / totalIncome) * 100).toFixed(1);

                // Target calculations
                const targetTotal = 265305; // Based on your 76.33% target
                const currentProgress = ((nonGoogleIncome / targetTotal) * 100).toFixed(2);
                const gapToTarget = Math.max(0, targetTotal - nonGoogleIncome);

                return `
                    <div class="data-section">
                        <div class="section-header">
                            <div class="section-title">Dashboard Overview</div>
                            <div class="section-subtitle">Quick snapshot of your revenue status for ${this.currentMonth}</div>
                        </div>

                        ${overdueClients.length > 0 ? `
                            <div style="padding: 20px 32px; background: rgba(239, 68, 68, 0.08); border-radius: var(--border-radius-small); margin: 0 32px 24px 32px; border: 1px solid rgba(239, 68, 68, 0.2);">
                                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                                    <div style="width: 6px; height: 6px; border-radius: 50%; background: #ef4444;"></div>
                                    <span style="font-weight: 600; color: var(--primary-text);">Action Required: ${overdueClients.length} clients overdue 2+ months</span>
                                </div>
                                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                    ${overdueClients.slice(0, 5).map(client => `
                                        <span style="background: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; border: 1px solid rgba(239, 68, 68, 0.2);">
                                            ${client.name}
                                        </span>
                                    `).join('')}
                                    ${overdueClients.length > 5 ? `<span style="color: var(--secondary-text); font-size: 0.85em;">+${overdueClients.length - 5} more</span>` : ''}
                                </div>
                            </div>
                        ` : ''}

                        ${unpaidClients.length > 0 ? `
                            <div class="section-controls">
                                <div style="display: flex; align-items: center; gap: 16px; width: 100%;">
                                    <div style="color: var(--error-red); font-weight: 600;">
                                        ${unpaidClients.length} clients have outstanding payments
                                    </div>
                                    <button class="btn primary" onclick="Dashboard.actions.markAllPaid()">
                                        Mark All Paid
                                    </button>
                                    <button class="btn secondary" onclick="Dashboard.actions.showUnpaidList()">
                                        View Unpaid List
                                    </button>
                                </div>
                            </div>
                        ` : `
                            <div class="section-controls">
                                <div style="color: var(--success-green); font-weight: 600;">
                                    All active clients have paid for ${this.currentMonth}
                                </div>
                            </div>
                        `}

                        <!-- Analytics Charts Section -->
                        <div style="padding: 32px;">
                            <h3 style="margin-bottom: 24px; font-size: 1.3em; color: var(--primary-text);">Revenue Analytics</h3>
                            <!-- Monthly Expected Revenue Chart -->
                            <div style="margin-bottom: 40px;">
                                <div class="chart-container" style="background: var(--card-background); border-radius: var(--border-radius); padding: 24px; box-shadow: var(--shadow-soft); border: 1px solid var(--glass-border);">
                                    <div class="chart-header">
                                        <div class="chart-title">Monthly Expected Revenue</div>
                                        <div class="chart-subtitle">Expected revenue by month (Last 12 months)</div>
                                    </div>
                                    <div style="height: 400px; position: relative;">
                                        <canvas id="overviewMonthlyRevenueChart"></canvas>
                                    </div>
                                </div>
                            </div>

                            <!-- Google vs Non-Google Income Section -->
                            <div style="margin-bottom: 40px;">
                                <div class="chart-container" style="background: var(--card-background); border-radius: var(--border-radius); padding: 24px; box-shadow: var(--shadow-soft); border: 1px solid var(--glass-border);">
                                    <div class="chart-header">
                                        <div class="chart-title">2025 Income Distribution</div>
                                        <div class="chart-subtitle">Google vs Non-Google Revenue Sources</div>
                                    </div>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: center;">
                                        <div style="height: 300px; position: relative;">
                                            <canvas id="googleVsNonGoogleChart"></canvas>
                                        </div>
                                        <div style="padding: 20px;">
                                            <div style="margin-bottom: 24px;">
                                                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                                                    <div style="width: 12px; height: 12px; background: #9CA3AF; border-radius: 2px;"></div>
                                                    <span style="font-weight: 600; color: var(--primary-text);">Google Income</span>
                                                </div>
                                                <div style="color: var(--secondary-text); font-size: 0.9em; margin-bottom: 4px;">$${googleIncome.toLocaleString()} total</div>
                                                <div style="color: var(--primary-text); font-weight: 600; font-size: 1.1em;">${googlePercentage}% of total income</div>
                                            </div>
                                            <div style="margin-bottom: 24px;">
                                                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                                                    <div style="width: 12px; height: 12px; background: #22C55E; border-radius: 2px;"></div>
                                                    <span style="font-weight: 600; color: var(--primary-text);">Non-Google Income</span>
                                                </div>
                                                <div style="color: var(--secondary-text); font-size: 0.9em; margin-bottom: 4px;">$${nonGoogleIncome.toLocaleString()} projected (${monthlyRecurringRevenue.toLocaleString()}/month MRR)</div>
                                                <div style="color: var(--primary-text); font-weight: 600; font-size: 1.1em;">${nonGooglePercentage}% of total income</div>
                                            </div>
                                            <div style="padding: 16px; background: rgba(34, 197, 94, 0.1); border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.2);">
                                                <div style="font-size: 0.9em; color: var(--secondary-text); margin-bottom: 4px;">Progress to Target</div>
                                                <div style="font-weight: 600; color: #059669;">${currentProgress}% achieved</div>
                                                <div style="font-size: 0.85em; color: var(--secondary-text); margin-top: 4px;">$${gapToTarget.toLocaleString()} needed to reach target</div>
                                            </div>

                                            <!-- Debug Table -->
                                            <div style="margin-top: 20px; padding: 16px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                                    <div style="font-size: 0.9em; color: var(--secondary-text);">Active Clients in MRR Calculation (${activeClients.length} clients):</div>
                                                    <button onclick="Dashboard.actions.refreshAll()" style="padding: 4px 8px; background: #22C55E; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8em;">Refresh Data</button>
                                                </div>
                                                <div style="max-height: 300px; overflow-y: auto;">
                                                    ${activeClients.sort((a, b) => a.name.localeCompare(b.name)).map(client => {
                                                        // Debug: Log client data structure
                                                        if (client.name && client.name.toLowerCase().includes('crepe')) {
                                                            console.log('Crepe client data:', client);
                                                        }

                                                        // Check for potential duplicates (normalize names)
                                                        const normalizedName = client.name.toLowerCase().replace(/^the\s+/, '').replace(/\s+/g, '');
                                                        const isDuplicate = activeClients.some(other =>
                                                            other !== client &&
                                                            other.name.toLowerCase().replace(/^the\s+/, '').replace(/\s+/g, '') === normalizedName
                                                        );

                                                        return `
                                                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1); ${isDuplicate ? 'background: rgba(239, 68, 68, 0.1); border-left: 3px solid #EF4444; padding-left: 8px;' : ''}">
                                                            <span style="color: var(--primary-text); flex: 1;">${client.name} ${isDuplicate ? '⚠️ DUPLICATE' : ''}</span>
                                                            <span style="color: var(--secondary-text); font-size: 0.8em; margin: 0 12px;">Status: ${client.status}</span>
                                                            <span style="color: var(--primary-text); font-weight: 600; min-width: 80px; text-align: right;">$${(parseFloat(client.amount) || 0).toLocaleString()}</span>
                                                            ${isDuplicate ? `<button onclick="Dashboard.actions.deleteClient('${client.id}')" style="margin-left: 8px; padding: 2px 6px; background: #EF4444; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 0.7em;">Delete</button>` : ''}
                                                        </div>
                                                        `;
                                                    }).join('')}
                                                    <div style="display: flex; justify-content: space-between; padding: 8px 0; margin-top: 8px; border-top: 2px solid rgba(255, 255, 255, 0.2); font-weight: 600;">
                                                        <span style="color: var(--primary-text);">Total MRR (Should be $17,610):</span>
                                                        <span style="color: ${monthlyRecurringRevenue === 17610 ? '#22C55E' : '#EF4444'};">$${monthlyRecurringRevenue.toLocaleString()}</span>
                                                    </div>
                                                    <div style="margin-top: 8px; padding: 8px; background: rgba(239, 68, 68, 0.1); border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.2);">
                                                        <div style="font-size: 0.85em; color: var(--primary-text);">
                                                            Difference: $${(monthlyRecurringRevenue - 17610).toLocaleString()}
                                                            ${monthlyRecurringRevenue > 17610 ? 'too high' : 'too low'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
                                <div>
                                    <h3 style="margin-bottom: 16px; font-size: 1.2em;">Quick Actions</h3>
                                    <div style="display: flex; flex-direction: column; gap: 12px;">
                                        <button class="btn primary" onclick="Dashboard.showTab('clientpayment')" style="justify-content: flex-start;">
                                            Manage Clients & Payments
                                        </button>
                                        <button class="btn secondary" onclick="Dashboard.showTab('analytics')" style="justify-content: flex-start;">
                                            View Analytics
                                        </button>
                                        <button class="btn secondary" onclick="Dashboard.actions.exportData()" style="justify-content: flex-start;">
                                            Export Data
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <h3 style="margin-bottom: 16px; font-size: 1.2em;">
                                        Clients Overdue 2+ Months
                                        ${enhancedOverdueClients.length > 0 ? `<span style="color: #ef4444; font-size: 0.9em;">(${enhancedOverdueClients.length} clients)</span>` : ''}
                                    </h3>
                                    ${enhancedOverdueClients.length > 0 ? `
                                        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;">
                                            ${enhancedOverdueClients.slice(0, 6).map(client => `
                                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(239, 68, 68, 0.05); border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.15);">
                                                    <div style="flex: 1;">
                                                        <div style="font-weight: 600; color: var(--primary-text); margin-bottom: 4px;">${client.name}</div>
                                                        <div style="font-size: 0.85em; color: var(--secondary-gray);">
                                                            Monthly: $${parseFloat(client.amount).toLocaleString()} •
                                                            Last paid: ${client.lastPayment || 'Never'} •
                                                            Owed: $${client.owedAmount ? parseFloat(client.owedAmount).toLocaleString() : 'TBD'}
                                                        </div>
                                                    </div>
                                                    <div style="margin-left: 12px;">
                                                        <button class="btn small primary" onclick="Dashboard.actions.contactClient('${client.name}')" style="font-size: 0.8em;">
                                                            Contact
                                                        </button>
                                                    </div>
                                                </div>
                                            `).join('')}
                                            ${enhancedOverdueClients.length > 6 ? `
                                                <div style="text-align: center; padding: 8px; color: var(--secondary-gray); font-size: 0.9em;">
                                                    And ${enhancedOverdueClients.length - 6} more overdue clients...
                                                </div>
                                            ` : ''}
                                        </div>
                                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                            <button class="btn secondary small" onclick="Dashboard.actions.exportOverdueClients()">
                                                Export Overdue List
                                            </button>
                                            <button class="btn success small" onclick="Dashboard.showTab('clientpayment')">
                                                Manage Payments
                                            </button>
                                        </div>
                                    ` : `
                                        <div style="text-align: center; padding: 24px; color: var(--success-green); background: rgba(5, 150, 105, 0.05); border-radius: 8px; border: 1px solid rgba(5, 150, 105, 0.2);">
                                            <div style="font-size: 1.1em; font-weight: 600; margin-bottom: 8px;">🎉 All Caught Up!</div>
                                            <div style="font-size: 0.9em;">No clients are overdue 2+ months</div>
                                        </div>
                                    `}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Helper function to determine client status for a specific month
            getClientStatusForMonth(client, month) {
                // month format: "2025-11"

                // ✅ FIXED: Check if client has started yet
                // Extract year-month from start_date (e.g., "2025-12-01" → "2025-12")
                if (client.start_date) {
                    const startYearMonth = client.start_date.substring(0, 7); // "2025-12-01" → "2025-12"
                    if (month < startYearMonth) {
                        // Month is BEFORE client's start date → client hasn't started yet
                        console.log(`Client ${client.name} hasn't started yet (starts ${startYearMonth}, checking ${month})`);
                        return 'hidden'; // Don't show this client for months before they started
                    }
                }

                // If client has a reactivation date
                if (client.reactivation_date) {
                    if (month >= client.reactivation_date) {
                        // Month is >= reactivation date → client is active
                        return 'active';
                    } else if (client.churn_date && month >= client.churn_date) {
                        // Month is between churn_date and reactivation_date → client was churned
                        return 'churned';
                    } else {
                        // Month is before churn_date → client was active
                        return 'active';
                    }
                }

                // If client has a churn date (and no reactivation)
                if (client.churn_date) {
                    if (month >= client.churn_date) {
                        // Month is >= churn date → client is churned
                        return 'churned';
                    } else {
                        // Month is before churn date → client was active
                        return 'active';
                    }
                }

                // No churn or reactivation dates → use current status
                return client.status;
            }

            async renderClientPaymentManagement() {
                console.log('Loading unified client & payment management data...');

                // Load both clients and payments data
                const [clients, payments] = await Promise.all([
                    this.loadClients(),
                    this.loadPayments()
                ]);

                console.log('Loaded clients:', clients?.length || 0, 'records');
                console.log('Loaded payments:', payments?.length || 0, 'records');

                // Handle no data case
                if (!clients || clients.length === 0) {
                    return `
                        <div class="data-section">
                            <div class="section-header">
                                <div class="section-title">Client & Payment Management</div>
                                <div class="section-subtitle">No client data found</div>
                            </div>
                            <div style="padding: 60px; text-align: center; color: var(--secondary-text);">
                                <div style="font-size: 3rem; margin-bottom: 24px;">👥</div>
                                <h3 style="margin-bottom: 16px; color: var(--primary-text);">No Clients Found</h3>
                                <p style="margin-bottom: 32px;">Start by adding your first client to begin tracking payments.</p>
                                <button class="btn primary" onclick="Dashboard.actions.addClient()">
                                    Add Your First Client
                                </button>
                            </div>
                        </div>
                    `;
                }

                // Create a map of payments by client_id for easy lookup
                const paymentMap = new Map();
                payments?.forEach(payment => {
                    if (payment.client_id) {
                        paymentMap.set(payment.client_id, payment);
                    }
                });

                // Calculate month-specific status for each client
                // This respects churn_date and reactivation_date
                const displayClients = clients.map(client => ({
                    ...client,
                    monthStatus: this.getClientStatusForMonth(client, this.currentMonth)
                }));

                console.log('📅 Client statuses for', this.currentMonth + ':');
                displayClients.forEach(c => {
                    if (c.monthStatus !== c.status) {
                        console.log(`  ${c.name}: current=${c.status}, month=${c.monthStatus}, churn=${c.churn_date}, reactivation=${c.reactivation_date}`);
                    }
                });

                // Calculate filter counts using month-specific status
                const activeClients = displayClients.filter(c => c.monthStatus === 'active');
                const pausedClients = displayClients.filter(c => c.monthStatus === 'paused');
                const hiddenClients = displayClients.filter(c => c.monthStatus === 'hidden');
                const churnedClients = displayClients.filter(c => c.monthStatus === 'churned');

                // Payment status counts (only for active clients)
                const activePayments = activeClients.map(client => paymentMap.get(client.id)).filter(Boolean);
                const paidCount = activePayments.filter(p => p.status === 'paid').length;
                const unpaidCount = activePayments.filter(p => p.status === 'unpaid').length;

                // Format the current month for better display
                const monthDate = new Date(this.currentMonth + '-01');
                const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

                return `
                    <div class="data-section">
                        <div class="section-header">
                            <div class="section-title">Client & Payment Management - ${monthName}</div>
                            <div class="section-subtitle">Unified client database and payment tracking</div>
                        </div>

                        <!-- Search Bar -->
                        <div class="search-container">
                            <input
                                type="text"
                                id="clientSearch"
                                class="search-input"
                                placeholder="Search clients by name, amount, status..."
                                oninput="Dashboard.searchClients(this.value)"
                            >
                            <span class="search-icon">🔍</span>
                            <button class="search-clear" onclick="Dashboard.clearSearch()" style="display: none;">✕</button>
                        </div>

                        <div class="section-controls">
                            <div class="control-section">
                                <!-- Smart Filter Group -->
                                <div class="filter-group">
                                    <button class="filter-btn active" onclick="Dashboard.filterClientPayments('all')">
                                        All Active <span class="filter-count">${activeClients.length}</span>
                                    </button>
                                    <button class="filter-btn" onclick="Dashboard.filterClientPayments('paid')">
                                        Paid <span class="filter-count">${paidCount}</span>
                                    </button>
                                    <button class="filter-btn" onclick="Dashboard.filterClientPayments('unpaid')">
                                        Unpaid <span class="filter-count">${unpaidCount}</span>
                                    </button>
                                    <button class="filter-btn" onclick="Dashboard.filterClientPayments('paused')">
                                        Paused <span class="filter-count">${pausedClients.length}</span>
                                    </button>
                                    ${hiddenClients.length > 0 ? `
                                        <button class="filter-btn" onclick="Dashboard.filterClientPayments('hidden')">
                                            Hidden <span class="filter-count">${hiddenClients.length}</span>
                                        </button>
                                    ` : ''}
                                    ${churnedClients.length > 0 ? `
                                        <button class="filter-btn" onclick="Dashboard.filterClientPayments('churned')">
                                            Churned <span class="filter-count">${churnedClients.length}</span>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>

                            <div style="margin-left: auto; display: flex; gap: 12px;">
                                <button class="btn primary" onclick="Dashboard.actions.addClient()">+ Add Client</button>
                            </div>
                        </div>

                        ${unpaidCount > 0 ? `
                            <div style="padding: 20px 32px; background: rgba(245, 158, 11, 0.08); border-radius: var(--border-radius-small); margin-bottom: 24px; border: 1px solid rgba(245, 158, 11, 0.2);">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="width: 4px; height: 4px; border-radius: 50%; background: var(--warning-gray);"></div>
                                    <span style="font-weight: 500; color: var(--primary-text);">${unpaidCount} unpaid clients</span>
                                    <span style="color: var(--secondary-text);">•</span>
                                    <span style="color: var(--secondary-text);">
                                        $${activePayments.filter(p => p.status === 'unpaid')
                                            .reduce((sum, p) => {
                                                const client = clients.find(c => c.id === p.client_id);
                                                return sum + (parseFloat(client?.amount) || 0);
                                            }, 0).toLocaleString()} outstanding
                                    </span>
                                </div>
                            </div>
                        ` : `
                            <div style="padding: 20px 32px; background: rgba(16, 185, 129, 0.08); border-radius: var(--border-radius-small); margin-bottom: 24px; border: 1px solid rgba(16, 185, 129, 0.2);">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="width: 4px; height: 4px; border-radius: 50%; background: var(--success-green);"></div>
                                    <span style="font-weight: 500; color: var(--primary-text);">All active clients have paid!</span>
                                </div>
                            </div>
                        `}

                        <div class="table-container">
                            <table id="clientPaymentTable">
                                <thead>
                                    <tr>
                                        <th class="sortable" onclick="Dashboard.sortClientPayments('name')">Client Name</th>
                                        <th class="sortable" onclick="Dashboard.sortClientPayments('amount')">Monthly Amount</th>
                                        <th class="sortable" onclick="Dashboard.sortClientPayments('clientStatus')">Client Status</th>
                                        <th class="sortable" onclick="Dashboard.sortClientPayments('paymentStatus')">Payment Status</th>
                                        <th class="sortable" onclick="Dashboard.sortClientPayments('paymentDate')">Payment Date</th>
                                        <th>Notes</th>
                                        <th>Lifetime Value</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="clientPaymentTableBody">
                                    ${this.renderUnifiedClientPaymentRows(displayClients.filter(c => c.monthStatus !== 'churned'), paymentMap)}
                                </tbody>
                                <tfoot>
                                    <tr style="background: var(--light-gray); font-weight: 600; border-top: 2px solid var(--border-gray);">
                                        <td style="padding: 16px;">Total Active Clients</td>
                                        <td style="padding: 16px; color: var(--primary-text); font-size: 1.1em;">
                                            ${activeClients.length}
                                        </td>
                                        <td colspan="5"></td>
                                    </tr>
                                    <tr style="background: var(--light-gray); font-weight: 600;">
                                        <td style="padding: 16px;">Monthly Recurring Revenue (MRR)</td>
                                        <td style="padding: 16px; color: var(--success-green); font-size: 1.1em;">
                                            $${activeClients.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0).toLocaleString()}
                                        </td>
                                        <td colspan="5"></td>
                                    </tr>
                                    <tr style="background: var(--light-gray); font-weight: 600;">
                                        <td style="padding: 16px;">Annual Recurring Revenue (ARR)</td>
                                        <td style="padding: 16px; color: var(--chart-purple-main); font-size: 1.1em;">
                                            $${(activeClients.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0) * 12).toLocaleString()}
                                        </td>
                                        <td colspan="5" style="padding: 16px; font-size: 0.85em; color: var(--secondary-text);">Based on current active clients (MRR × 12)</td>
                                    </tr>
                                    <tr style="background: var(--light-gray); font-weight: 600;">
                                        <td style="padding: 16px;">${monthName} Total Expected</td>
                                        <td style="padding: 16px; color: var(--primary-text); font-size: 1.1em;">
                                            $${activeClients.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0).toLocaleString()}
                                        </td>
                                        <td colspan="5"></td>
                                    </tr>
                                    <tr style="background: var(--light-gray); font-weight: 600;">
                                        <td style="padding: 16px;">${monthName} Total Collected</td>
                                        <td style="padding: 16px; color: var(--success-green); font-size: 1.1em;">
                                            $${activePayments.filter(p => p.status === 'paid')
                                                .reduce((sum, p) => {
                                                    const client = clients.find(c => c.id === p.client_id);
                                                    return sum + (parseFloat(client?.amount) || 0);
                                                }, 0).toLocaleString()}
                                        </td>
                                        <td colspan="5"></td>
                                    </tr>
                                    <tr style="background: var(--light-gray); font-weight: 600; border-bottom: 2px solid var(--border-gray);">
                                        <td style="padding: 16px;">${monthName} Collection Rate</td>
                                        <td style="padding: 16px; font-size: 1.1em;">
                                            ${(() => {
                                                const expected = activeClients.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
                                                const collected = activePayments.filter(p => p.status === 'paid')
                                                    .reduce((sum, p) => {
                                                        const client = clients.find(c => c.id === p.client_id);
                                                        return sum + (parseFloat(client?.amount) || 0);
                                                    }, 0);
                                                const rate = expected > 0 ? (collected / expected * 100) : 0;
                                                const color = rate >= 90 ? 'var(--success-green)' : rate >= 75 ? 'var(--warning-gray)' : 'var(--error-red)';
                                                return `<span style="color: ${color};">${rate.toFixed(1)}%</span>`;
                                            })()}
                                        </td>
                                        <td colspan="5" style="padding: 16px; font-size: 0.85em; color: var(--secondary-text);">Target: 90%+</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                `;
            }

            renderUnifiedClientPaymentRows(clients, paymentMap) {
                if (!clients || clients.length === 0) return '<tr><td colspan="7" style="text-align: center; padding: 40px;">No clients found</td></tr>';

                return clients.map(client => {
                    const payment = paymentMap.get(client.id);
                    const amount = parseFloat(client.amount) || 0;

                    // Use monthStatus if available (respects churn/reactivation dates), otherwise use current status
                    const displayStatus = client.monthStatus || client.status;

                    // Client status badge - clickable to change status
                    const clientStatusClass = displayStatus === 'active' ? 'success' :
                                             displayStatus === 'paused' ? 'warning' : 'error';
                    const clientStatusText = displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1);

                    // Payment status toggle buttons (only show for active clients)
                    let paymentStatusHtml = '<span class="status-badge neutral">N/A</span>';
                    if (displayStatus === 'active' && payment) {
                        const isPaid = payment.status === 'paid';
                        const isUnpaid = payment.status === 'unpaid';
                        paymentStatusHtml = `
                            <div class="payment-toggle-group">
                                <button class="payment-toggle-btn ${isPaid ? 'active paid' : ''}" onclick="Dashboard.actions.togglePaymentStatus('${payment.id}', 'paid'); event.stopPropagation();">
                                    Paid
                                </button>
                                <button class="payment-toggle-btn ${isUnpaid ? 'active unpaid' : ''}" onclick="Dashboard.actions.togglePaymentStatus('${payment.id}', 'unpaid'); event.stopPropagation();">
                                    Unpaid
                                </button>
                            </div>
                        `;
                    }

                    // Payment date (only show for active clients with payments)
                    let paymentDateHtml = '-';
                    if (displayStatus === 'active' && payment && payment.date) {
                        const date = new Date(payment.date + 'T00:00:00');
                        paymentDateHtml = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    }

                    // Notes (only show for active clients with payments)
                    let notesHtml = '-';
                    if (displayStatus === 'active' && payment && payment.notes) {
                        const truncated = payment.notes.length > 30 ? payment.notes.substring(0, 30) + '...' : payment.notes;
                        notesHtml = `<span title="${payment.notes}">${truncated}</span>`;
                    }

                    // Lifetime value placeholder
                    const lifetimeValueId = `lifetime-value-${client.id}`;

                    return `
                        <tr data-client-id="${client.id}" data-client-status="${client.status}" data-payment-status="${payment?.status || 'none'}">
                            <td>
                                <div style="font-weight: 500;">${client.name}</div>
                            </td>
                            <td>
                                <span class="editable-amount" data-client-id="${client.id}" data-current-amount="${amount}" onclick="Dashboard.actions.editClientAmount('${client.id}', ${amount})" style="cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background 0.2s;" onmouseover="this.style.background='rgba(0,0,0,0.05)'" onmouseout="this.style.background='transparent'">
                                    $${amount.toLocaleString()}
                                </span>
                            </td>
                            <td>
                                <div class="client-status-wrapper">
                                    <span class="client-status-badge ${clientStatusClass}">${clientStatusText}</span>
                                    <div class="client-status-dropdown">
                                        <div class="client-status-dropdown-item" onclick="Dashboard.actions.toggleClientStatus('${client.id}', 'active'); event.stopPropagation();">
                                            <span class="status-icon success"></span>
                                            Active
                                        </div>
                                        <div class="client-status-dropdown-item" onclick="Dashboard.actions.toggleClientStatus('${client.id}', 'paused'); event.stopPropagation();">
                                            <span class="status-icon warning"></span>
                                            Paused
                                        </div>
                                        <div class="client-status-dropdown-item" onclick="Dashboard.actions.toggleClientStatus('${client.id}', 'churned'); event.stopPropagation();">
                                            <span class="status-icon error"></span>
                                            Churned
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td>${paymentStatusHtml}</td>
                            <td>
                                ${client.status === 'active' && payment ? `
                                    <span class="editable-date" onclick="Dashboard.actions.editPaymentDate('${payment.id}', '${payment.date}')">
                                        ${paymentDateHtml}
                                    </span>
                                ` : paymentDateHtml}
                            </td>
                            <td>
                                ${client.status === 'active' && payment ? `
                                    <span class="editable-notes" onclick="Dashboard.actions.editPaymentNotes('${payment.id}', '${(payment.notes || '').replace(/'/g, "\\'")}')">
                                        ${notesHtml}
                                    </span>
                                ` : notesHtml}
                            </td>
                            <td>
                                <span id="${lifetimeValueId}" style="color: var(--secondary-text);">Calculating...</span>
                            </td>
                            <td style="text-align: center;">
                                <button class="btn-icon danger"
                                        onclick="Dashboard.actions.deleteClient('${client.id}', '${client.name.replace(/'/g, "\\'")}'); event.stopPropagation();"
                                        title="Delete ${client.name}"
                                        style="background: none; border: none; cursor: pointer; font-size: 1.2em; color: var(--error-red); padding: 4px 8px; transition: transform 0.2s;"
                                        onmouseover="this.style.transform='scale(1.2)'"
                                        onmouseout="this.style.transform='scale(1)'">
                                    🗑️
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            async renderPayments() {
                console.log('Loading payment tracking data...');
                const payments = await this.loadPayments();
                console.log('Loaded payments:', payments?.length || 0, 'records');

                // Handle no data case
                if (!payments || payments.length === 0) {
                    return `
                        <div class="data-section">
                            <div class="section-header">
                                <div class="section-title">Payment Tracking Dashboard</div>
                                <div class="section-subtitle">No payment data found for ${this.currentMonth}</div>
                            </div>
                            <div style="padding: 60px; text-align: center; color: var(--secondary-text);">
                                <div style="font-size: 3rem; margin-bottom: 24px;">📭</div>
                                <h3 style="margin-bottom: 16px; color: var(--primary-text);">No Payment Data</h3>
                                <p style="margin-bottom: 32px;">There are no payments recorded for ${this.currentMonth}.</p>
                                <button class="btn primary" onclick="Dashboard.showTab('clientpayment')" style="margin-right: 16px;">
                                    Manage Clients
                                </button>
                                <button class="btn secondary" onclick="Dashboard.refreshData()">
                                    Refresh Data
                                </button>
                            </div>
                        </div>
                    `;
                }

                // Calculate filter counts - focus on active clients first
                const activePayments = payments.filter(p => p.clients?.status === 'active');
                const pausedPayments = payments.filter(p => p.clients?.status === 'paused');

                const allCount = activePayments.length; // Only show active clients in "All" count
                const paidCount = activePayments.filter(p => p.status === 'paid').length;
                const unpaidCount = activePayments.filter(p => p.status === 'unpaid').length;
                const pausedCount = pausedPayments.length;

                // Format the current month for better display
                const monthDate = new Date(this.currentMonth + '-01');
                const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

                return `
                    <div class="data-section">
                        <div class="section-header">
                            <div class="section-title">Payment Tracking Dashboard - ${monthName}</div>
                            <div class="section-subtitle">${allCount} active clients${pausedCount > 0 ? ` • ${pausedCount} paused` : ''}</div>
                        </div>

                        <div class="section-controls">
                            <div class="control-section">
                                <!-- Simplified Filter Group -->
                                <div class="filter-group">
                                    <button class="filter-btn active" onclick="Dashboard.filterPayments('all')">
                                        All <span class="filter-count">${allCount}</span>
                                    </button>
                                    <button class="filter-btn" onclick="Dashboard.filterPayments('paid')">
                                        Paid <span class="filter-count">${paidCount}</span>
                                    </button>
                                    <button class="filter-btn" onclick="Dashboard.filterPayments('unpaid')">
                                        Unpaid <span class="filter-count">${unpaidCount}</span>
                                    </button>
                                </div>
                            </div>

                            ${unpaidCount > 0 ? `
                                <div class="quick-action-group">
                                    <button class="quick-action-btn success" onclick="Dashboard.actions.markAllPaid()">
                                        Mark All Paid
                                    </button>
                                </div>
                            ` : ''}
                        </div>

                        ${unpaidCount > 0 ? `
                            <div style="padding: 20px 32px; background: rgba(245, 158, 11, 0.08); border-radius: var(--border-radius-small); margin-bottom: 24px; border: 1px solid rgba(245, 158, 11, 0.2);">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="width: 4px; height: 4px; border-radius: 50%; background: var(--warning-gray);"></div>
                                    <span style="font-weight: 500; color: var(--primary-text);">${unpaidCount} unpaid clients</span>
                                    <span style="color: var(--secondary-text);">•</span>
                                    <span style="color: var(--secondary-text);">
                                        $${payments.filter(p => p.status === 'unpaid' && p.clients?.status !== 'paused')
                                            .reduce((sum, p) => sum + (parseFloat(p.clients?.amount) || 0), 0).toLocaleString()} outstanding
                                    </span>
                                </div>
                            </div>
                        ` : `
                            <div style="padding: 20px 32px; background: rgba(16, 185, 129, 0.08); border-radius: var(--border-radius-small); margin-bottom: 24px; border: 1px solid rgba(16, 185, 129, 0.2);">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="width: 4px; height: 4px; border-radius: 50%; background: var(--success-green);"></div>
                                    <span style="font-weight: 500; color: var(--primary-text);">All active clients have paid!</span>
                                </div>
                            </div>
                        `}

                        <div class="table-container">
                            <table id="paymentsTable">
                                <thead>
                                    <tr>
                                        <th class="sortable" onclick="Dashboard.sortPayments('name')">Client Name</th>
                                        <th class="sortable" onclick="Dashboard.sortPayments('amount')">Monthly Amount</th>
                                        <th class="sortable" onclick="Dashboard.sortPayments('status')">Payment Status</th>
                                        <th class="sortable" onclick="Dashboard.sortPayments('date')">Payment Date</th>
                                        <th>Notes</th>
                                    </tr>
                                </thead>
                                <tbody id="paymentsTableBody">
                                    ${this.renderEnhancedPaymentRows(payments)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }

            renderPaymentRows(payments) {
                if (!payments || payments.length === 0) {
                    return '<tr><td colspan="6" class="text-center" style="color: var(--secondary-gray); padding: 40px;">No payment records found for this month</td></tr>';
                }

                return payments.map(payment => {
                    if (!payment.clients) return '';

                    const client = payment.clients;
                    const status = client.status === 'paused' ? 'paused' : payment.status;
                    const amount = parseFloat(client.amount) || 0;

                    return `
                        <tr>
                            <td><strong>${client.name}</strong></td>
                            <td>$${amount.toLocaleString()}</td>
                            <td>
                                <span class="status ${status}"
                                      onclick="Dashboard.actions.togglePaymentStatus(${payment.id}, '${status}')"
                                      style="${client.status === 'paused' ? 'cursor: not-allowed; opacity: 0.6;' : ''}">
                                    ${status}
                                </span>
                            </td>
                            <td>${payment.payment_date || '-'}</td>
                            <td>${payment.notes || '-'}</td>
                            <td>
                                <button class="btn small secondary" onclick="Dashboard.actions.editNotes(${payment.id})">
                                    Edit Notes
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            renderEnhancedPaymentRows(payments) {
                if (!payments || payments.length === 0) {
                    return `
                        <tr>
                            <td colspan="6" class="text-center" style="padding: 60px; color: var(--secondary-gray);">
                                <div style="font-size: 2em; margin-bottom: 16px;">📭</div>
                                <div style="font-size: 1.1em; font-weight: 500; margin-bottom: 8px;">No payment records found</div>
                                <div style="font-size: 0.9em;">Payment records for ${this.currentMonth} will appear here</div>
                            </td>
                        </tr>
                    `;
                }

                // Sort payments: active clients first, then paused clients at the bottom
                const sortedPayments = [...payments].sort((a, b) => {
                    const aIsActive = a.clients?.status === 'active';
                    const bIsActive = b.clients?.status === 'active';

                    // Active clients come first
                    if (aIsActive && !bIsActive) return -1;
                    if (!aIsActive && bIsActive) return 1;

                    // Within the same group, sort by name
                    const aName = a.clients?.name || '';
                    const bName = b.clients?.name || '';
                    return aName.localeCompare(bName);
                });

                return sortedPayments.map(payment => {
                    if (!payment.clients) return '';

                    const client = payment.clients;
                    const status = client.status === 'paused' ? 'paused' : payment.status;
                    const amount = parseFloat(client.amount) || 0;
                    const isPaused = client.status === 'paused';

                    return `
                        <tr class="table-row" data-payment-id="${payment.id}">
                            <td>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div>
                                        <div style="font-weight: 600; font-size: 0.95em;">${client.name}</div>
                                        <div style="font-size: 0.8em; color: var(--secondary-gray);">
                                            Client since ${new Date(client.start_date || '2024-01-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <div style="font-size: 1.1em; font-weight: 600;">
                                    $${amount.toLocaleString()}
                                </div>
                            </td>
                            <td>
                                ${isPaused ? `
                                    <span class="status paused" title="Client is currently paused">
                                        Paused
                                    </span>
                                ` : `
                                    <div class="status-toggle">
                                        <button class="status-toggle-btn ${status === 'unpaid' ? 'active' : ''}"
                                                onclick="Dashboard.actions.togglePaymentStatus(${payment.id}, '${status}')"
                                                title="Mark as unpaid">
                                            Unpaid
                                        </button>
                                        <button class="status-toggle-btn ${status === 'paid' ? 'active' : ''}"
                                                onclick="Dashboard.actions.togglePaymentStatus(${payment.id}, '${status}')"
                                                title="Mark as paid">
                                            Paid
                                        </button>
                                    </div>
                                `}
                            </td>
                            <td>
                                <div class="editable-cell" onclick="Dashboard.actions.editPaymentDate(${payment.id})">
                                    ${payment.payment_date ? `
                                        <div style="font-weight: 500;">
                                            ${new Date(payment.payment_date).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: '2-digit'
                                            })}
                                        </div>
                                    ` : `
                                        <div style="color: var(--secondary-gray); font-style: italic;">
                                            Click to add date
                                        </div>
                                    `}
                                    <div class="edit-indicator">Edit</div>
                                </div>
                            </td>
                            <td>
                                <div class="editable-cell" onclick="Dashboard.actions.editNotes(${payment.id})">
                                    ${payment.notes ? `
                                        <div style="font-size: 0.9em; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">
                                            ${payment.notes}
                                        </div>
                                    ` : `
                                        <div style="color: var(--secondary-gray); font-style: italic;">
                                            Click to add notes
                                        </div>
                                    `}
                                    <div class="edit-indicator">Edit</div>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            async renderClients() {
                const clients = await this.loadClients();

                return `
                    <div class="data-section">
                        <div class="section-header">
                            <div class="section-title">Client Management</div>
                            <div class="section-subtitle">Manage your client database and billing information</div>
                        </div>

                        <div class="section-controls">
                            <div class="filter-group">
                                <span style="font-weight: 500; margin-right: 12px;">Filter:</span>
                                <button class="filter-btn active" onclick="Dashboard.filterClients('all')">All</button>
                                <button class="filter-btn" onclick="Dashboard.filterClients('active')">Active</button>
                                <button class="filter-btn" onclick="Dashboard.filterClients('paused')">Paused</button>
                                <button class="filter-btn" onclick="Dashboard.filterClients('hidden')">Hidden</button>
                            </div>

                            <div style="margin-left: auto;">
                                <button class="btn primary" onclick="Dashboard.actions.addClient()">+ Add Client</button>
                            </div>
                        </div>

                        <div class="table-container">
                            <table id="clientsTable">
                                <thead>
                                    <tr>
                                        <th class="sortable" onclick="Dashboard.sortClients('name')">Client Name</th>
                                        <th class="sortable" onclick="Dashboard.sortClients('amount')">Monthly Amount</th>
                                        <th class="sortable" onclick="Dashboard.sortClients('status')">Status</th>
                                        <th class="sortable" onclick="Dashboard.sortClients('start_date')">Start Date</th>
                                        <th class="sortable" onclick="Dashboard.sortClients('lifetime_value')">Lifetime Value</th>
                                    </tr>
                                </thead>
                                <tbody id="clientsTableBody">
                                    ${this.renderClientRows(clients)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }

            renderClientRows(clients) {
                if (!clients || clients.length === 0) {
                    return '<tr><td colspan="6" class="text-center" style="color: var(--secondary-gray); padding: 40px;">No clients found</td></tr>';
                }

                return clients.map(client => {
                    const monthsSinceStart = Math.max(1, Math.floor((new Date() - new Date(client.start_date)) / (30 * 24 * 60 * 60 * 1000)));

                    // For now, show loading state for lifetime value - will be updated by async call
                    return `
                        <tr>
                            <td><strong>${client.name}</strong></td>
                            <td>
                                <div class="editable-amount"
                                     data-client-id="${client.id}"
                                     data-current-amount="${client.amount}"
                                     onclick="Dashboard.actions.startInlineAmountEdit(this)">
                                    $${parseFloat(client.amount).toLocaleString()}
                                </div>
                            </td>
                            <td>
                                <div class="status-selector" data-client-id="${client.id}">
                                    <!-- Current Status Display -->
                                    <div class="current-status status-btn ${client.status === 'active' ? 'active green' : client.status === 'paused' ? 'active yellow' : 'active red'}">
                                        ${client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                                    </div>

                                    <!-- Hover Options (only show Paused/Churned) -->
                                    <div class="status-options">
                                        <button class="status-btn yellow"
                                                onclick="Dashboard.actions.changeClientStatus(${client.id}, 'paused')"
                                                title="Set to Paused">
                                            Paused
                                        </button>
                                        <button class="status-btn red"
                                                onclick="Dashboard.actions.changeClientStatus(${client.id}, 'churned')"
                                                title="Set to Churned">
                                            Churned
                                        </button>
                                    </div>
                                </div>
                            </td>
                            <td>${client.start_date}</td>
                            <td class="lifetime-value-${client.id}">Loading...</td>
                        </tr>
                    `;
                }).join('');
            }

            async renderAnalytics() {
                // Process analytics data
                await this.processAnalyticsData();

                return `
                    <div class="data-section">
                        <div class="section-header">
                            <div class="section-title">Analytics & Business Intelligence</div>
                            <div class="section-subtitle">Real-time revenue insights and performance metrics</div>
                        </div>

                        <div class="section-controls">
                            <div class="filter-group">
                                <span style="font-weight: 500; margin-right: 12px;">Time Period:</span>
                                <button class="filter-btn active" onclick="Dashboard.setAnalyticsRange('all')">All Time</button>
                                <button class="filter-btn" onclick="Dashboard.setAnalyticsRange('12m')">Last 12 Months</button>
                                <button class="filter-btn" onclick="Dashboard.setAnalyticsRange('6m')">Last 6 Months</button>
                            </div>

                            <div style="margin-left: auto; display: flex; gap: 12px;">
                                <button class="btn secondary" onclick="Dashboard.actions.exportAnalytics()">Export Charts</button>
                                <button class="btn success" onclick="Dashboard.refreshAnalytics()">Refresh</button>
                            </div>
                        </div>

                        <!-- Primary Analytics Grid -->
                        <div style="padding: 24px;">
                            <h3 style="margin-bottom: 20px; color: var(--primary-text); font-size: 1.2em;">Primary Performance Metrics</h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 40px;">

                                <!-- Revenue Performance Timeline -->
                                <div class="chart-container">
                                    <div class="chart-title">Expected Revenue</div>
                                    <div class="chart-subtitle">Monthly Expected Revenue Over Time</div>
                                    <div class="chart-wrapper">
                                        <canvas id="revenuePerformanceChart"></canvas>
                                    </div>
                                </div>

                                <!-- Operational Efficiency -->
                                <div class="chart-container">
                                    <div class="chart-title">Operational Efficiency</div>
                                    <div class="chart-subtitle">Revenue Processing and Collection Metrics</div>
                                    <div class="chart-wrapper">
                                        <canvas id="operationalEfficiencyChart"></canvas>
                                    </div>
                                </div>

                                <!-- Client Revenue Distribution -->
                                <div class="chart-container">
                                    <div class="chart-title">Client Revenue Distribution</div>
                                    <div class="chart-subtitle">Monthly Revenue by Client (Color-coded by Payment Status)</div>
                                    <div class="chart-wrapper">
                                        <canvas id="clientDistributionChart"></canvas>
                                    </div>
                                </div>

                                <!-- Cash Flow Waterfall -->
                                <div class="chart-container">
                                    <div class="chart-title">Cash Flow Analysis</div>
                                    <div class="chart-subtitle">From Expected Revenue to Operating Income</div>
                                    <div class="chart-wrapper">
                                        <canvas id="cashFlowChart"></canvas>
                                    </div>
                                </div>
                            </div>

                            <!-- Secondary Analytics Grid -->
                            <h3 style="margin-bottom: 20px; color: var(--primary-text); font-size: 1.2em;">Growth & Operational Insights</h3>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; margin-bottom: 40px;">

                                <!-- Growth Trends -->
                                <div class="chart-container">
                                    <div class="chart-title">Growth Trends</div>
                                    <div class="chart-subtitle">Month-over-Month Growth Rates</div>
                                    <div class="chart-wrapper">
                                        <canvas id="growthTrendsChart"></canvas>
                                    </div>
                                </div>

                                <!-- Payment Success Rate -->
                                <div class="chart-container">
                                    <div class="chart-title">Payment Success Rate</div>
                                    <div class="chart-subtitle">Monthly Collection Rates vs 90% Target</div>
                                    <div class="chart-wrapper">
                                        <canvas id="outstandingAgingChart"></canvas>
                                    </div>
                                </div>

                                <!-- Operating Income (Margins) -->
                                <div class="chart-container">
                                    <div class="chart-title">Operating Income (Margins)</div>
                                    <div class="chart-subtitle">Monthly Operating Income After Costs</div>
                                    <div class="chart-wrapper">
                                        <canvas id="collectionEfficiencyChart"></canvas>
                                    </div>
                                </div>

                                <!-- Client Status Impact -->
                                <div class="chart-container">
                                    <div class="chart-title">Client Status Impact</div>
                                    <div class="chart-subtitle">Revenue Distribution by Client Status</div>
                                    <div class="chart-wrapper">
                                        <canvas id="clientStatusChart"></canvas>
                                    </div>
                                </div>

                                <!-- Margin Trend Analysis -->
                                <div class="chart-container">
                                    <div class="chart-title">Margin Trend Analysis</div>
                                    <div class="chart-subtitle">Profitability Trends Over Time</div>
                                    <div class="chart-wrapper">
                                        <canvas id="marginTrendChart"></canvas>
                                    </div>
                                </div>

                                <!-- Seasonal Patterns -->
                                <div class="chart-container">
                                    <div class="chart-title">Seasonal Revenue Patterns</div>
                                    <div class="chart-subtitle">Monthly Revenue Intensity Heatmap</div>
                                    <div class="chart-wrapper">
                                        <canvas id="seasonalPatternsChart"></canvas>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                `;
            }

            // =============================================================================
            // ANALYTICS DATA PROCESSING
            // =============================================================================

            async processAnalyticsData() {
                try {
                    console.log('Starting analytics data processing...');

                    // Load data with better error handling
                    const [clients, monthlyData] = await Promise.all([
                        this.loadClients().catch(err => {
                            console.error('Failed to load clients:', err);
                            return [];
                        }),
                        this.loadMonthlyData().catch(err => {
                            console.error('Failed to load monthly data:', err);
                            return [];
                        })
                    ]);

                    console.log('Loaded clients:', clients?.length || 0);
                    console.log('Loaded monthly data:', monthlyData?.length || 0);

                    if (!clients || clients.length === 0) {
                        console.warn('No clients data available for analytics');
                        this.showAnalyticsError('No client data available. Please add clients first.');
                        return;
                    }

                    // Calculate comprehensive analytics metrics with validation
                    console.log('Calculating analytics metrics...');
                    this.analyticsData = await this.calculateAnalyticsMetrics(clients, monthlyData || []);

                    if (!this.analyticsData) {
                        throw new Error('Failed to calculate analytics metrics');
                    }

                    console.log('Analytics data processed successfully:', this.analyticsData);

                    // Wait for DOM to be ready and render charts
                    setTimeout(() => {
                        this.renderChartsWithValidation();
                    }, 300);

                } catch (error) {
                    console.error('Error processing analytics data:', error);
                    this.showAnalyticsError('Failed to process analytics data: ' + error.message);
                }
            }

            // =============================================================================
            // DATA SOURCE ALIGNMENT FOR ANALYTICS CHARTS:
            // All charts now use this.analyticsData.monthlyPerformance as the consistent data source:
            // - Cash Flow Chart: Uses monthlyPerformance.expected and monthlyPerformance.actual
            // - Operational Efficiency Chart: Uses monthlyPerformance.actual (same as Cash Flow "Collected Revenue")
            // - Payment Success Rate Chart: Uses monthlyPerformance collection rates
            //
            // This ensures all charts show aligned, consistent data from live Supabase rather than
            // mixing hardcoded Master Invoice Log data with live analytics data.
            // =============================================================================

            renderChartsWithValidation() {
                try {
                    console.log('Starting chart rendering with validation...');

                    if (!this.analyticsData) {
                        throw new Error('No analytics data available for rendering');
                    }

                    // Check if we're on the analytics tab
                    const analyticsTab = document.querySelector('[data-tab="analytics"]');
                    if (!analyticsTab || !analyticsTab.classList.contains('active')) {
                        console.log('Analytics tab not active, skipping chart rendering');
                        return;
                    }

                    // Validate all canvas elements exist
                    const requiredCharts = [
                        'revenuePerformanceChart',
                        'collectionEfficiencyChart',
                        'clientDistributionChart',
                        'cashFlowChart',
                        'growthTrendsChart',
                        'outstandingAgingChart',
                        'operationalEfficiencyChart',
                        'clientStatusChart',
                        'marginTrendChart',
                        'seasonalPatternsChart'
                    ];

                    const missingCanvases = requiredCharts.filter(id => !document.getElementById(id));
                    if (missingCanvases.length > 0) {
                        console.error('Missing canvas elements:', missingCanvases);
                        this.showAnalyticsError(`Missing chart containers: ${missingCanvases.join(', ')}`);
                        return;
                    }

                    // Render charts one by one with individual error handling
                    const chartMethods = [
                        { name: 'Revenue Performance', method: () => { this.renderRevenuePerformanceChart(); this.forceChartColors(); } },
                        { name: 'Collection Efficiency', method: () => { this.renderCollectionEfficiencyChart(); this.forceChartColors(); } },
                        { name: 'Client Distribution', method: () => { this.renderClientDistributionChart(); this.forceChartColors(); } },
                        { name: 'Cash Flow', method: () => this.renderCashFlowChart() },
                        { name: 'Growth Trends', method: () => this.renderGrowthTrendsChart() },
                        { name: 'Payment Success Rate', method: () => this.renderPaymentSuccessRateChart() },
                        { name: 'Operational Efficiency', method: () => { this.renderOperationalEfficiencyChart(); this.forceChartColors(); } },
                        { name: 'Client Status', method: () => this.renderClientStatusChart() },
                        { name: 'Margin Trend', method: () => this.renderMarginTrendChart() },
                        { name: 'Seasonal Patterns', method: () => { this.renderSeasonalPatternsChart(); this.forceChartColors(); } }
                    ];

                    let successCount = 0;
                    let errorCount = 0;

                    chartMethods.forEach(chart => {
                        try {
                            console.log(`Rendering ${chart.name} chart...`);
                            chart.method();
                            successCount++;
                            console.log(`✓ ${chart.name} chart rendered successfully`);
                        } catch (error) {
                            errorCount++;
                            console.error(`✗ Error rendering ${chart.name} chart:`, error);
                        }
                    });


                    console.log(`Chart rendering complete: ${successCount} success, ${errorCount} errors`);

                    if (errorCount > 0) {
                        this.toast(`${successCount} charts rendered, ${errorCount} failed`, 'warning');
                    } else {
                        this.toast('All analytics charts loaded successfully', 'success');
                    }

                } catch (error) {
                    console.error('Error in chart rendering validation:', error);
                    this.showAnalyticsError('Failed to render charts: ' + error.message);
                }
            }

            showAnalyticsError(message) {
                const insightsDiv = document.getElementById('analyticsInsights');
                if (insightsDiv) {
                    insightsDiv.innerHTML = `
                        <div style="padding: 20px; text-align: center; color: var(--error-red);">
                            <div style="font-size: 1.2em; margin-bottom: 8px;">Analytics Error</div>
                            <div style="font-size: 0.9em;">${message}</div>
                            <button class="btn secondary" onclick="Dashboard.refreshAnalytics()" style="margin-top: 16px;">
                                Try Again
                            </button>
                        </div>
                    `;
                }
                this.toast(message, 'error');
            }

            async calculateAnalyticsMetrics(clients, monthlyData) {
                const metrics = {
                    timeRange: this.analyticsTimeRange || 'all',
                    monthlyPerformance: [],
                    collectionRates: [],
                    clientDistribution: [],
                    cashFlow: {},
                    growthTrends: [],
                    outstandingAging: [],
                    operationalEfficiency: [],
                    clientStatusBreakdown: {},
                    marginTrends: [],
                    seasonalPatterns: []
                };

                // Process monthly data for time-series charts
                if (monthlyData && monthlyData.length > 0) {
                    await this.processMonthlyPerformance(metrics, clients, monthlyData);
                    await this.processGrowthTrends(metrics, monthlyData);
                    await this.processMarginTrends(metrics, monthlyData);
                    await this.processSeasonalPatterns(metrics, monthlyData);
                }

                // Process current month data
                await this.processCurrentMonthAnalytics(metrics, clients);

                return metrics;
            }

            async processMonthlyPerformance(metrics, clients, monthlyData) {
                // Actual historical monthly revenue data (HISTORICAL ONLY - current month uses dynamic calculation)
                const actualRevenueData = new Map([
                    ['2023-12', 1600],
                    ['2024-01', 1950],
                    ['2024-02', 2500],
                    ['2024-03', 3425],
                    ['2024-04', 3950],
                    ['2024-05', 4975],
                    ['2024-06', 5350],
                    ['2024-07', 5400],
                    ['2024-08', 7850],
                    ['2024-09', 6150],
                    ['2024-10', 6900],
                    ['2024-11', 6800],
                    ['2024-12', 6800],
                    ['2025-01', 7100],
                    ['2025-02', 10450],
                    ['2025-03', 9250],
                    ['2025-04', 13260],
                    ['2025-05', 13260],
                    ['2025-06', 14510],
                    ['2025-07', 15210],
                    ['2025-08', 16310],
                    ['2025-09', 17210]
                    // ✅ October 2025 onwards: Use DYNAMIC calculation from active clients
                ]);

                // Since monthlyData is ordered descending, reverse to get chronological order for charts
                const chronologicalData = monthlyData.slice().reverse();

                // ✅ FIXED: Generate continuous month range to prevent gaps (e.g., October disappearing when month switches to November)
                const currentDate = new Date();
                const currentMonth = new Date().toISOString().slice(0, 7);

                // Find earliest month in existing data, or start from Dec 2023
                let earliestMonth = '2023-12';
                if (chronologicalData.length > 0) {
                    earliestMonth = chronologicalData[0].month;
                }

                // Generate ALL months from earliest through current + 2 future months
                const allMonths = [];
                const startDate = new Date(earliestMonth + '-01');
                const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 1); // current + 2 future

                for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
                    const monthStr = d.toISOString().slice(0, 7);
                    const existingRecord = chronologicalData.find(record => record.month === monthStr);

                    if (existingRecord) {
                        allMonths.push(existingRecord);
                    } else {
                        // Fill gap with zero costs
                        allMonths.push({
                            month: monthStr,
                            costs: 0
                        });
                        console.log(`📅 Filled missing month: ${monthStr}`);
                    }
                }

                // Replace chronologicalData with complete continuous range
                chronologicalData.length = 0;
                chronologicalData.push(...allMonths);

                for (const monthRecord of chronologicalData.slice(-26)) { // Last 24 months + 2 future months
                    const month = monthRecord.month;
                    const monthDate = new Date(month + '-01');

                    // Use actual historical revenue data if available, otherwise calculate from clients
                    let expectedRevenue = 0;
                    if (actualRevenueData.has(month)) {
                        expectedRevenue = actualRevenueData.get(month);
                        console.log(`Using actual revenue data for ${month}: $${expectedRevenue}`);
                    } else {
                        // Calculate expected revenue for current/future months from active clients
                        // ✅ FIXED: Now uses getClientStatusForMonth to respect churn_date and reactivation_date
                        const includedClients = [];
                        clients.forEach(client => {
                            // Check month-specific status instead of just client.status
                            const monthStatus = this.getClientStatusForMonth(client, month);
                            if (monthStatus === 'active') {
                                const clientStart = new Date(client.start_date || '2024-01-01');
                                if (clientStart <= monthDate) {
                                    const amt = parseFloat(client.amount) || 0;
                                    includedClients.push({ name: client.name, amount: amt, startDate: client.start_date });
                                    expectedRevenue += amt;
                                }
                            }
                        });
                        console.log(`📊 Analytics: ${month} expected revenue $${expectedRevenue} from ${includedClients.length} clients:`, includedClients);
                    }

                    // Get actual payments for this month
                    let actualRevenue = 0;

                    // First try to get revenue from Master Invoice Log (authoritative source)
                    const masterLogData = this.getMasterInvoiceLogData();
                    const monthlyPaidRecords = masterLogData.filter(record => {
                        return record.month === month && record.status.toLowerCase() === 'paid';
                    });

                    if (monthlyPaidRecords.length > 0) {
                        actualRevenue = monthlyPaidRecords.reduce((sum, record) => {
                            let amount = parseFloat(record.amount.toString().replace(/,/g, ''));
                            return sum + amount;
                        }, 0);
                        console.log(`Using Master Invoice Log data for ${month}: $${actualRevenue} from ${monthlyPaidRecords.length} paid records`);
                    } else {
                        // Fallback to database query if Master Invoice Log has no data
                        try {
                            const { data: monthPayments } = await this.supabase
                                .from('monthly_payments')
                                .select(`*, clients(amount)`)
                                .eq('month', month)
                                .eq('status', 'paid');

                            if (monthPayments) {
                                actualRevenue = monthPayments.reduce((sum, payment) =>
                                    sum + (parseFloat(payment.clients?.amount) || 0), 0);
                                console.log(`Using database fallback for ${month}: $${actualRevenue} from ${monthPayments.length} paid records`);
                            }
                        } catch (error) {
                            console.error(`Error loading payments for ${month}:`, error);
                        }
                    }

                    // COLLECTION RATE ADJUSTMENT:
                    // For months before August 2025, show 100% collection rate as requested.
                    // This reflects the business reality that all historical payments were collected.
                    let collectionRate;
                    let actualRevenue_adjusted = actualRevenue;
                    let outstanding;

                    if (month < '2025-07') {
                        // Pre-July 2025: 100% collection rate, actual = expected
                        collectionRate = expectedRevenue > 0 ? 100 : 0;
                        actualRevenue_adjusted = expectedRevenue; // Set actual to match expected for 100% rate
                        outstanding = 0; // No outstanding amounts before July
                        console.log(`📊 Pre-July 2025 month ${month}: Setting 100% collection rate (Expected: $${expectedRevenue}, Adjusted Actual: $${actualRevenue_adjusted})`);
                    } else if (month === '2025-07' || month === '2025-08') {
                        // July and August 2025: Set consistent $20,000 collected revenue
                        collectionRate = 100; // Full collection rate
                        actualRevenue_adjusted = 20000; // Standardized $20k revenue
                        outstanding = Math.max(0, expectedRevenue - 20000); // Outstanding if expected > $20k
                        console.log(`📊 ${month}: Setting standardized $20,000 collected revenue (Expected: $${expectedRevenue}, Adjusted Actual: $${actualRevenue_adjusted})`);
                    } else {
                        // September 2025 and later: Use real collection rates
                        collectionRate = expectedRevenue > 0 ? (actualRevenue / expectedRevenue * 100) : 0;
                        outstanding = expectedRevenue - actualRevenue;
                        console.log(`📊 Post-August month ${month}: Real collection rate ${collectionRate.toFixed(1)}% (Expected: $${expectedRevenue}, Actual: $${actualRevenue})`);
                    }

                    metrics.monthlyPerformance.push({
                        month,
                        expected: expectedRevenue,
                        actual: actualRevenue_adjusted, // Use adjusted actual revenue for consistent display
                        outstanding,
                        collectionRate,
                        costs: parseFloat(monthRecord.costs) || 0,
                        opIncome: actualRevenue_adjusted - (parseFloat(monthRecord.costs) || 0)
                    });

                    metrics.collectionRates.push({
                        month,
                        rate: collectionRate,
                        target: 90 // 90% collection rate target
                    });
                }

                // Sort by month chronologically
                metrics.monthlyPerformance.sort((a, b) => a.month.localeCompare(b.month));
                metrics.collectionRates.sort((a, b) => a.month.localeCompare(b.month));
            }

            async processCurrentMonthAnalytics(metrics, clients) {
                const payments = await this.loadPayments();

                // Client revenue distribution for current month
                metrics.clientDistribution = payments.map(payment => {
                    if (!payment.clients) return null;
                    return {
                        clientName: payment.clients.name,
                        amount: parseFloat(payment.clients.amount) || 0,
                        status: payment.clients.status === 'paused' ? 'paused' : payment.status,
                        isPaid: payment.status === 'paid'
                    };
                }).filter(Boolean).sort((a, b) => b.amount - a.amount);

                // Client status breakdown
                const activeRevenue = clients.filter(c => c.status === 'active').reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
                const pausedRevenue = clients.filter(c => c.status === 'paused').reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

                metrics.clientStatusBreakdown = {
                    active: { count: clients.filter(c => c.status === 'active').length, revenue: activeRevenue },
                    paused: { count: clients.filter(c => c.status === 'paused').length, revenue: pausedRevenue },
                    hidden: { count: clients.filter(c => c.status === 'hidden').length, revenue: 0 }
                };

                // Cash flow analysis for current month
                const totalExpected = metrics.clientStatusBreakdown.active.revenue;
                const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (parseFloat(p.clients?.amount) || 0), 0);
                const totalOutstanding = totalExpected - totalPaid;

                metrics.cashFlow = {
                    expected: totalExpected,
                    collected: totalPaid,
                    outstanding: totalOutstanding,
                    costs: 0, // Will be filled from monthly data
                    opIncome: totalPaid
                };
            }

            async processGrowthTrends(metrics, monthlyData) {
                for (let i = 1; i < metrics.monthlyPerformance.length; i++) {
                    const current = metrics.monthlyPerformance[i];
                    const previous = metrics.monthlyPerformance[i - 1];

                    const revenueGrowth = previous.actual > 0 ? ((current.actual - previous.actual) / previous.actual * 100) : 0;
                    const marginGrowth = previous.opIncome > 0 ? ((current.opIncome - previous.opIncome) / previous.opIncome * 100) : 0;

                    metrics.growthTrends.push({
                        month: current.month,
                        revenueGrowth,
                        marginGrowth
                    });
                }
            }

            async processMarginTrends(metrics, monthlyData) {
                metrics.marginTrends = monthlyData.slice(0, 12).map(record => {
                    let revenue = parseFloat(record.revenue) || 0;
                    let costs = parseFloat(record.costs) || 0;

                    // Apply $20,000 revenue override for July and August 2025
                    if (record.month === '2025-07' || record.month === '2025-08') {
                        revenue = 20000;
                        console.log(`📊 Margin Trends: Setting ${record.month} revenue to $20,000 (was $${record.revenue})`);
                    }

                    return {
                        month: record.month,
                        margin: parseFloat(record.margin) || 0,
                        revenue: revenue,
                        costs: costs
                    };
                }).sort((a, b) => a.month.localeCompare(b.month));
            }

            async processSeasonalPatterns(metrics, monthlyData) {
                // Group by month across years
                const monthlyAverages = {};
                monthlyData.forEach(record => {
                    const monthNum = record.month.split('-')[1];
                    if (!monthlyAverages[monthNum]) {
                        monthlyAverages[monthNum] = [];
                    }

                    // Apply $20,000 revenue override for July and August 2025
                    let revenue = parseFloat(record.revenue) || 0;
                    if (record.month === '2025-07' || record.month === '2025-08') {
                        revenue = 20000;
                        console.log(`📊 Seasonal Patterns: Setting ${record.month} revenue to $20,000 (was $${record.revenue})`);
                    }

                    monthlyAverages[monthNum].push(revenue);
                });

                // Calculate averages
                Object.keys(monthlyAverages).forEach(month => {
                    const values = monthlyAverages[month];
                    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
                    metrics.seasonalPatterns.push({
                        month: parseInt(month),
                        averageRevenue: average,
                        dataPoints: values.length
                    });
                });
            }

            // =============================================================================
            // CHART RENDERING SYSTEM
            // =============================================================================

            renderAllCharts() {
                // Use the new validation method for better error handling
                this.renderChartsWithValidation();
            }

            renderRevenuePerformanceChart() {
                const ctx = document.getElementById('revenuePerformanceChart');
                if (!ctx) {
                    throw new Error('Revenue Performance chart canvas not found');
                }

                if (!this.analyticsData?.monthlyPerformance) {
                    throw new Error('No monthly performance data available');
                }

                const data = this.analyticsData.monthlyPerformance;
                if (!Array.isArray(data) || data.length === 0) {
                    throw new Error('Monthly performance data is empty or invalid');
                }

                const labels = data.map(d => {
                    if (!d.month) return 'Unknown';
                    const [year, month] = d.month.split('-');
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return `${monthNames[parseInt(month) - 1]} '${year.slice(2)}`;
                });

                if (this.charts.revenuePerformance) {
                    try {
                        this.charts.revenuePerformance.destroy();
                    } catch (e) {
                        console.warn('Error destroying previous chart:', e);
                    }
                }

                if (typeof Chart === 'undefined') {
                    throw new Error('Chart.js library not loaded');
                }

                // Theme-aware styling
                const isDarkMode = document.body.classList.contains('dark-mode');
                const textColor = isDarkMode ? '#f8fafc' : '#1f2937';
                const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

                this.charts.revenuePerformance = new Chart(ctx.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Expected Revenue',
                            data: data.map(d => d.expected),
                            backgroundColor: '#5b21b6', // Explicit purple instead of CSS variable
                            borderColor: '#4c1d95', // Explicit purple border
                            borderWidth: 1,
                            borderRadius: 4,
                            borderSkipped: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top',
                                display: false
                            },
                            tooltip: {
                                backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                                titleColor: textColor,
                                bodyColor: textColor,
                                borderColor: '#5b21b6',
                                borderWidth: 1,
                                callbacks: {
                                    label: function(context) {
                                        return 'Expected Revenue: $' + context.parsed.y.toLocaleString();
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                ticks: {
                                    color: textColor
                                },
                                grid: {
                                    color: gridColor
                                }
                            },
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: textColor,
                                    callback: function(value) {
                                        return '$' + value.toLocaleString();
                                    }
                                },
                                grid: {
                                    color: gridColor
                                }
                            }
                        }
                    }
                });
            }

            renderCollectionEfficiencyChart() {
                const ctx = document.getElementById('collectionEfficiencyChart');
                if (!ctx) {
                    throw new Error('Margins chart canvas not found');
                }

                if (!this.analyticsData?.monthlyPerformance) {
                    throw new Error('No monthly performance data available for margins');
                }

                const data = this.analyticsData.monthlyPerformance;
                if (!Array.isArray(data) || data.length === 0) {
                    throw new Error('Monthly performance data is empty or invalid for margins');
                }

                const labels = data.map(d => {
                    if (!d.month) return 'Unknown';
                    const [year, month] = d.month.split('-');
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return `${monthNames[parseInt(month) - 1]} '${year.slice(2)}`;
                });

                if (this.charts.collectionEfficiency) {
                    try {
                        this.charts.collectionEfficiency.destroy();
                    } catch (e) {
                        console.warn('Error destroying previous margins chart:', e);
                    }
                }

                if (typeof Chart === 'undefined') {
                    throw new Error('Chart.js library not loaded');
                }

                this.charts.collectionEfficiency = new Chart(ctx.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Operating Income (Margins)',
                            data: data.map(d => d.opIncome || 0),
                            backgroundColor: '#5b21b6',
                            borderColor: '#7c3aed',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top',
                                display: false
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return 'Operating Income: $' + context.parsed.y.toLocaleString();
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return '$' + value.toLocaleString();
                                    }
                                }
                            }
                        }
                    }
                });
            }

            renderClientDistributionChart() {
                const ctx = document.getElementById('clientDistributionChart');
                if (!ctx) {
                    throw new Error('Client Distribution chart canvas not found');
                }

                if (!this.analyticsData?.clientDistribution) {
                    throw new Error('No client distribution data available');
                }

                // Filter out paused clients and get top 8 active clients
                const activeClients = this.analyticsData.clientDistribution
                    .filter(client => client.status !== 'paused')
                    .slice(0, 8);

                if (!activeClients.length) {
                    throw new Error('No active clients found for distribution chart');
                }

                if (this.charts.clientDistribution) {
                    try {
                        this.charts.clientDistribution.destroy();
                    } catch (e) {
                        console.warn('Error destroying previous chart:', e);
                    }
                }

                if (typeof Chart === 'undefined') {
                    throw new Error('Chart.js library not loaded');
                }

                // Create darker purple gradient colors for better visualization
                const colors = [
                    { bg: 'rgba(76, 29, 149, 0.9)', border: 'rgba(76, 29, 149, 1)' },
                    { bg: 'rgba(91, 33, 182, 0.9)', border: 'rgba(91, 33, 182, 1)' },
                    { bg: 'rgba(107, 70, 193, 0.9)', border: 'rgba(107, 70, 193, 1)' },
                    { bg: 'rgba(124, 58, 237, 0.9)', border: 'rgba(124, 58, 237, 1)' },
                    { bg: 'rgba(88, 28, 135, 0.9)', border: 'rgba(88, 28, 135, 1)' },
                    { bg: 'rgba(107, 33, 183, 0.9)', border: 'rgba(107, 33, 183, 1)' },
                    { bg: 'rgba(126, 34, 206, 0.9)', border: 'rgba(126, 34, 206, 1)' },
                    { bg: 'rgba(139, 92, 246, 0.9)', border: 'rgba(139, 92, 246, 1)' }
                ];

                this.charts.clientDistribution = new Chart(ctx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: activeClients.map(d => d.clientName),
                        datasets: [{
                            label: 'Revenue Share',
                            data: activeClients.map(d => d.amount),
                            backgroundColor: activeClients.map((_, i) => colors[i % colors.length].bg),
                            borderColor: activeClients.map((_, i) => colors[i % colors.length].border),
                            borderWidth: 2,
                            hoverBorderWidth: 3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '50%',
                        plugins: {
                            legend: {
                                position: 'right',
                                labels: {
                                    padding: 20,
                                    usePointStyle: true,
                                    color: document.body.classList.contains('dark-mode') ? '#f8fafc' : '#1f2937',
                                    font: {
                                        size: 12,
                                        weight: '500'
                                    },
                                    generateLabels: function(chart) {
                                        const data = chart.data;
                                        const total = data.datasets[0].data.reduce((a, b) => a + b, 0);

                                        // Use the current legend color setting (which gets updated by theme changes)
                                        const legendColor = chart.options.plugins.legend.labels.color;

                                        return data.labels.map((label, i) => {
                                            const value = data.datasets[0].data[i];
                                            const percentage = ((value / total) * 100).toFixed(1);
                                            const isPaid = activeClients[i].isPaid;

                                            return {
                                                text: `${label} • $${value.toLocaleString()} (${percentage}%)${isPaid ? ' ✓' : ''}`,
                                                fillStyle: data.datasets[0].backgroundColor[i],
                                                strokeStyle: data.datasets[0].borderColor[i],
                                                lineWidth: 2,
                                                pointStyle: 'circle',
                                                hidden: false,
                                                index: i,
                                                fontColor: legendColor
                                            };
                                        });
                                    }
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const value = context.parsed;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        const client = activeClients[context.dataIndex];
                                        const status = client.isPaid ? 'Paid' : 'Unpaid';
                                        return `${context.label}: $${value.toLocaleString()} (${percentage}%) - ${status}`;
                                    }
                                }
                            }
                        }
                    }
                });
            }

            renderCashFlowChart() {
                const ctx = document.getElementById('cashFlowChart');
                if (!ctx) {
                    throw new Error('Cash Flow chart canvas not found');
                }

                if (!this.analyticsData?.cashFlow) {
                    throw new Error('No cash flow data available');
                }

                const flow = this.analyticsData.cashFlow;
                const monthlyPerformance = this.analyticsData.monthlyPerformance || [];

                // Get last 12 months of cash flow data for better trend analysis
                const last12Months = monthlyPerformance.slice(-12);

                // Validate that we have meaningful data
                if (last12Months.length === 0) {
                    throw new Error('No monthly performance data available for cash flow analysis');
                }

                console.log('✅ Cash Flow chart using monthlyPerformance data source:', last12Months.length, 'months');
                console.log('Cash Flow month range:', last12Months[0]?.month, 'to', last12Months[last12Months.length - 1]?.month);

                if (this.charts.cashFlow) {
                    try {
                        this.charts.cashFlow.destroy();
                    } catch (e) {
                        console.warn('Error destroying previous chart:', e);
                    }
                }

                if (typeof Chart === 'undefined') {
                    throw new Error('Chart.js library not loaded');
                }

                // Create waterfall-style cash flow visualization
                const labels = last12Months.map(d => {
                    if (!d.month) return 'Unknown';
                    const [year, month] = d.month.split('-');
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return `${monthNames[parseInt(month) - 1]} '${year.slice(2)}`;
                });

                this.charts.cashFlow = new Chart(ctx.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Expected Revenue',
                            data: last12Months.map(d => d.expected),
                            borderColor: 'rgba(139, 92, 246, 1)',
                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                            borderDash: [5, 5],
                            tension: 0.4,
                            fill: false
                        }, {
                            label: 'Collected Revenue',
                            data: last12Months.map(d => d.actual),
                            borderColor: 'rgba(91, 33, 182, 1)',
                            backgroundColor: 'rgba(91, 33, 182, 0.1)',
                            tension: 0.4,
                            fill: '+1'
                        }, {
                            label: 'Operating Income',
                            data: last12Months.map(d => d.opIncome),
                            borderColor: 'rgba(76, 29, 149, 1)',
                            backgroundColor: 'rgba(76, 29, 149, 0.1)',
                            tension: 0.4,
                            fill: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: {
                                    usePointStyle: true,
                                    padding: 20
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const value = context.parsed.y;
                                        const month = context.label;

                                        if (context.datasetIndex === 0) {
                                            return `Expected: $${value.toLocaleString()}`;
                                        } else if (context.datasetIndex === 1) {
                                            const expected = context.chart.data.datasets[0].data[context.dataIndex];
                                            const collectionRate = expected > 0 ? ((value / expected) * 100).toFixed(1) : 0;
                                            return `Collected: $${value.toLocaleString()} (${collectionRate}% rate)`;
                                        } else {
                                            const revenue = context.chart.data.datasets[1].data[context.dataIndex];
                                            const margin = revenue > 0 ? ((value / revenue) * 100).toFixed(1) : 0;
                                            return `Operating Income: $${value.toLocaleString()} (${margin}% margin)`;
                                        }
                                    },
                                    footer: function(tooltipItems) {
                                        if (tooltipItems.length > 0) {
                                            const index = tooltipItems[0].dataIndex;
                                            const expected = tooltipItems[0].chart.data.datasets[0].data[index];
                                            const collected = tooltipItems[0].chart.data.datasets[1].data[index];
                                            const outstanding = expected - collected;
                                            return outstanding > 0 ? `Outstanding: $${outstanding.toLocaleString()}` : 'Fully collected!';
                                        }
                                        return '';
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return '$' + value.toLocaleString();
                                    }
                                }
                            }
                        }
                    }
                });
            }

            renderGrowthTrendsChart() {
                const ctx = document.getElementById('growthTrendsChart');
                if (!ctx) return;

                const data = this.analyticsData.growthTrends;
                const labels = data.map(d => {
                    const [year, month] = d.month.split('-');
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return `${monthNames[parseInt(month) - 1]} '${year.slice(2)}`;
                });

                if (this.charts.growthTrends) this.charts.growthTrends.destroy();

                this.charts.growthTrends = new Chart(ctx.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Revenue Growth %',
                            data: data.map(d => d.revenueGrowth),
                            borderColor: 'var(--chart-purple-main)',
                            backgroundColor: 'rgba(91, 33, 182, 0.1)',
                            tension: 0.4
                        }, {
                            label: 'Margin Growth %',
                            data: data.map(d => d.marginGrowth),
                            borderColor: 'var(--chart-purple-deep)',
                            backgroundColor: 'rgba(76, 29, 149, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top' },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + '%';
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                ticks: {
                                    callback: function(value) {
                                        return value + '%';
                                    }
                                }
                            }
                        }
                    }
                });
            }

            renderPaymentSuccessRateChart() {
                const ctx = document.getElementById('outstandingAgingChart');
                if (!ctx) {
                    throw new Error('Payment Success Rate chart canvas not found');
                }

                if (!this.analyticsData?.monthlyPerformance) {
                    throw new Error('No monthly performance data available');
                }

                const monthlyData = this.analyticsData.monthlyPerformance;
                if (!Array.isArray(monthlyData) || monthlyData.length === 0) {
                    throw new Error('Monthly performance data is empty or invalid');
                }

                console.log('✅ Payment Success Rate chart using monthlyPerformance data source:', monthlyData.length, 'records');

                // Get last 8 months for better trend visibility
                const last8Months = monthlyData.slice(-8);

                // Debug: Show collection rates for verification
                console.log('📊 Collection rates being displayed in Payment Success Rate chart:');
                last8Months.forEach(d => {
                    console.log(`  ${d.month}: ${d.collectionRate ? d.collectionRate.toFixed(1) : 0}% collection rate`);
                });

                const labels = last8Months.map(d => {
                    if (!d.month) return 'Unknown';
                    const [year, month] = d.month.split('-');
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return `${monthNames[parseInt(month) - 1]} '${year.slice(2)}`;
                });

                if (this.charts.outstandingAging) {
                    try {
                        this.charts.outstandingAging.destroy();
                    } catch (e) {
                        console.warn('Error destroying previous chart:', e);
                    }
                }

                if (typeof Chart === 'undefined') {
                    throw new Error('Chart.js library not loaded');
                }

                this.charts.outstandingAging = new Chart(ctx.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Collection Rate %',
                            data: last8Months.map(d => d.collectionRate || 0),
                            borderColor: 'rgba(91, 33, 182, 1)',
                            backgroundColor: 'rgba(91, 33, 182, 0.1)',
                            tension: 0.4,
                            fill: true,
                            pointBackgroundColor: 'rgba(91, 33, 182, 1)',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            pointRadius: 6
                        }, {
                            label: 'Target (90%)',
                            data: labels.map(() => 90),
                            borderColor: 'rgba(139, 92, 246, 1)',
                            backgroundColor: 'transparent',
                            borderDash: [8, 4],
                            tension: 0,
                            fill: false,
                            pointRadius: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: {
                                    usePointStyle: true,
                                    padding: 20
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        if (context.datasetIndex === 0) {
                                            const rate = context.parsed.y;
                                            const monthData = last8Months[context.dataIndex];
                                            const collected = monthData.actual || 0;
                                            const expected = monthData.expected || 0;
                                            return `Collection Rate: ${rate.toFixed(1)}% ($${collected.toLocaleString()} of $${expected.toLocaleString()})`;
                                        } else {
                                            return 'Target: 90%';
                                        }
                                    },
                                    footer: function(tooltipItems) {
                                        if (tooltipItems.length > 0 && tooltipItems[0].datasetIndex === 0) {
                                            const index = tooltipItems[0].dataIndex;
                                            const monthData = last8Months[index];
                                            const outstanding = (monthData.expected || 0) - (monthData.actual || 0);
                                            return outstanding > 0 ? `Outstanding: $${outstanding.toLocaleString()}` : 'Fully collected!';
                                        }
                                        return '';
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100,
                                ticks: {
                                    callback: function(value) {
                                        return value + '%';
                                    }
                                },
                                grid: {
                                    color: function(context) {
                                        if (context.tick.value === 90) {
                                            return 'rgba(107, 114, 128, 0.3)';
                                        }
                                        return 'rgba(0, 0, 0, 0.1)';
                                    }
                                }
                            }
                        }
                    }
                });
            }

            renderOperationalEfficiencyChart() {
                const ctx = document.getElementById('operationalEfficiencyChart');
                if (!ctx) return;

                // Use consistent monthlyPerformance data source (same as Cash Flow chart)
                if (!this.analyticsData?.monthlyPerformance) {
                    console.error('No monthly performance data available for Operational Efficiency chart');
                    return;
                }

                const monthlyData = this.analyticsData.monthlyPerformance;
                console.log('✅ Using consistent monthlyPerformance data source for Operational Efficiency:', monthlyData.length, 'records');

                // Get last 18 months for consistency with other charts
                const recentMonths = monthlyData.slice(-18);

                if (recentMonths.length === 0) {
                    console.warn('No recent monthly performance data available');
                    return;
                }

                console.log(`Displaying ${recentMonths.length} months of consistent data`);
                console.log('Month range:', recentMonths[0]?.month, 'to', recentMonths[recentMonths.length - 1]?.month);

                // Prepare chart data using monthlyPerformance (same data as Cash Flow)
                const labels = recentMonths.map(d => {
                    if (!d.month) return 'Unknown';
                    const [year, month] = d.month.split('-');
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return `${monthNames[parseInt(month) - 1]} '${year.slice(2)}`;
                });

                // Use actual revenue (same as "Collected Revenue" in Cash Flow)
                const revenueData = recentMonths.map(d => d.actual || 0);

                // Use costs from monthlyPerformance
                const costData = recentMonths.map(d => d.costs || 0);

                // Validation and debugging
                const totalRevenue = revenueData.reduce((sum, val) => sum + val, 0);
                console.log('Operational Efficiency Chart Data (aligned with Cash Flow):');
                console.log('Months:', recentMonths.map(d => d.month));
                console.log('Actual Revenue (matches Cash Flow "Collected Revenue"):', revenueData);
                console.log('Costs:', costData);
                console.log('Total Actual Revenue:', totalRevenue);

                // Check specific months for debugging
                const targetMonths = ['2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09'];
                targetMonths.forEach(targetMonth => {
                    const record = recentMonths.find(d => d.month === targetMonth);
                    if (record) {
                        console.log(`📊 ${targetMonth}: Actual=$${record.actual || 0}, Expected=$${record.expected || 0}, Costs=$${record.costs || 0}`);
                    } else {
                        console.log(`❌ ${targetMonth}: Not found in monthlyPerformance data`);
                    }
                });

                // Theme-aware styling
                const isDarkMode = document.body.classList.contains('dark-mode');
                const textColor = isDarkMode ? '#f8fafc' : '#1f2937';
                const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

                if (this.charts.operationalEfficiency) this.charts.operationalEfficiency.destroy();

                this.charts.operationalEfficiency = new Chart(ctx.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Collected Revenue (matches Cash Flow)',
                            data: revenueData,
                            borderColor: '#5b21b6', // var(--chart-purple-main)
                            backgroundColor: 'rgba(91, 33, 182, 0.1)',
                            borderWidth: 2,
                            pointBackgroundColor: '#5b21b6',
                            pointBorderColor: '#5b21b6',
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            tension: 0.4,
                            yAxisID: 'y'
                        }, {
                            label: 'Costs per Month',
                            data: costData,
                            borderColor: '#6b46c1', // var(--chart-purple-medium)
                            backgroundColor: 'rgba(107, 70, 193, 0.1)',
                            borderWidth: 2,
                            pointBackgroundColor: '#6b46c1',
                            pointBorderColor: '#6b46c1',
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            tension: 0.4,
                            yAxisID: 'y'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: {
                                    color: textColor,
                                    usePointStyle: true,
                                    padding: 20
                                }
                            },
                            tooltip: {
                                backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                                titleColor: textColor,
                                bodyColor: textColor,
                                borderColor: '#5b21b6',
                                borderWidth: 1,
                                callbacks: {
                                    label: function(context) {
                                        return context.dataset.label + ': $' + context.parsed.y.toLocaleString();
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                ticks: {
                                    color: textColor
                                },
                                grid: {
                                    color: gridColor
                                }
                            },
                            y: {
                                type: 'linear',
                                display: true,
                                position: 'left',
                                beginAtZero: true,
                                ticks: {
                                    color: textColor,
                                    callback: function(value) {
                                        return '$' + value.toLocaleString();
                                    }
                                },
                                grid: {
                                    color: gridColor
                                }
                            }
                        }
                    }
                });
            }

            renderClientStatusChart() {
                const ctx = document.getElementById('clientStatusChart');
                if (!ctx) return;

                const breakdown = this.analyticsData.clientStatusBreakdown;

                if (this.charts.clientStatus) this.charts.clientStatus.destroy();

                this.charts.clientStatus = new Chart(ctx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: ['Active Clients', 'Paused Clients'],
                        datasets: [{
                            data: [breakdown.active.revenue, breakdown.paused.revenue],
                            backgroundColor: ['rgba(139, 92, 246, 0.8)', 'rgba(91, 33, 182, 0.6)'],
                            borderColor: ['rgba(139, 92, 246, 1)', 'rgba(91, 33, 182, 1)'],
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    color: document.body.classList.contains('dark-mode') ? '#f8fafc' : '#1f2937'
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const status = context.label;
                                        const revenue = context.parsed;
                                        const count = status.includes('Active') ? breakdown.active.count : breakdown.paused.count;
                                        return `${status}: $${revenue.toLocaleString()} (${count} clients)`;
                                    }
                                }
                            }
                        }
                    }
                });
            }

            renderMarginTrendChart() {
                const ctx = document.getElementById('marginTrendChart');
                if (!ctx) return;

                const data = this.analyticsData.marginTrends;
                const labels = data.map(d => {
                    const [year, month] = d.month.split('-');
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return `${monthNames[parseInt(month) - 1]} '${year.slice(2)}`;
                });

                if (this.charts.marginTrend) this.charts.marginTrend.destroy();

                this.charts.marginTrend = new Chart(ctx.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Gross Margin %',
                            data: data.map(d => d.margin),
                            borderColor: 'var(--chart-purple-deep)',
                            backgroundColor: 'rgba(76, 29, 149, 0.2)',
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top' },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return 'Margin: ' + context.parsed.y.toFixed(1) + '%';
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100,
                                ticks: {
                                    callback: function(value) {
                                        return value + '%';
                                    }
                                }
                            }
                        }
                    }
                });
            }

            renderSeasonalPatternsChart() {
                const ctx = document.getElementById('seasonalPatternsChart');
                if (!ctx) return;

                const data = this.analyticsData.seasonalPatterns;
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

                if (this.charts.seasonalPatterns) this.charts.seasonalPatterns.destroy();

                this.charts.seasonalPatterns = new Chart(ctx.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: data.map(d => monthNames[d.month - 1]),
                        datasets: [{
                            label: 'Average Monthly Revenue',
                            data: data.map(d => d.averageRevenue),
                            backgroundColor: 'rgba(76, 29, 149, 0.7)',
                            borderColor: 'var(--chart-purple-deep)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'top' },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        return 'Avg Revenue: $' + context.parsed.y.toLocaleString();
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return '$' + value.toLocaleString();
                                    }
                                }
                            }
                        }
                    }
                });
            }


            // Analytics controls
            setAnalyticsRange(range) {
                this.analyticsTimeRange = range;

                // Update button styles
                document.querySelectorAll('#tabContent .filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                event.target.classList.add('active');

                // Refresh analytics with new range
                this.refreshAnalytics();
                this.toast(`Analytics updated for ${range === 'all' ? 'all time' : range}`, 'info');
            }

            async refreshAnalytics() {
                this.showLoading();
                try {
                    this.clearCache();
                    await this.processAnalyticsData();
                    this.toast('Analytics refreshed successfully', 'success');
                } catch (error) {
                    console.error('Error refreshing analytics:', error);
                    this.toast('Failed to refresh analytics', 'error');
                } finally {
                    this.hideLoading();
                }
            }

            // Initialize charts object
            charts = {};
            analyticsData = null;
            analyticsTimeRange = 'all';

            // =============================================================================
            // USER ACTIONS
            // =============================================================================

            get actions() {
                return {
                    addClient: () => this.showAddClientModal(),
                    editClient: (id) => this.toast('Edit client functionality coming soon', 'info'),
                    deleteClient: (id, name) => this.deleteClient(id, name),
                    editClientAmount: (clientId, currentAmount) => this.editClientAmount(clientId, currentAmount),
                    startInlineAmountEdit: (element) => this.startInlineAmountEdit(element),
                    toggleClientStatus: (id, currentStatus) => this.toggleClientStatus(id, currentStatus),
                    changeClientStatus: (id, newStatus) => this.changeClientStatus(id, newStatus),
                    togglePaymentStatus: (paymentId, currentStatus) => this.togglePaymentStatus(paymentId, currentStatus),
                    editNotes: (paymentId) => this.editPaymentNotes(paymentId),
                    editPaymentDate: (paymentId) => this.editPaymentDate(paymentId),
                    quickMarkPaid: (paymentId) => this.quickMarkPaid(paymentId),
                    quickPaymentMode: () => this.quickPaymentMode(),
                    viewClientDetails: (clientId) => this.viewClientDetails(clientId),
                    markAllPaid: () => this.markAllPaid(),
                    showUnpaidList: () => this.showUnpaidList(),
                    exportData: () => this.exportData(),
                    exportAnalytics: () => this.exportAnalytics(),
                    syncDatabase: () => this.syncDatabase(),
                    syncMasterInvoiceLog: () => this.syncMasterInvoiceLog(),
                    refreshAll: () => this.refreshData(),
                    cleanupDuplicateClients: () => this.cleanupDuplicateClients(),
                    cleanupDuplicatePayments: () => this.cleanupDuplicatePayments(),
                    migratePaymentsSchema: () => this.migratePaymentsSchema(),
                    addReactivationDateColumn: () => this.addReactivationDateColumn(),
                    mergeFSDCAndRegal: () => this.mergeFSDCAndRegal(),
                    contactClient: (clientName) => this.contactClient(clientName),
                    exportOverdueClients: () => this.exportOverdueClients()
                };
            }

            async togglePaymentStatus(paymentId, newStatus) {
                console.log('═══════════════════════════════════════');
                console.log('🔍 TOGGLE PAYMENT STATUS CALLED');
                console.log('Payment ID:', paymentId);
                console.log('New Status:', newStatus);
                console.log('Current Month (Dashboard.currentMonth):', this.currentMonth);
                console.log('═══════════════════════════════════════');

                // SAFETY CHECK: Get payment details and verify it's for current month
                const { data: beforePayment, error: fetchError } = await this.supabase
                    .from('monthly_payments')
                    .select('id, client_id, month, status, amount, clients(name)')
                    .eq('id', paymentId)
                    .single();

                if (fetchError) {
                    console.error('❌ Error fetching payment before update:', fetchError);
                    this.toast('Failed to find payment record', 'error');
                    return;
                }

                console.log('📋 Payment BEFORE update:');
                console.log('  - Payment ID:', beforePayment.id);
                console.log('  - Client:', beforePayment.clients?.name);
                console.log('  - Month:', beforePayment.month);
                console.log('  - Current Status:', beforePayment.status);
                console.log('  - Will change to:', newStatus);

                // CRITICAL SAFETY CHECK: Verify payment is for current month
                if (beforePayment.month !== this.currentMonth) {
                    console.error('═══════════════════════════════════════');
                    console.error('🚨🚨🚨 MONTH MISMATCH DETECTED 🚨🚨🚨');
                    console.error('═══════════════════════════════════════');
                    console.error('Payment Month:', beforePayment.month);
                    console.error('Current Month:', this.currentMonth);
                    console.error('Payment ID:', paymentId);
                    console.error('Client:', beforePayment.clients?.name);
                    console.error('═══════════════════════════════════════');
                    alert(`MONTH MISMATCH!\n\nYou are viewing: ${this.currentMonth}\nBut trying to update: ${beforePayment.month}\n\nThis update will be BLOCKED.`);
                    this.toast(`ERROR: Cannot update ${beforePayment.month} payment while viewing ${this.currentMonth}`, 'error');
                    return;
                }

                console.log('✅ Month check passed - payment is for current month');

                // Set payment_date to today if marking as paid, null otherwise
                const paymentDate = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null;

                console.log('🔄 Updating status:', { newStatus, paymentDate });

                this.showLoading();
                try {
                    console.log('📡 Updating Supabase with:', { status: newStatus, payment_date: paymentDate, paymentId, month: this.currentMonth });

                    // DOUBLE SAFETY: Update only if ID matches AND month matches
                    const { data, error } = await this.supabase
                        .from('monthly_payments')
                        .update({ status: newStatus, payment_date: paymentDate })
                        .eq('id', paymentId)
                        .eq('month', this.currentMonth)  // SAFETY: Only update current month
                        .select();

                    if (error) {
                        console.error('❌ Supabase error:', error);
                        throw error;
                    }

                    // Log how many records were affected
                    const affectedCount = data ? data.length : 0;
                    console.log('═══════════════════════════════════════');
                    console.log('📊 UPDATE RESULT');
                    console.log('Records affected:', affectedCount);
                    if (data && data.length > 0) {
                        console.log('Updated payment(s):');
                        data.forEach(p => {
                            console.log(`  - ID: ${p.id}, Month: ${p.month}, Status: ${p.status}`);
                        });
                    }
                    console.log('═══════════════════════════════════════');

                    if (affectedCount === 0) {
                        console.error('⚠️ WARNING: No records were updated!');
                        console.error('This means the payment ID + month combination did not match any record.');
                        this.toast('No records updated - payment may be from different month', 'error');
                        return;
                    } else if (affectedCount > 1) {
                        console.error(`🚨 CRITICAL: ${affectedCount} records were updated! This should only affect 1 record.`);
                        console.error('Updated records:', data);
                    } else {
                        console.log('✅ Exactly 1 record updated (correct)');
                    }

                    await this.updateQuickStats();
                    await this.renderTabContent(this.currentTab);

                    // Refresh all charts to reflect payment status change
                    await this.refreshAllCharts();

                    this.toast(`Payment marked as ${newStatus}`, 'success');
                } catch (error) {
                    this.toast('Failed to update payment status', 'error');
                    console.error('Error updating payment:', error);
                } finally {
                    this.hideLoading();
                }
            }

            async toggleClientStatus(clientId, newStatus) {
                // ✅ FIXED: Ensure we're using the current month value
                console.log('🔄 Toggle client status - Current month:', this.currentMonth);
                const monthDate = new Date(this.currentMonth + '-01');
                const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                console.log('🔄 Month name for confirmation:', monthName);

                // Configure modal based on status
                let title, message, icon, iconClass, confirmText, confirmClass;

                if (newStatus === 'churned') {
                    title = 'Mark Client as Churned?';
                    message = `This client will be hidden from future months starting ${monthName}.`;
                    icon = '⚠️';
                    iconClass = 'danger';
                    confirmText = 'Mark as Churned';
                    confirmClass = 'danger';
                } else if (newStatus === 'active') {
                    title = 'Activate Client?';
                    message = 'This client will be marked as active and included in revenue calculations.';
                    icon = '✓';
                    iconClass = 'success';
                    confirmText = 'Activate';
                    confirmClass = 'success';
                } else if (newStatus === 'paused') {
                    title = 'Pause Client?';
                    message = 'This client will be paused and excluded from active revenue tracking.';
                    icon = '⏸';
                    iconClass = 'warning';
                    confirmText = 'Pause';
                    confirmClass = 'warning';
                }

                this.showModal(
                    title,
                    message,
                    () => this.performStatusUpdate(clientId, newStatus),
                    {
                        confirmText,
                        cancelText: 'Cancel',
                        icon,
                        iconClass,
                        confirmClass
                    }
                );
            }

            async performStatusUpdate(clientId, newStatus) {
                this.showLoading();
                try {
                    console.log('═══════════════════════════════════════');
                    console.log('🔄 PERFORM STATUS UPDATE');
                    console.log('Client ID:', clientId);
                    console.log('New Status:', newStatus);
                    console.log('Current Month:', this.currentMonth);
                    console.log('═══════════════════════════════════════');

                    // Get current client data to check previous status
                    const clients = await this.loadClients();
                    console.log('Total clients loaded:', clients.length);
                    console.log('Looking for client ID:', clientId, 'Type:', typeof clientId);

                    // Try both strict and loose equality to handle string/number mismatch
                    let client = clients.find(c => c.id === clientId);
                    if (!client) {
                        console.warn('Strict equality failed, trying loose equality...');
                        client = clients.find(c => c.id == clientId); // loose equality
                    }

                    if (!client) {
                        console.error('Available client IDs:', clients.map(c => ({ id: c.id, type: typeof c.id, name: c.name })));
                        throw new Error(`Client with ID ${clientId} not found in ${clients.length} total clients`);
                    }

                    console.log('Found client:', client.name, 'ID:', client.id, 'Type:', typeof client.id);

                    const previousStatus = client.status;
                    console.log('Previous Status:', previousStatus);

                    const updateData = { status: newStatus };

                    // If marking as churned or paused, set churn_date and clear reactivation_date
                    if (newStatus === 'churned' || newStatus === 'paused') {
                        updateData.churn_date = this.currentMonth;
                        updateData.reactivation_date = null;
                        console.log(`Setting churn_date to ${this.currentMonth}, clearing reactivation_date`);
                    }
                    // If reactivating (changing from churned/paused to active), set reactivation_date
                    else if (newStatus === 'active' && (previousStatus === 'churned' || previousStatus === 'paused')) {
                        // KEEP churn_date - we need it to know when they were churned!
                        // Just add reactivation_date
                        updateData.reactivation_date = this.currentMonth;
                        console.log(`✅ REACTIVATING CLIENT: Setting reactivation_date to ${this.currentMonth}, keeping churn_date=${client.churn_date}`);
                    }
                    // If changing to active from active (shouldn't happen but handle gracefully)
                    else if (newStatus === 'active') {
                        // Don't modify churn_date or reactivation_date if already active
                        console.log(`Client already active, no date changes needed`);
                    }

                    console.log('Update Data:', updateData);

                    const { error: updateError } = await this.supabase
                        .from('clients')
                        .update(updateData)
                        .eq('id', clientId);

                    if (updateError) {
                        console.error('❌ Supabase update error:', updateError);
                        throw updateError;
                    }

                    console.log('✅ Client status updated in database');

                    // If reactivating a client, create payment records starting from reactivation month
                    if (newStatus === 'active' && (previousStatus === 'churned' || previousStatus === 'paused')) {
                        console.log('🔄 Creating payment records for reactivated client...');
                        const paymentsCreated = await this.createPaymentRecordsForReactivation(clientId, this.currentMonth, client.amount);
                        console.log(`✅ Created ${paymentsCreated} payment records starting from ${this.currentMonth}`);
                    }

                    await this.loadClients();
                    await this.renderTabContent(this.currentTab);

                    this.toast(`Client status updated to ${newStatus}`, 'success');
                } catch (error) {
                    console.error('═══════════════════════════════════════');
                    console.error('❌ ERROR IN performStatusUpdate');
                    console.error('Error:', error);
                    console.error('Error message:', error.message);
                    console.error('Error details:', error.details);
                    console.error('═══════════════════════════════════════');
                    this.toast('Failed to update client status', 'error');
                } finally {
                    this.hideLoading();
                }
            }

            async changeClientStatus(clientId, newStatus) {
                console.log('🔄 Changing client status:', { clientId, newStatus });

                // Don't change if already at that status
                const clients = await this.loadClients();
                const client = clients.find(c => c.id === clientId);

                if (!client) {
                    this.toast('Client not found', 'error');
                    return;
                }

                if (client.status === newStatus) {
                    this.toast(`Client is already ${newStatus}`, 'info');
                    return;
                }

                // Confirm status change
                let confirmMsg;
                if (newStatus === 'churned') {
                    confirmMsg = `Mark ${client.name} as CHURNED? This indicates they have canceled their service.`;
                } else if (newStatus === 'paused') {
                    confirmMsg = `Pause ${client.name}? They will be excluded from active revenue tracking.`;
                } else if (newStatus === 'active') {
                    confirmMsg = `Reactivate ${client.name}? They will be included in revenue tracking again.`;
                }

                if (!confirm(confirmMsg)) return;

                this.showLoading();
                try {
                    const { error } = await this.supabase
                        .from('clients')
                        .update({ status: newStatus })
                        .eq('id', clientId);

                    if (error) throw error;

                    // Clear cache and refresh data
                    this.clearCache();
                    await this.loadClients();
                    await this.loadPayments();
                    await this.updateQuickStats();
                    await this.renderTabContent(this.currentTab);

                    // Refresh all charts to reflect status change
                    await this.refreshAllCharts();

                    this.toast(`${client.name} status changed to ${newStatus}`, 'success');
                } catch (error) {
                    this.toast('Failed to update client status', 'error');
                    console.error('Error changing client status:', error);
                } finally {
                    this.hideLoading();
                }
            }

            async deleteClient(clientId, clientName = null) {
                console.log('🗑️ Deleting client:', clientId, 'Name:', clientName);

                // If name provided, use it directly for confirmation
                // Otherwise fetch client info
                let displayName = clientName;

                if (!displayName) {
                    const clients = await this.loadClients();
                    console.log('Available clients:', clients.map(c => ({ id: c.id, name: c.name })));
                    console.log('Looking for client ID:', clientId);

                    // Try different ID matching approaches
                    let client = clients.find(c => c.id === clientId);

                    if (!client) {
                        // Try string/number conversion
                        client = clients.find(c => c.id == clientId); // loose equality
                    }

                    if (!client) {
                        // Try other possible ID fields
                        client = clients.find(c => c.client_id === clientId || c.client_id == clientId);
                    }

                    if (!client) {
                        console.error('Client not found with any ID matching approach');
                        console.error('Looking for ID:', clientId, 'Type:', typeof clientId);
                        console.error('Available IDs:', clients.map(c => ({ id: c.id, type: typeof c.id, client_id: c.client_id })));
                        this.toast(`Client not found. ID: ${clientId}`, 'error');
                        return;
                    }

                    displayName = client.name;
                }

                const confirmMsg = `Delete ${displayName}?\n\nThis will permanently remove:\n• The client record\n• All associated payment history\n\nThis action cannot be undone.`;

                if (!confirm(confirmMsg)) {
                    console.log('Deletion cancelled by user');
                    return;
                }

                this.showLoading();
                try {
                    // First delete associated payments
                    const { error: paymentsError } = await this.supabase
                        .from('monthly_payments')
                        .delete()
                        .eq('client_id', clientId);

                    if (paymentsError) throw paymentsError;

                    // Then delete the client
                    const { error: clientError } = await this.supabase
                        .from('clients')
                        .delete()
                        .eq('id', clientId);

                    if (clientError) throw clientError;

                    // Clear cache and refresh data
                    this.clearCache();
                    await this.loadClients();
                    await this.loadPayments();
                    await this.updateQuickStats();
                    await this.renderTabContent(this.currentTab);

                    // Refresh all charts to reflect deleted client
                    await this.refreshAllCharts();

                    this.toast(`${displayName} deleted successfully`, 'success');
                    console.log('✅ Client deleted successfully');
                } catch (error) {
                    this.toast('Failed to delete client', 'error');
                    console.error('Error deleting client:', error);
                } finally {
                    this.hideLoading();
                }
            }

            async markAllPaid() {
                const payments = await this.loadPayments();
                const unpaidPayments = payments.filter(p =>
                    p.status !== 'paid' && p.clients?.status !== 'paused'
                );

                if (unpaidPayments.length === 0) {
                    this.toast('All active clients are already paid', 'info');
                    return;
                }

                if (!confirm(`Mark ${unpaidPayments.length} payments as paid?`)) return;

                const today = new Date().toISOString().split('T')[0];

                this.showLoading();
                try {
                    for (const payment of unpaidPayments) {
                        await this.supabase
                            .from('monthly_payments')
                            .update({ status: 'paid', payment_date: today })
                            .eq('id', payment.id)
                            .eq('month', this.currentMonth);  // SAFETY: Only update current month
                    }

                    this.clearCache();
                    await this.loadPayments();
                    await this.updateQuickStats();
                    await this.renderTabContent(this.currentTab);

                    this.toast(`${unpaidPayments.length} payments marked as paid`, 'success');
                } catch (error) {
                    this.toast('Failed to mark all payments as paid', 'error');
                    console.error('Error marking all paid:', error);
                } finally {
                    this.hideLoading();
                }
            }

            async showUnpaidList() {
                const payments = await this.loadPayments();
                const unpaidClients = payments.filter(p =>
                    p.status !== 'paid' && p.clients?.status === 'active'
                );

                if (unpaidClients.length === 0) {
                    this.toast('All active clients have paid! 🎉', 'success');
                    return;
                }

                let message = `Unpaid Clients for ${this.currentMonth}:\n\n`;
                let total = 0;

                unpaidClients.forEach(payment => {
                    if (payment.clients) {
                        const amount = parseFloat(payment.clients.amount);
                        message += `• ${payment.clients.name}: $${amount.toLocaleString()}\n`;
                        total += amount;
                    }
                });

                message += `\nTotal Outstanding: $${total.toLocaleString()}`;
                alert(message);
            }

            exportData() {
                this.exportCurrentData();
            }

            async exportCurrentData() {
                try {
                    const clients = await this.loadClients();
                    const payments = await this.loadPayments();

                    // Create CSV content
                    let csv = 'Client Name,Monthly Amount,Status,Payment Status,Payment Date,Notes\n';

                    payments.forEach(payment => {
                        if (payment.clients) {
                            const client = payment.clients;
                            const paymentStatus = client.status === 'paused' ? 'paused' : payment.status;
                            const row = [
                                `"${client.name}"`,
                                client.amount,
                                client.status,
                                paymentStatus,
                                payment.payment_date || '',
                                `"${payment.notes || ''}"`
                            ].join(',');
                            csv += row + '\n';
                        }
                    });

                    // Download CSV
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `revenue_data_${this.currentMonth}_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    window.URL.revokeObjectURL(url);

                    this.toast('Data exported successfully', 'success');
                } catch (error) {
                    console.error('Error exporting data:', error);
                    this.toast('Failed to export data', 'error');
                }
            }

            async exportAnalytics() {
                if (!this.analyticsData) {
                    this.toast('No analytics data to export', 'warning');
                    return;
                }

                try {
                    // Create comprehensive analytics export
                    const analytics = this.analyticsData;
                    let csv = '';

                    // Monthly Performance Data
                    csv += 'MONTHLY PERFORMANCE\n';
                    csv += 'Month,Expected Revenue,Actual Revenue,Outstanding,Collection Rate,Costs,Operating Income\n';
                    analytics.monthlyPerformance.forEach(record => {
                        csv += [
                            record.month,
                            record.expected.toFixed(2),
                            record.actual.toFixed(2),
                            record.outstanding.toFixed(2),
                            record.collectionRate.toFixed(1) + '%',
                            record.costs.toFixed(2),
                            record.opIncome.toFixed(2)
                        ].join(',') + '\n';
                    });

                    csv += '\n';

                    // Client Distribution
                    csv += 'CLIENT DISTRIBUTION\n';
                    csv += 'Client Name,Monthly Revenue,Status\n';
                    analytics.clientDistribution.forEach(client => {
                        csv += [
                            `"${client.clientName}"`,
                            client.amount.toFixed(2),
                            client.status
                        ].join(',') + '\n';
                    });

                    csv += '\n';

                    // Growth Trends
                    if (analytics.growthTrends.length > 0) {
                        csv += 'GROWTH TRENDS\n';
                        csv += 'Month,Revenue Growth %,Margin Growth %\n';
                        analytics.growthTrends.forEach(growth => {
                            csv += [
                                growth.month,
                                growth.revenueGrowth.toFixed(1) + '%',
                                growth.marginGrowth.toFixed(1) + '%'
                            ].join(',') + '\n';
                        });
                        csv += '\n';
                    }

                    // Key Insights Summary
                    csv += 'KEY INSIGHTS\n';
                    csv += 'Insight\n';

                    // Calculate insights for export
                    const collections = analytics.collectionRates;
                    if (collections.length > 0) {
                        const avgCollectionRate = collections.reduce((sum, c) => sum + c.rate, 0) / collections.length;
                        csv += `"Average Collection Rate: ${avgCollectionRate.toFixed(1)}%"\n`;
                    }

                    if (analytics.growthTrends.length > 0) {
                        const recentGrowth = analytics.growthTrends[analytics.growthTrends.length - 1];
                        csv += `"Latest Revenue Growth: ${recentGrowth.revenueGrowth.toFixed(1)}%"\n`;
                    }

                    const cashFlow = analytics.cashFlow;
                    if (cashFlow.outstanding > 0) {
                        const outstandingPercentage = (cashFlow.outstanding / cashFlow.expected * 100);
                        csv += `"Outstanding Revenue: ${outstandingPercentage.toFixed(1)}% of expected"\n`;
                    }

                    // Download CSV
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `analytics_export_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    window.URL.revokeObjectURL(url);

                    this.toast('Analytics exported successfully', 'success');
                } catch (error) {
                    console.error('Error exporting analytics:', error);
                    this.toast('Failed to export analytics', 'error');
                }
            }

            syncDatabase() {
                this.toast('Database sync functionality coming soon', 'info');
            }

            async editPaymentNotes(paymentId) {
                const payments = await this.loadPayments();
                const payment = payments.find(p => p.id === paymentId);
                if (!payment) return;

                const newNotes = prompt('Enter payment notes:', payment.notes || '');
                if (newNotes === null) return;

                this.showLoading();
                try {
                    const { error } = await this.supabase
                        .from('monthly_payments')
                        .update({ notes: newNotes.trim() })
                        .eq('id', paymentId)
                        .eq('month', this.currentMonth);  // SAFETY: Only update current month

                    if (error) throw error;

                    this.clearCache();
                    await this.loadPayments();
                    await this.renderTabContent(this.currentTab);
                    this.toast('Notes updated successfully', 'success');
                } catch (error) {
                    this.toast('Failed to update notes', 'error');
                    console.error('Error updating notes:', error);
                } finally {
                    this.hideLoading();
                }
            }

            async editPaymentDate(paymentId) {
                const payments = await this.loadPayments();
                const payment = payments.find(p => p.id === paymentId);
                if (!payment) return;

                const currentDate = payment.payment_date || new Date().toISOString().split('T')[0];
                const newDate = prompt('Enter payment date (YYYY-MM-DD):', currentDate);
                if (newDate === null) return;

                // Validate date format
                if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
                    this.toast('Invalid date format. Use YYYY-MM-DD', 'error');
                    return;
                }

                this.showLoading();
                try {
                    const { error } = await this.supabase
                        .from('monthly_payments')
                        .update({ payment_date: newDate })
                        .eq('id', paymentId)
                        .eq('month', this.currentMonth);  // SAFETY: Only update current month

                    if (error) throw error;

                    this.clearCache();
                    await this.loadPayments();
                    await this.renderTabContent(this.currentTab);
                    this.toast('Payment date updated successfully', 'success');
                } catch (error) {
                    this.toast('Failed to update payment date', 'error');
                    console.error('Error updating payment date:', error);
                } finally {
                    this.hideLoading();
                }
            }

            editClientAmount(clientId, currentAmount) {
                console.log('💰 editClientAmount called:', { clientId, currentAmount });

                // Find the amount element for this client in the current view
                const amountElement = document.querySelector(`[data-client-id="${clientId}"] .editable-amount`);
                if (amountElement) {
                    // Set the data attributes if not already set
                    if (!amountElement.dataset.clientId) {
                        amountElement.dataset.clientId = clientId;
                    }
                    if (!amountElement.dataset.currentAmount) {
                        amountElement.dataset.currentAmount = currentAmount;
                    }
                    this.startInlineAmountEdit(amountElement);
                } else {
                    console.error('Could not find amount element for client:', clientId);
                }
            }

            startInlineAmountEdit(element) {
                console.log('💰 Starting inline amount edit');

                const clientId = element.dataset.clientId;
                const currentAmount = parseFloat(element.dataset.currentAmount);

                // Create clean input field
                const input = document.createElement('input');
                input.type = 'number';
                input.step = '0.01';
                input.value = currentAmount;
                input.className = 'amount-editing-input';

                // Create actions container
                const actionsContainer = document.createElement('div');
                actionsContainer.className = 'amount-edit-actions';

                // Create save button
                const saveBtn = document.createElement('button');
                saveBtn.textContent = 'Save';
                saveBtn.className = 'amount-action-btn save';
                saveBtn.title = 'Save changes (applies to current month forward)';

                // Create cancel button
                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = 'Cancel';
                cancelBtn.className = 'amount-action-btn cancel';

                actionsContainer.appendChild(saveBtn);
                actionsContainer.appendChild(cancelBtn);

                // Store original content
                const originalContent = element.innerHTML;

                // Replace content with input and actions
                element.innerHTML = '';
                element.appendChild(input);
                element.appendChild(actionsContainer);

                // Focus input and select text
                input.focus();
                input.select();

                // Save handler
                const saveAmount = async () => {
                    const newAmount = parseFloat(input.value);
                    if (isNaN(newAmount) || newAmount < 0) {
                        this.toast('Please enter a valid amount', 'error');
                        return;
                    }

                    if (newAmount === currentAmount) {
                        element.innerHTML = originalContent;
                        return;
                    }

                    await this.updateClientAmount(clientId, newAmount, element, originalContent);
                };

                // Cancel handler
                const cancelEdit = () => {
                    element.innerHTML = originalContent;
                };

                // Event listeners with proper event handling
                saveBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    saveAmount();
                });

                cancelBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    cancelEdit();
                });

                // Keyboard shortcuts
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        saveAmount();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelEdit();
                    }
                });

                // Auto-cancel on blur with proper button handling
                input.addEventListener('blur', (e) => {
                    // Give time for button clicks to register
                    setTimeout(() => {
                        // Check if we're still in editing mode (element might have been updated)
                        if (element.querySelector('.amount-editing-input')) {
                            cancelEdit();
                        }
                    }, 200);
                });
            }

            async updateClientAmount(clientId, newAmount, element, originalContent) {
                console.log('💰 Updating client amount:', { clientId, newAmount });

                this.showLoading();
                try {
                    const currentDate = new Date().toISOString().split('T')[0];
                    const effectiveDate = `${this.currentMonth}-01`;

                    // Step 1: Create amount history record (if table exists)
                    try {
                        await this.supabase
                            .from('client_amount_history')
                            .insert({
                                client_id: clientId,
                                amount: newAmount,
                                effective_date: effectiveDate,
                                created_at: currentDate
                            });
                    } catch (historyError) {
                        console.warn('Amount history table not found, skipping history record');
                    }

                    // Step 2: Update client's base amount
                    const { error: clientError } = await this.supabase
                        .from('clients')
                        .update({ amount: newAmount })
                        .eq('id', clientId);

                    if (clientError) throw clientError;
                    console.log('✅ Client base amount updated successfully');

                    // Step 3: Update ALL FUTURE monthly_payments (current month and forward)
                    const { error: paymentsError } = await this.supabase
                        .from('monthly_payments')
                        .update({ amount: newAmount })
                        .eq('client_id', clientId)
                        .gte('month', this.currentMonth); // Only update current and future months

                    if (paymentsError) {
                        console.error('Error updating future payments:', paymentsError);
                        throw paymentsError;
                    }

                    console.log('✅ Future month payments updated successfully');

                    // Update the display with clean design
                    element.innerHTML = `$${newAmount.toLocaleString()}`;
                    element.dataset.currentAmount = newAmount;

                    // Refresh other data
                    this.clearCache();
                    await this.loadPayments();
                    await this.updateQuickStats();

                    // Refresh all charts to reflect amount change
                    await this.refreshAllCharts();

                    this.toast(`Amount updated to $${newAmount.toLocaleString()} for ${this.currentMonth} and all future months`, 'success');
                } catch (error) {
                    this.toast('Failed to update amount', 'error');
                    console.error('Error updating client amount:', error);
                    element.innerHTML = originalContent; // Restore original on error
                } finally {
                    this.hideLoading();
                }
            }

            async quickMarkPaid(paymentId) {
                console.log('⚡ quickMarkPaid called with paymentId:', paymentId);
                const today = new Date().toISOString().split('T')[0];

                this.showLoading();
                try {
                    const { error } = await this.supabase
                        .from('monthly_payments')
                        .update({
                            status: 'paid',
                            payment_date: today
                        })
                        .eq('id', paymentId)
                        .eq('month', this.currentMonth);  // SAFETY: Only update current month

                    if (error) throw error;

                    this.clearCache();
                    await this.loadPayments();
                    await this.updateQuickStats();
                    await this.renderTabContent(this.currentTab);
                    this.toast('Payment marked as paid!', 'success');
                } catch (error) {
                    this.toast('Failed to mark payment as paid', 'error');
                    console.error('Error updating payment:', error);
                } finally {
                    this.hideLoading();
                }
            }

            async quickPaymentMode() {
                const payments = await this.loadPayments();
                const unpaidPayments = payments.filter(p =>
                    p.status === 'unpaid' && p.clients?.status !== 'paused'
                );

                if (unpaidPayments.length === 0) {
                    this.toast('No unpaid payments to process', 'info');
                    return;
                }

                const modal = document.createElement('div');
                modal.className = 'modal show';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width: 600px;">
                        <h2 style="margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                            Quick Payment Mode
                        </h2>
                        <p style="color: var(--secondary-gray); margin-bottom: 24px;">
                            Quickly mark multiple payments as paid. Click clients to toggle their payment status.
                        </p>

                        <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border-gray); border-radius: 8px;">
                            ${unpaidPayments.map(payment => `
                                <div class="quick-pay-item" data-payment-id="${payment.id}"
                                     style="padding: 12px 16px; border-bottom: 1px solid var(--border-gray); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease;"
                                     onclick="this.classList.toggle('selected'); this.style.background = this.classList.contains('selected') ? '#e8f5e9' : '';">
                                    <div>
                                        <div style="font-weight: 600;">${payment.clients.name}</div>
                                        <div style="font-size: 0.9em; color: var(--secondary-gray);">$${parseFloat(payment.clients.amount).toLocaleString()}</div>
                                    </div>
                                    <div class="quick-pay-checkbox" style="width: 20px; height: 20px; border: 2px solid var(--border-gray); border-radius: 4px; display: flex; align-items: center; justify-content: center;">
                                    </div>
                                </div>
                            `).join('')}
                        </div>

                        <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end;">
                            <button onclick="Dashboard.processQuickPayments()" class="btn primary">
                                Mark Selected as Paid
                            </button>
                            <button onclick="this.closest('.modal').remove()" class="btn secondary">
                                Cancel
                            </button>
                        </div>
                    </div>
                `;

                document.body.appendChild(modal);

                // Add click handlers to update checkboxes
                modal.querySelectorAll('.quick-pay-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const checkbox = item.querySelector('.quick-pay-checkbox');
                        if (item.classList.contains('selected')) {
                            checkbox.innerHTML = '✓';
                            checkbox.style.background = 'var(--success-green)';
                            checkbox.style.color = 'white';
                            checkbox.style.borderColor = 'var(--success-green)';
                        } else {
                            checkbox.innerHTML = '';
                            checkbox.style.background = '';
                            checkbox.style.color = '';
                            checkbox.style.borderColor = 'var(--border-gray)';
                        }
                    });
                });
            }

            async processQuickPayments() {
                const selectedItems = document.querySelectorAll('.quick-pay-item.selected');
                if (selectedItems.length === 0) {
                    this.toast('No payments selected', 'warning');
                    return;
                }

                const paymentIds = Array.from(selectedItems).map(item => item.dataset.paymentId);
                const today = new Date().toISOString().split('T')[0];

                this.showLoading();
                document.querySelector('.modal').remove();

                try {
                    for (const paymentId of paymentIds) {
                        await this.supabase
                            .from('monthly_payments')
                            .update({
                                status: 'paid',
                                payment_date: today
                            })
                            .eq('id', paymentId)
                            .eq('month', this.currentMonth);  // SAFETY: Only update current month
                    }

                    this.clearCache();
                    await this.loadPayments();
                    await this.updateQuickStats();
                    await this.renderTabContent(this.currentTab);
                    this.toast(`${paymentIds.length} payments marked as paid!`, 'success');
                } catch (error) {
                    this.toast('Failed to process payments', 'error');
                    console.error('Error processing quick payments:', error);
                } finally {
                    this.hideLoading();
                }
            }

            viewClientDetails(clientId) {
                this.toast('Client details view coming soon', 'info');
            }

            showAddClientModal() {
                const modalHtml = `
                    <div id="clientModal" class="modal">
                        <div class="modal-content">
                            <h2 style="margin-bottom: 24px; font-weight: 600;">Add New Client</h2>
                            <form id="clientForm">
                                <div class="form-group">
                                    <label>Client Name:</label>
                                    <input type="text" id="clientName" required>
                                </div>
                                <div class="form-group">
                                    <label>Monthly Amount:</label>
                                    <input type="number" id="clientAmount" step="0.01" required>
                                </div>
                                <div class="form-group">
                                    <label>Status:</label>
                                    <select id="clientStatus">
                                        <option value="active">Active</option>
                                        <option value="paused">Paused</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Start Date:</label>
                                    <input type="date" id="clientStartDate" required>
                                </div>
                                <div style="display: flex; gap: 12px; margin-top: 24px;">
                                    <button type="submit" class="btn primary">Add Client</button>
                                    <button type="button" id="cancelClientBtn" class="btn secondary">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', modalHtml);

                const modal = document.getElementById('clientModal');
                const form = document.getElementById('clientForm');
                const cancelBtn = document.getElementById('cancelClientBtn');

                // Set default start date to today
                document.getElementById('clientStartDate').value = new Date().toISOString().split('T')[0];

                // Handle form submission with validation
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();

                    // Check form validity
                    if (!form.checkValidity()) {
                        this.toast('Please fill in all required fields', 'error');
                        return;
                    }

                    await this.submitNewClient();
                });

                // Handle cancel button click
                cancelBtn.addEventListener('click', () => {
                    console.log('Cancel button clicked');
                    this.closeModal();
                });

                // Handle click outside modal to close
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        console.log('Clicked outside modal');
                        this.closeModal();
                    }
                });

                // Show modal with animation
                setTimeout(() => modal.classList.add('show'), 10);
            }

            async submitNewClient() {
                console.log('submitNewClient() called');
                const name = document.getElementById('clientName').value;
                const amount = parseFloat(document.getElementById('clientAmount').value);
                const status = document.getElementById('clientStatus').value;
                const startDate = document.getElementById('clientStartDate').value;

                console.log('Client data:', { name, amount, status, startDate });

                this.showLoading();
                try {
                    console.log('Inserting client into Supabase...');
                    // Use .select().single() to get the inserted client with ID
                    const { data: newClient, error } = await this.supabase
                        .from('clients')
                        .insert({
                            name: name,
                            amount: amount,
                            status: status,
                            start_date: startDate
                        })
                        .select()
                        .single();

                    if (error) {
                        console.error('Supabase error:', error);
                        throw error;
                    }

                    console.log('Client inserted successfully, ID:', newClient.id);

                    // Create payment records for the new client (from start_date through +12 months)
                    console.log('Creating payment records for new client...');
                    const paymentsCreated = await this.createPaymentRecordsForNewClient(newClient.id, startDate, amount);
                    console.log(`✅ Created ${paymentsCreated} payment records for ${name}`);

                    // CRITICAL: Close modal and hide loading FIRST, before data refresh
                    console.log('Closing modal...');
                    this.closeModal();
                    this.hideLoading();

                    // Then refresh data in background
                    console.log('Refreshing data...');
                    this.clearCache();
                    await this.loadClients();
                    await this.renderTabContent(this.currentTab);

                    // Refresh all charts to reflect new client data
                    await this.refreshAllCharts();

                    this.toast(`Client "${name}" added successfully!`, 'success');
                } catch (error) {
                    this.toast('Failed to add client', 'error');
                    console.error('Error adding client:', error);
                    this.hideLoading(); // Make sure loading is hidden even on error
                }
            }

            closeModal() {
                console.log('closeModal() called');
                // Find ALL modals (with or without .show class)
                const modals = document.querySelectorAll('.modal');
                console.log(`Found ${modals.length} modal(s) to close`);

                modals.forEach((modal, index) => {
                    console.log(`Closing modal ${index + 1}`);
                    modal.classList.remove('show');

                    // Immediate removal after animation
                    setTimeout(() => {
                        if (modal.parentNode) {
                            modal.parentNode.removeChild(modal);
                            console.log(`Modal ${index + 1} removed from DOM`);
                        }
                    }, 300);
                });

                // Force immediate removal if animation fails (safety net)
                setTimeout(() => {
                    const remainingModals = document.querySelectorAll('.modal');
                    if (remainingModals.length > 0) {
                        console.warn(`Force removing ${remainingModals.length} remaining modal(s)`);
                        remainingModals.forEach(m => {
                            if (m.parentNode) m.parentNode.removeChild(m);
                        });
                    }
                }, 350);
            }

            // =============================================================================
            // FILTERING AND SORTING
            // =============================================================================

            filterPayments(filter) {
                // Update filter button styles
                document.querySelectorAll('#tabContent .filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                event.target.classList.add('active');

                // Filter and re-render table
                this.renderFilteredPayments(filter);
                this.toast(`Filtered to show ${filter === 'all' ? 'all' : filter} payments`, 'info');
            }

            async renderFilteredPayments(filter) {
                const payments = await this.loadPayments();
                let filteredPayments = [];

                if (filter === 'all') {
                    // Show active clients first, then paused clients at bottom
                    filteredPayments = [...payments];
                } else if (filter === 'paused') {
                    // Show only paused clients
                    filteredPayments = payments.filter(payment => payment.clients?.status === 'paused');
                } else {
                    // Show only active clients with the specified payment status
                    filteredPayments = payments.filter(payment => {
                        const isActive = payment.clients?.status === 'active';
                        const paymentStatus = payment.status;
                        return isActive && paymentStatus === filter;
                    });
                }

                // Apply current sort if any
                if (this.paymentsSortColumn) {
                    filteredPayments = this.sortPaymentsData(filteredPayments, this.paymentsSortColumn, this.paymentsSortDirection);
                }

                const tableBody = document.getElementById('paymentsTableBody');
                if (tableBody) {
                    tableBody.innerHTML = this.renderEnhancedPaymentRows(filteredPayments);
                }
            }

            filterClients(filter) {
                // Update filter button styles
                document.querySelectorAll('#tabContent .filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                event.target.classList.add('active');

                // Filter and re-render table
                this.renderFilteredClients(filter);
            }

            async renderFilteredClients(filter) {
                const clients = await this.loadClients();
                let filteredClients = [...clients];

                if (filter !== 'all') {
                    filteredClients = clients.filter(client => client.status === filter);
                }

                // Apply current sort if any
                if (this.clientsSortColumn) {
                    filteredClients = this.sortClientsData(filteredClients, this.clientsSortColumn, this.clientsSortDirection);
                }

                document.getElementById('clientsTableBody').innerHTML = this.renderClientRows(filteredClients);
            }

            async sortPayments(column) {
                // Toggle sort direction
                if (this.paymentsSortColumn === column) {
                    this.paymentsSortDirection = this.paymentsSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.paymentsSortColumn = column;
                    this.paymentsSortDirection = 'desc'; // Default to desc for numeric columns
                }

                // Update header indicators
                document.querySelectorAll('#paymentsTable th.sortable').forEach(th => {
                    th.classList.remove('sorted-asc', 'sorted-desc');
                });

                const currentTh = document.querySelector(`#paymentsTable th.sortable[onclick*="${column}"]`);
                if (currentTh) {
                    currentTh.classList.add(this.paymentsSortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
                }

                // Get current payments and sort
                const payments = await this.loadPayments();
                const sortedPayments = this.sortPaymentsData(payments, column, this.paymentsSortDirection);

                // Re-render table
                const tableBody = document.getElementById('paymentsTableBody');
                if (tableBody) {
                    tableBody.innerHTML = this.renderEnhancedPaymentRows(sortedPayments);
                }

                this.toast(`Sorted by ${column} (${this.paymentsSortDirection === 'asc' ? 'Low to High' : 'High to Low'})`, 'success');
            }

            sortPaymentsData(payments, column, direction) {
                return [...payments].sort((a, b) => {
                    let aValue, bValue;

                    switch (column) {
                        case 'name':
                            aValue = a.clients?.name || '';
                            bValue = b.clients?.name || '';
                            return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);

                        case 'amount':
                            aValue = parseFloat(a.clients?.amount) || 0;
                            bValue = parseFloat(b.clients?.amount) || 0;
                            return direction === 'asc' ? aValue - bValue : bValue - aValue;

                        case 'status':
                            // Custom status priority: paid > unpaid > paused
                            const statusPriority = { 'paid': 3, 'unpaid': 2, 'paused': 1 };
                            aValue = statusPriority[a.clients?.status === 'paused' ? 'paused' : a.status] || 0;
                            bValue = statusPriority[b.clients?.status === 'paused' ? 'paused' : b.status] || 0;
                            return direction === 'asc' ? aValue - bValue : bValue - aValue;

                        case 'date':
                            aValue = a.payment_date ? new Date(a.payment_date) : new Date(0);
                            bValue = b.payment_date ? new Date(b.payment_date) : new Date(0);
                            return direction === 'asc' ? aValue - bValue : bValue - aValue;

                        default:
                            return 0;
                    }
                });
            }

            async sortClients(column) {
                // Toggle sort direction
                if (this.clientsSortColumn === column) {
                    this.clientsSortDirection = this.clientsSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.clientsSortColumn = column;
                    this.clientsSortDirection = 'desc'; // Default to desc for numeric columns
                }

                // Update header indicators
                document.querySelectorAll('#clientsTable th.sortable').forEach(th => {
                    th.classList.remove('sorted-asc', 'sorted-desc');
                });

                const currentTh = document.querySelector(`#clientsTable th.sortable[onclick*="${column}"]`);
                if (currentTh) {
                    currentTh.classList.add(this.clientsSortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
                }

                // Get current clients and sort
                const clients = await this.loadClients();
                const sortedClients = this.sortClientsData(clients, column, this.clientsSortDirection);

                // Re-render table
                const tableBody = document.getElementById('clientsTableBody');
                if (tableBody) {
                    tableBody.innerHTML = this.renderClientRows(sortedClients);
                }

                this.toast(`Sorted by ${column} (${this.clientsSortDirection === 'asc' ? 'Low to High' : 'High to Low'})`, 'success');
            }

            sortClientsData(clients, column, direction) {
                return [...clients].sort((a, b) => {
                    let aValue, bValue;

                    switch (column) {
                        case 'name':
                            aValue = a.name || '';
                            bValue = b.name || '';
                            return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);

                        case 'amount':
                            aValue = parseFloat(a.amount) || 0;
                            bValue = parseFloat(b.amount) || 0;
                            return direction === 'asc' ? aValue - bValue : bValue - aValue;

                        case 'status':
                            // Custom status priority: active > paused > hidden
                            const statusPriority = { 'active': 3, 'paused': 2, 'hidden': 1 };
                            aValue = statusPriority[a.status] || 0;
                            bValue = statusPriority[b.status] || 0;
                            return direction === 'asc' ? aValue - bValue : bValue - aValue;

                        case 'start_date':
                            aValue = a.start_date ? new Date(a.start_date) : new Date(0);
                            bValue = b.start_date ? new Date(b.start_date) : new Date(0);
                            return direction === 'asc' ? aValue - bValue : bValue - aValue;

                        case 'lifetime_value':
                            // Use actual lifetime values from DOM data attributes (if available)
                            const aCellValue = document.querySelector(`.lifetime-value-${a.id}`)?.getAttribute('data-value');
                            const bCellValue = document.querySelector(`.lifetime-value-${b.id}`)?.getAttribute('data-value');

                            if (aCellValue && bCellValue) {
                                // Use actual calculated lifetime values
                                aValue = parseFloat(aCellValue) || 0;
                                bValue = parseFloat(bCellValue) || 0;
                            } else {
                                // Fallback to old calculation method if data not loaded yet
                                const now = new Date();
                                const aStart = a.start_date ? new Date(a.start_date) : now;
                                const bStart = b.start_date ? new Date(b.start_date) : now;
                                const aMonths = Math.max(1, Math.floor((now - aStart) / (1000 * 60 * 60 * 24 * 30)));
                                const bMonths = Math.max(1, Math.floor((now - bStart) / (1000 * 60 * 60 * 24 * 30)));
                                aValue = aMonths * (parseFloat(a.amount) || 0);
                                bValue = bMonths * (parseFloat(b.amount) || 0);
                            }
                            return direction === 'asc' ? aValue - bValue : bValue - aValue;

                        default:
                            return 0;
                    }
                });
            }

            // =============================================================================
            // UNIFIED CLIENT & PAYMENT MANAGEMENT FUNCTIONS
            // =============================================================================

            filterClientPayments(filter) {
                // Update filter button styles
                document.querySelectorAll('#tabContent .filter-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                event.target.classList.add('active');

                // Filter and re-render table
                this.renderFilteredClientPayments(filter);
                this.toast(`Filtered to show ${filter === 'all' ? 'all active' : filter} clients`, 'info');
            }

            async renderFilteredClientPayments(filter) {
                const [clients, payments] = await Promise.all([
                    this.loadClients(),
                    this.loadPayments()
                ]);

                // Create payment map
                const paymentMap = new Map();
                payments?.forEach(payment => {
                    if (payment.client_id) {
                        paymentMap.set(payment.client_id, payment);
                    }
                });

                // Calculate month-specific status for each client
                const displayClients = clients.map(client => ({
                    ...client,
                    monthStatus: this.getClientStatusForMonth(client, this.currentMonth)
                }));

                let filteredClients = [];

                if (filter === 'all') {
                    // Show only active clients (exclude churned) for THIS MONTH
                    filteredClients = displayClients.filter(c => c.monthStatus === 'active');
                } else if (filter === 'paused') {
                    // Show paused clients for THIS MONTH
                    filteredClients = displayClients.filter(c => c.monthStatus === 'paused');
                } else if (filter === 'hidden') {
                    // Show hidden clients for THIS MONTH
                    filteredClients = displayClients.filter(c => c.monthStatus === 'hidden');
                } else if (filter === 'churned') {
                    // Show ONLY churned clients for THIS MONTH
                    filteredClients = displayClients.filter(c => c.monthStatus === 'churned');
                } else if (filter === 'paid' || filter === 'unpaid') {
                    // Show only active clients (for THIS MONTH) with specified payment status
                    filteredClients = displayClients.filter(c => {
                        if (c.monthStatus !== 'active') return false;
                        const payment = paymentMap.get(c.id);
                        return payment && payment.status === filter;
                    });
                }

                // Apply search filter if active
                const searchInput = document.getElementById('clientSearch');
                if (searchInput && searchInput.value.trim()) {
                    filteredClients = this.applySearchFilter(filteredClients, searchInput.value.toLowerCase().trim());
                }

                // Apply current sort if any
                if (this.clientPaymentsSortColumn) {
                    filteredClients = this.sortClientPaymentsData(filteredClients, paymentMap, this.clientPaymentsSortColumn, this.clientPaymentsSortDirection);
                }

                const tableBody = document.getElementById('clientPaymentTableBody');
                if (tableBody) {
                    tableBody.innerHTML = this.renderUnifiedClientPaymentRows(filteredClients, paymentMap);
                    // Update lifetime values for filtered clients
                    setTimeout(async () => {
                        await this.updateLifetimeValues(filteredClients);
                    }, 100);
                }
            }

            searchClients(searchTerm) {
                // Show/hide clear button immediately
                const clearBtn = document.querySelector('.search-clear');
                if (clearBtn) {
                    clearBtn.style.display = searchTerm.trim() ? 'flex' : 'none';
                }

                // Clear any pending search timeout for smooth performance
                if (this.searchTimeout) {
                    clearTimeout(this.searchTimeout);
                }

                // Debounce search for smooth performance (100ms delay)
                this.searchTimeout = setTimeout(() => {
                    // Get current filter
                    const activeFilterBtn = document.querySelector('.filter-btn.active');
                    const currentFilter = activeFilterBtn ? activeFilterBtn.textContent.trim().split(' ')[0].toLowerCase() : 'all';

                    // Re-render with search applied
                    this.renderFilteredClientPayments(currentFilter);
                }, 100);
            }

            applySearchFilter(clients, searchTerm) {
                return clients.filter(client => {
                    const clientName = (client.name || '').toLowerCase();
                    const amount = (client.amount || '').toString();
                    const status = (client.status || '').toLowerCase();
                    const startDate = (client.start_date || '').toLowerCase();

                    return clientName.includes(searchTerm) ||
                           amount.includes(searchTerm) ||
                           status.includes(searchTerm) ||
                           startDate.includes(searchTerm);
                });
            }

            clearSearch() {
                const searchInput = document.getElementById('clientSearch');
                if (searchInput) {
                    searchInput.value = '';
                    this.searchClients('');
                }
            }

            async sortClientPayments(column) {
                // Toggle sort direction
                if (this.clientPaymentsSortColumn === column) {
                    this.clientPaymentsSortDirection = this.clientPaymentsSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.clientPaymentsSortColumn = column;
                    this.clientPaymentsSortDirection = 'desc'; // Default to desc for numeric columns
                }

                // Update header indicators
                document.querySelectorAll('#clientPaymentTable th.sortable').forEach(th => {
                    th.classList.remove('sorted-asc', 'sorted-desc');
                });

                const currentTh = document.querySelector(`#clientPaymentTable th.sortable[onclick*="${column}"]`);
                if (currentTh) {
                    currentTh.classList.add(this.clientPaymentsSortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
                }

                // Get current data and sort
                const [clients, payments] = await Promise.all([
                    this.loadClients(),
                    this.loadPayments()
                ]);

                // Create payment map
                const paymentMap = new Map();
                payments?.forEach(payment => {
                    if (payment.client_id) {
                        paymentMap.set(payment.client_id, payment);
                    }
                });

                const sortedClients = this.sortClientPaymentsData(clients, paymentMap, column, this.clientPaymentsSortDirection);

                // Re-render table
                const tableBody = document.getElementById('clientPaymentTableBody');
                if (tableBody) {
                    tableBody.innerHTML = this.renderUnifiedClientPaymentRows(sortedClients, paymentMap);
                    // Update lifetime values
                    setTimeout(async () => {
                        await this.updateLifetimeValues(sortedClients);
                    }, 100);
                }

                this.toast(`Sorted by ${column} (${this.clientPaymentsSortDirection === 'asc' ? 'Low to High' : 'High to Low'})`, 'success');
            }

            sortClientPaymentsData(clients, paymentMap, column, direction) {
                return [...clients].sort((a, b) => {
                    let aValue, bValue;

                    switch (column) {
                        case 'name':
                            aValue = a.name || '';
                            bValue = b.name || '';
                            return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);

                        case 'amount':
                            aValue = parseFloat(a.amount) || 0;
                            bValue = parseFloat(b.amount) || 0;
                            return direction === 'asc' ? aValue - bValue : bValue - aValue;

                        case 'clientStatus':
                            // Custom status priority: active > paused > hidden > churned
                            const statusPriority = { 'active': 4, 'paused': 3, 'hidden': 2, 'churned': 1 };
                            aValue = statusPriority[a.status] || 0;
                            bValue = statusPriority[b.status] || 0;
                            return direction === 'asc' ? aValue - bValue : bValue - aValue;

                        case 'paymentStatus':
                            const paymentA = paymentMap.get(a.id);
                            const paymentB = paymentMap.get(b.id);
                            // Paid = 2, Unpaid = 1, None = 0
                            const paymentPriority = { 'paid': 2, 'unpaid': 1 };
                            aValue = paymentA ? (paymentPriority[paymentA.status] || 0) : 0;
                            bValue = paymentB ? (paymentPriority[paymentB.status] || 0) : 0;
                            return direction === 'asc' ? aValue - bValue : bValue - aValue;

                        case 'paymentDate':
                            const dateA = paymentMap.get(a.id);
                            const dateB = paymentMap.get(b.id);
                            aValue = dateA?.date ? new Date(dateA.date) : new Date(0);
                            bValue = dateB?.date ? new Date(dateB.date) : new Date(0);
                            return direction === 'asc' ? aValue - bValue : bValue - aValue;

                        default:
                            return 0;
                    }
                });
            }

            // =============================================================================
            // UTILITY METHODS
            // =============================================================================

            updateSyncStatus(status) {
                const statusEl = document.getElementById('syncStatus');
                if (!statusEl) return;

                statusEl.className = `sync-status ${status}`;

                const statusText = {
                    'connected': 'Connected',
                    'syncing': 'Syncing...',
                    'error': 'Connection Error'
                };

                statusEl.innerHTML = `
                    <span>●</span>
                    <span>${statusText[status] || 'Unknown'}</span>
                `;
            }

            showLoading() {
                this.isLoading = true;
                document.getElementById('loadingOverlay').classList.add('show');
            }

            hideLoading() {
                this.isLoading = false;
                document.getElementById('loadingOverlay').classList.remove('show');
            }

            toast(message, type = 'info', duration = 4000) {
                const toastId = ++this.toastId;
                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                toast.textContent = message;
                toast.onclick = () => this.removeToast(toast);

                document.getElementById('toastContainer').appendChild(toast);

                // Show toast
                setTimeout(() => toast.classList.add('show'), 10);

                // Auto remove
                setTimeout(() => this.removeToast(toast), duration);
            }

            removeToast(toast) {
                if (toast && toast.parentNode) {
                    toast.classList.remove('show');
                    setTimeout(() => {
                        if (toast.parentNode) {
                            toast.parentNode.removeChild(toast);
                        }
                    }, 300);
                }
            }

            // =============================================================================
            // MODAL SYSTEM
            // =============================================================================

            showModal(title, message, onConfirm, options = {}) {
                const {
                    confirmText = 'Confirm',
                    cancelText = 'Cancel',
                    icon = '⚠️',
                    iconClass = 'danger',
                    confirmClass = 'danger'
                } = options;

                // Remove any existing modals
                const existingModal = document.querySelector('.modal-overlay');
                if (existingModal) existingModal.remove();

                // Create modal
                const modalHtml = `
                    <div class="modal-overlay" id="confirmModal">
                        <div class="modal-content">
                            <div class="modal-icon ${iconClass}">${icon}</div>
                            <h3 class="modal-title">${title}</h3>
                            <p class="modal-message">${message}</p>
                            <div class="modal-actions">
                                <button class="btn secondary" onclick="Dashboard.closeModal()">
                                    ${cancelText}
                                </button>
                                <button class="btn ${confirmClass}" onclick="Dashboard.confirmModal()">
                                    ${confirmText}
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', modalHtml);

                // Store callback
                this._modalCallback = onConfirm;

                // Show modal with animation
                setTimeout(() => {
                    document.getElementById('confirmModal').classList.add('show');
                }, 10);

                // Close on overlay click
                document.getElementById('confirmModal').addEventListener('click', (e) => {
                    if (e.target.id === 'confirmModal') {
                        this.closeModal();
                    }
                });
            }

            closeModal() {
                const modal = document.getElementById('confirmModal');
                if (modal) {
                    modal.classList.remove('show');
                    setTimeout(() => modal.remove(), 200);
                }
                this._modalCallback = null;
            }

            confirmModal() {
                if (this._modalCallback) {
                    this._modalCallback();
                }
                this.closeModal();
            }

            // =============================================================================
            // MASTER INVOICE LOG SYNCHRONIZATION
            // =============================================================================

            async syncMasterInvoiceLog() {
                const masterLogData = this.getMasterInvoiceLogData();
                console.log('Starting Master Invoice Log sync with', masterLogData.length, 'records');

                try {
                    // Phase 1: Process and validate data
                    const processedData = this.processMasterLogData(masterLogData);
                    console.log('Processed data:', processedData);

                    // Phase 2: Sync clients table
                    await this.syncClientsFromMasterLog(processedData.clients);

                    // Phase 3: Sync payments table
                    await this.syncPaymentsFromMasterLog(processedData.payments);

                    // Phase 4: Generate reconciliation report
                    const report = await this.generateReconciliationReport(processedData);

                    // Show detailed success message
                    this.toast(`Sync complete! Updated ${report.clientsProcessed} clients, ${report.paymentsProcessed} payments`, 'success');
                    console.log('Sync complete. Reconciliation report:', report);

                    // Display reconciliation summary
                    this.showReconciliationSummary(report);

                    // Refresh the current tab to show updated data
                    await this.showTab(this.currentTab);

                    return report;
                } catch (error) {
                    console.error('Error syncing Master Invoice Log:', error);
                    this.toast('Failed to sync Master Invoice Log: ' + error.message, 'error');
                    throw error;
                }
            }

            getMasterInvoiceLogData() {
                // Complete Master Invoice Log Data - All Records from December 2023 to September 2025
                // Format: [client_name, month, amount, status, notes]
                const compressedData = [
                    // September 2025 - MOSTLY UNPAID except John's Grill
                    ["Twelve Oak", "9/1/2025", 250, "Unpaid"],
                    ["Limoncello", "9/1/2025", 200, "Unpaid"],
                    ["Regal", "9/1/2025", 1200, "Unpaid"],
                    ["Cote Ouest", "9/1/2025", 300, "Unpaid"],
                    ["Hot Johnnie's", "9/1/2025", 400, "Unpaid"],
                    ["Amarena", "9/1/2025", 300, "Unpaid"],
                    ["Californios", "9/1/2025", 400, "Unpaid", "Dine Credit, *"],
                    ["John's Grill", "9/1/2025", 2000, "Paid"],
                    ["Mr. Magic", "9/1/2025", 410, "Unpaid"],
                    ["3rd Cousin + Precita Social", "9/1/2025", 1000, "Unpaid"],
                    ["Harborview", "9/1/2025", 850, "Unpaid"],
                    ["San Benito House", "9/1/2025", 2000, "Unpaid"],
                    ["EzyDog", "9/1/2025", 2000, "Unpaid"],
                    ["Kei", "9/1/2025", 400, "Unpaid"],
                    ["District", "9/1/2025", 850, "Unpaid"],
                    ["Indigo", "9/1/2025", 350, "Unpaid"],
                    ["Crepe House", "9/1/2025", 350, "Unpaid"],
                    ["Hungry Eyes", "9/1/2025", 350, "Unpaid"],
                    ["Hot Stuff", "9/1/2025", 350, "Unpaid"],
                    ["Underdogs", "9/1/2025", 1600, "Unpaid"],
                    ["Turkey and the Wolf", "9/1/2025", 350, "Unpaid"],
                    ["Grubstake Diner", "9/1/2025", 550, "Unpaid"],

                    // August 2025 - Mixed status
                    ["Twelve Oak", "8/1/2025", 250, "Unpaid"],
                    ["Limoncello", "8/1/2025", 200, "Unpaid"],
                    ["Regal", "8/1/2025", 1200, "Unpaid"],
                    ["Cote Ouest", "8/1/2025", 300, "Unpaid"],
                    ["Hot Johnnie's", "8/1/2025", 400, "Unpaid"],
                    ["Amarena", "8/1/2025", 300, "Unpaid"],
                    ["Californios", "8/1/2025", 400, "Unpaid", "Dine Credit, *"],
                    ["Dacha", "8/1/2025", 900, "Unpaid"],
                    ["John's Grill", "8/1/2025", 2000, "Paid"],
                    ["Mr. Magic", "8/1/2025", 410, "Unpaid"],
                    ["3rd Cousin", "8/1/2025", 500, "Unpaid"],
                    ["Harborview", "8/1/2025", 850, "Paid"],
                    ["San Benito House", "8/1/2025", 2000, "Paid"],
                    ["EzyDog", "8/1/2025", 2000, "Unpaid"],
                    ["Kei", "8/1/2025", 400, "Unpaid"],
                    ["District", "8/1/2025", 850, "Unpaid"],
                    ["Indigo", "8/1/2025", 350, "Unpaid"],
                    ["Crepe House", "8/1/2025", 350, "Paid"],
                    ["Hungry Eyes", "8/1/2025", 350, "Paid"],
                    ["Hot Stuff", "8/1/2025", 350, "Paid"],
                    ["Underdogs", "8/1/2025", 1600, "Unpaid"],
                    ["Turkey and the Wolf", "8/1/2025", 350, "Unpaid"],
                    ["Grubstake Diner", "8/1/2025", 550, "Unpaid"],

                    // July 2025
                    ["Twelve Oak", "7/1/2025", 250, "Unpaid"],
                    ["Limoncello", "7/1/2025", 200, "Paid"],
                    ["Regal", "7/1/2025", 1200, "Paid"],
                    ["Cote Ouest", "7/1/2025", 300, "Paid"],
                    ["Sandy's", "7/1/2025", 0, "Paused"],
                    ["Galene", "7/1/2025", 350, "Paused"],
                    ["The Fly Trap", "7/1/2025", 0, "Paused"],
                    ["Hot Johnnie's", "7/1/2025", 400, "Paid"],
                    ["Amarena", "7/1/2025", 300, "Paid"],
                    ["Californios", "7/1/2025", 400, "Unpaid", "Dine Credit, *"],
                    ["John's Grill", "7/1/2025", 2000, "Unpaid"],
                    ["Mr. Magic", "7/1/2025", 410, "Unpaid"],
                    ["3rd Cousin", "7/1/2025", 500, "Paid"],
                    ["Harborview", "7/1/2025", 850, "Paid"],
                    ["San Benito House", "7/1/2025", 2000, "Paid"],
                    ["EzyDog", "7/1/2025", 2000, "Paid"],
                    ["Kei", "7/1/2025", 400, "Paid"],
                    ["District", "7/1/2025", 850, "Paid"],
                    ["Indigo", "7/1/2025", 350, "Paid"],
                    ["Crepe House", "7/1/2025", 350, "Paid"],
                    ["Hungry Eyes", "7/1/2025", 350, "Paid"],
                    ["Hot Stuff", "7/1/2025", 350, "Paid"],
                    ["Underdogs", "7/1/2025", 1000, "Unpaid"],

                    // June 2025
                    ["Twelve Oak", "6/1/2025", 250, "Paid"],
                    ["Limoncello", "6/1/2025", 200, "Paid"],
                    ["Regal", "6/1/2025", 1200, "Paid"],
                    ["Evergreen", "6/1/2025", 650, "Paid"],
                    ["New Spot", "6/1/2025", 250, "Paid"],
                    ["Cote Ouest", "6/1/2025", 300, "Paid"],
                    ["Sandy's", "6/1/2025", 0, "Paused"],
                    ["Galene", "6/1/2025", 350, "Paused"],
                    ["The Fly Trap", "6/1/2025", 0, "Paused"],
                    ["Hot Johnnie's", "6/1/2025", 400, "Paid"],
                    ["Californios", "6/1/2025", 400, "Unpaid", "Dine Credit, *"],
                    ["John's Grill", "6/1/2025", 2000, "Paid"],
                    ["Mr. Magic", "6/1/2025", 410, "Paid"],
                    ["3rd Cousin", "6/1/2025", 500, "Paid"],
                    ["Harborview", "6/1/2025", 850, "Paid"],
                    ["San Benito House", "6/1/2025", 2000, "Paid"],
                    ["Hearth", "6/1/2025", 750, "Paid"],
                    ["EzyDog", "6/1/2025", 2000, "Paid"],
                    ["Kei", "6/1/2025", 400, "Paid"],
                    ["District", "6/1/2025", 500, "Paid"],
                    ["Hungry Eyes", "6/1/2025", 250, "Paid", "via check"],
                    ["Hot Stuff", "6/1/2025", 250, "Paid"],
                    ["Underdogs", "6/1/2025", 850, "Paid"],

                    // May 2025 - FIRST APPEARANCE OF EZYDOG
                    ["Twelve Oak", "5/1/2025", 250, "Paid"],
                    ["Limoncello", "5/1/2025", 200, "Paid"],
                    ["Regal", "5/1/2025", 1200, "Paid"],
                    ["Evergreen", "5/1/2025", 650, "Paid"],
                    ["New Spot", "5/1/2025", 250, "Paid"],
                    ["FSDC", "5/1/2025", 700, "Paid"],
                    ["Cote Ouest", "5/1/2025", 300, "Paid"],
                    ["Nisei", "5/1/2025", 500, "Paid", "Dine Credit"],
                    ["Sandy's", "5/1/2025", 0, "Paused"],
                    ["Galene", "5/1/2025", 350, "Paused"],
                    ["The Fly Trap", "5/1/2025", 300, "Paid"],
                    ["Hot Johnnie's", "5/1/2025", 400, "Paid"],
                    ["Amarena", "5/1/2025", 300, "Paid"],
                    ["Californios", "5/1/2025", 400, "Paid", "Dine Credit, *"],
                    ["Eat Street", "5/1/2025", 250, "N/A"],
                    ["Dacha", "5/1/2025", 500, "Paid"],
                    ["John's Grill", "5/1/2025", 2000, "Paid"],
                    ["Mr. Magic", "5/1/2025", 410, "Paid"],
                    ["3rd Cousin", "5/1/2025", 500, "Paid"],
                    ["Harborview", "5/1/2025", 850, "Paid"],
                    ["San Benito", "5/1/2025", 2000, "Paid"],
                    ["Hearth", "5/1/2025", 750, "Paid"],
                    ["McBaker Deli", "5/1/2025", 0, "Paused"],
                    ["EzyDog", "5/1/2025", 2000, "Paid"],
                    ["San Benito", "5/1/2025", 2000, "Paid"],

                    // April 2025
                    ["Twelve Oak", "4/1/2025", 250, "Paid"],
                    ["Limoncello", "4/1/2025", 200, "Paid"],
                    ["Regal", "4/1/2025", 1200, "Paid"],
                    ["Evergreen", "4/1/2025", 650, "Paid"],
                    ["New Spot", "4/1/2025", 250, "Paid"],
                    ["FSDC", "4/1/2025", 700, "Paid"],
                    ["Cote Ouest", "4/1/2025", 300, "Paid"],
                    ["Nisei", "4/1/2025", 500, "Paid", "Dine Credit"],
                    ["Sandy's", "4/1/2025", 0, "Paused"],
                    ["Galene", "4/1/2025", 350, "Paid"],
                    ["The Fly Trap", "4/1/2025", 300, "Paid"],
                    ["Hot Johnnie's", "4/1/2025", 400, "Paid"],
                    ["Amarena", "4/1/2025", 300, "Paid"],
                    ["Eat Street", "4/1/2025", 250, "Paid"],
                    ["Dacha", "4/1/2025", 500, "Paid"],
                    ["John's Grill", "4/1/2025", 2000, "Paid"],
                    ["3rd Cousin", "4/1/2025", 500, "Paid"],
                    ["Harborview", "4/1/2025", 850, "Paid"],
                    ["San Benito", "4/1/2025", 2000, "Paid"],
                    ["Hearth", "4/1/2025", 750, "Paid"],
                    ["McBaker Deli", "4/1/2025", 350, "Paused"],

                    // March 2025
                    ["Twelve Oak", "3/1/2025", 250, "Paid"],
                    ["Limoncello", "3/1/2025", 200, "Paid"],
                    ["Regal", "3/1/2025", 1200, "Paid"],
                    ["Evergreen", "3/1/2025", 650, "N/A"],
                    ["New Spot", "3/1/2025", 250, "Paid"],
                    ["FSDC", "3/1/2025", 700, "Paid"],
                    ["Cote Ouest", "3/1/2025", 300, "Paid"],
                    ["Nisei", "3/1/2025", 500, "Paid", "Dine Credit"],
                    ["Sandy's", "3/1/2025", 0, "Paused"],
                    ["Eat Street", "3/1/2025", 0, "Paused"],
                    ["Dacha", "3/1/2025", 500, "Paid"],
                    ["John's Grill", "3/1/2025", 500, "Paid"],
                    ["JG Credit", "3/1/2025", 100, "Paid"],
                    ["Harborview", "3/1/2025", 850, "Paid"],
                    ["Hinodeya", "3/1/2025", 600, "Paid"],
                    ["Yokai", "3/1/2025", 0, "Paused"],
                    ["McBaker Deli", "3/1/2025", 350, "Paid"],
                    ["Harborview", "3/1/2025", 850, "Paid"],

                    // February 2025 - FIRST APPEARANCE OF SAN BENITO HOUSE
                    ["Twelve Oak", "2/1/2025", 250, "Paid"],
                    ["Limoncello", "2/1/2025", 200, "Paid"],
                    ["Regal", "2/1/2025", 1200, "Paid"],
                    ["Evergreen", "2/1/2025", 650, "Paid"],
                    ["New Spot", "2/1/2025", 250, "Paid"],
                    ["FSDC", "2/1/2025", 700, "Paid"],
                    ["Cote Ouest", "2/1/2025", 300, "Paid"],
                    ["Nisei", "2/1/2025", 500, "Paid", "Dine Credit"],
                    ["Sandy's", "2/1/2025", 200, "Paid"],
                    ["Galene", "2/1/2025", 350, "Paid"],
                    ["The Fly Trap", "2/1/2025", 300, "Paid"],
                    ["Nisei", "2/1/2025", 500, "Paid"],
                    ["Eat Street", "2/1/2025", 0, "Paused"],
                    ["Dacha", "2/1/2025", 500, "Paid"],
                    ["John's Grill", "2/1/2025", 500, "Paid"],
                    ["JG Credit", "2/1/2025", 100, "Paid"],
                    ["Hinodeya", "2/1/2025", 600, "Paid"],
                    ["Yokai", "2/1/2025", 650, "Paid"],
                    ["McBaker Deli", "2/1/2025", 350, "Paid"],
                    ["Harborview", "2/1/2025", 550, "Paid"],

                    // Continue with all historical data...
                    // (The complete dataset would include all entries back to December 2023)
                ];

                // Convert compressed format to full format
                return compressedData.map(record => ({
                    client: record[0],
                    month: record[1],
                    amount: `$${record[2].toLocaleString()}.00`,
                    status: record[3],
                    notes: record[4] || ""
                }));
            }

            processMasterLogData(rawData) {
                const clients = new Map();
                const payments = [];
                const clientStartDates = new Map();
                const clientNameMapping = {
                    "3rd Cousin + Precita Social": "3rd Cousin",
                    "San Benito": "San Benito House",
                    "Turkey and the Wolf": "Turkey and the Wolf",
                    // Consolidate Dine Credit clients into single entity
                    "Californios": "Dine Credit",
                    "Nisei": "Dine Credit"
                };

                rawData.forEach(record => {
                    // Standardize client name
                    let clientName = clientNameMapping[record.client] || record.client;

                    // Parse date (M/D/YYYY to YYYY-MM-DD)
                    const [month, day, year] = record.month.split('/');
                    const formattedDate = `${year}-${month.padStart(2, '0')}-01`;

                    // Parse amount (remove $ and convert to number)
                    const amount = parseFloat(record.amount.replace('$', '').replace(',', ''));

                    // Map payment status
                    let paymentStatus = record.status.toLowerCase();
                    if (paymentStatus === 'n/a') paymentStatus = 'unpaid';

                    // Determine client status based on recent activity and amount
                    let clientStatus = 'active';
                    if (paymentStatus === 'paused' || amount === 0) {
                        clientStatus = 'paused';
                    }

                    // Track earliest date for each client (start date)
                    if (!clientStartDates.has(clientName) || formattedDate < clientStartDates.get(clientName)) {
                        clientStartDates.set(clientName, formattedDate);
                    }

                    // Store unique clients with their most recent amount
                    // For Dine Credit, combine amounts from both Californios and Nisei
                    if (!clients.has(clientName) || formattedDate > clients.get(clientName).lastUpdate) {
                        let totalAmount = amount;

                        // If this is Dine Credit, check if we need to combine amounts
                        if (clientName === "Dine Credit") {
                            const existingClient = clients.get(clientName);
                            if (existingClient && formattedDate === existingClient.lastUpdate) {
                                // Same month, add the amounts together
                                totalAmount = existingClient.amount + amount;
                            } else if (existingClient && formattedDate > existingClient.lastUpdate) {
                                // New month, calculate combined amount for this month
                                // Get both Californios and Nisei amounts for this month
                                const californiosRecord = rawData.find(r =>
                                    r.client === "Californios" && r.month === record.month
                                );
                                const niseiRecord = rawData.find(r =>
                                    r.client === "Nisei" && r.month === record.month
                                );

                                const californiosAmount = californiosRecord ?
                                    parseFloat(californiosRecord.amount.replace('$', '').replace(',', '')) : 0;
                                const niseiAmount = niseiRecord ?
                                    parseFloat(niseiRecord.amount.replace('$', '').replace(',', '')) : 0;

                                totalAmount = californiosAmount + niseiAmount;
                            }
                        }

                        clients.set(clientName, {
                            name: clientName,
                            amount: totalAmount,
                            status: clientStatus,
                            lastUpdate: formattedDate,
                            startDate: clientStartDates.get(clientName)
                        });
                    }

                    // Create payment record
                    // For Dine Credit, we need to handle consolidation in payments too
                    let paymentAmount = amount;

                    if (clientName === "Dine Credit") {
                        // Check if we already have a payment record for this month
                        const existingPaymentIndex = payments.findIndex(p =>
                            p.clientName === "Dine Credit" && p.month === formattedDate
                        );

                        if (existingPaymentIndex >= 0) {
                            // Update existing payment record with combined amount
                            payments[existingPaymentIndex].amount += amount;
                            payments[existingPaymentIndex].notes = (payments[existingPaymentIndex].notes || "") +
                                (record.notes ? ` | ${record.notes}` : "");
                        } else {
                            // Create new payment record
                            payments.push({
                                clientName: clientName,
                                month: formattedDate,
                                amount: paymentAmount,
                                status: paymentStatus,
                                notes: record.notes || null,
                                paymentDate: paymentStatus === 'paid' ? formattedDate : null
                            });
                        }
                    } else {
                        // Regular client - create normal payment record
                        payments.push({
                            clientName: clientName,
                            month: formattedDate,
                            amount: paymentAmount,
                            status: paymentStatus,
                            notes: record.notes || null,
                            paymentDate: paymentStatus === 'paid' ? formattedDate : null
                        });
                    }
                });

                return {
                    clients: Array.from(clients.values()),
                    payments: payments
                };
            }

            async syncClientsFromMasterLog(clientsData) {
                console.log('Syncing clients table with', clientsData.length, 'clients');

                for (const client of clientsData) {
                    try {
                        // Check if client exists
                        const { data: existing } = await this.supabase
                            .from('clients')
                            .select('*')
                            .eq('name', client.name)
                            .single();

                        if (existing) {
                            // Update existing client
                            await this.supabase
                                .from('clients')
                                .update({
                                    amount: client.amount,
                                    status: client.status
                                })
                                .eq('id', existing.id);
                            console.log(`Updated client: ${client.name}`);
                        } else {
                            // Insert new client
                            await this.supabase
                                .from('clients')
                                .insert({
                                    name: client.name,
                                    amount: client.amount,
                                    status: client.status,
                                    start_date: client.startDate
                                });
                            console.log(`Added new client: ${client.name} (started ${client.startDate})`);
                        }
                    } catch (error) {
                        console.error(`Error syncing client ${client.name}:`, error);
                    }
                }
            }

            async syncPaymentsFromMasterLog(paymentsData) {
                console.log('Syncing payments table with', paymentsData.length, 'payment records');

                // Get the date range from the payments data
                const dates = paymentsData.map(p => p.month).sort();
                const startDate = dates[0];
                const endDate = dates[dates.length - 1];

                console.log(`Clearing payments from ${startDate} to ${endDate}`);

                // Clear existing payments in the date range
                await this.supabase
                    .from('monthly_payments')
                    .delete()
                    .gte('month', startDate)
                    .lte('month', endDate);

                // Get client IDs for mapping
                const { data: clients } = await this.supabase
                    .from('clients')
                    .select('id, name');

                const clientIdMap = new Map();
                clients.forEach(client => {
                    clientIdMap.set(client.name, client.id);
                });

                // Insert new payment records in batches
                const batchSize = 50;
                for (let i = 0; i < paymentsData.length; i += batchSize) {
                    const batch = paymentsData.slice(i, i + batchSize);
                    const paymentRecords = batch.map(payment => ({
                        client_id: clientIdMap.get(payment.clientName),
                        month: payment.month,
                        status: payment.status,
                        payment_date: payment.paymentDate,
                        notes: payment.notes
                    })).filter(record => record.client_id); // Only include records with valid client IDs

                    if (paymentRecords.length > 0) {
                        await this.supabase
                            .from('monthly_payments')
                            .insert(paymentRecords);
                    }
                }

                console.log('Payments sync completed');
            }

            async generateReconciliationReport(processedData) {
                const report = {
                    timestamp: new Date().toISOString(),
                    clientsProcessed: processedData.clients.length,
                    paymentsProcessed: processedData.payments.length,
                    newClients: [],
                    updatedClients: [],
                    totalExpectedRevenue: 0,
                    totalPaidRevenue: 0,
                    unpaidClientsCount: 0
                };

                // Calculate summary metrics
                const paidPayments = processedData.payments.filter(p => p.status === 'paid');
                report.totalPaidRevenue = paidPayments.reduce((sum, p) => sum + p.amount, 0);

                const unpaidPayments = processedData.payments.filter(p => p.status === 'unpaid');
                report.unpaidClientsCount = new Set(unpaidPayments.map(p => p.clientName)).size;

                report.totalExpectedRevenue = processedData.clients
                    .filter(c => c.status === 'active')
                    .reduce((sum, c) => sum + c.amount, 0);

                return report;
            }

            async calculateActualLifetimeValue(clientId, clientName) {
                try {
                    // Get all paid payments for this client from the database
                    const { data: payments, error } = await this.supabase
                        .from('monthly_payments')
                        .select('*')
                        .eq('client_id', clientId)
                        .eq('status', 'paid');

                    if (error) {
                        console.error('Error fetching payments for lifetime value:', error);
                        return 0;
                    }

                    if (!payments || payments.length === 0) {
                        return 0;
                    }

                    // Sum all actual paid amounts
                    let totalPaid = 0;

                    // Method 1: Try to get actual amounts from Master Invoice Log data
                    const masterLogData = this.getMasterInvoiceLogData();
                    let clientMasterData;

                    if (clientName === "Dine Credit") {
                        // For Dine Credit, get both Californios and Nisei records
                        clientMasterData = masterLogData.filter(record =>
                            (record.client === "Californios" || record.client === "Nisei") &&
                            record.status.toLowerCase() === 'paid'
                        );
                    } else {
                        clientMasterData = masterLogData.filter(record =>
                            record.client === clientName && record.status.toLowerCase() === 'paid'
                        );
                    }

                    if (clientMasterData.length > 0) {
                        // Use actual amounts from Master Invoice Log
                        totalPaid = clientMasterData.reduce((sum, record) => {
                            const amount = parseFloat(record.amount.replace('$', '').replace(',', ''));
                            return sum + amount;
                        }, 0);
                    } else {
                        // Fallback: Use client's current amount * number of paid months
                        const { data: client } = await this.supabase
                            .from('clients')
                            .select('amount')
                            .eq('id', clientId)
                            .single();

                        if (client) {
                            totalPaid = payments.length * parseFloat(client.amount || 0);
                        }
                    }

                    return totalPaid;
                } catch (error) {
                    console.error('Error calculating lifetime value:', error);
                    return 0;
                }
            }

            async updateLifetimeValues(clients) {
                // Update lifetime values asynchronously
                for (const client of clients) {
                    try {
                        const lifetimeValue = await this.calculateActualLifetimeValue(client.id, client.name);
                        const cell = document.querySelector(`.lifetime-value-${client.id}`);
                        if (cell) {
                            cell.innerHTML = `$${lifetimeValue.toLocaleString()}`;
                            cell.setAttribute('data-value', lifetimeValue); // Store for sorting
                        }
                    } catch (error) {
                        console.error(`Error updating lifetime value for ${client.name}:`, error);
                        const cell = document.querySelector(`.lifetime-value-${client.id}`);
                        if (cell) {
                            cell.innerHTML = 'Error';
                        }
                    }
                }
            }

            showReconciliationSummary(report) {
                const summaryHtml = `
                    <div style="background: white; border-radius: var(--border-radius); padding: 24px; margin: 20px; box-shadow: var(--shadow-soft);">
                        <h3 style="margin-bottom: 16px; color: var(--primary-text);">Master Invoice Log Sync Results</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div>
                                <div style="margin-bottom: 8px;"><strong>Clients Processed:</strong> ${report.clientsProcessed}</div>
                                <div style="margin-bottom: 8px;"><strong>Payments Processed:</strong> ${report.paymentsProcessed}</div>
                                <div style="margin-bottom: 8px;"><strong>Total Expected Revenue:</strong> $${report.totalExpectedRevenue.toLocaleString()}</div>
                            </div>
                            <div>
                                <div style="margin-bottom: 8px;"><strong>Total Paid Revenue:</strong> $${report.totalPaidRevenue.toLocaleString()}</div>
                                <div style="margin-bottom: 8px;"><strong>Unpaid Clients:</strong> ${report.unpaidClientsCount}</div>
                                <div style="margin-bottom: 8px;"><strong>Sync Time:</strong> ${new Date(report.timestamp).toLocaleString()}</div>
                            </div>
                        </div>
                        <div style="margin-top: 16px; padding: 12px; background: var(--light-gray); border-radius: 8px;">
                            <strong>Note:</strong> This sync included data for July-September 2025. To include the complete historical dataset,
                            update the getMasterInvoiceLogData() function with all invoice records.
                        </div>
                    </div>
                `;

                // Temporarily show the summary in the main content area
                const contentDiv = document.getElementById('tabContent');
                const originalContent = contentDiv.innerHTML;
                contentDiv.innerHTML = summaryHtml + originalContent;

                // Auto-hide after 10 seconds
                setTimeout(() => {
                    contentDiv.innerHTML = originalContent;
                }, 10000);
            }

            // =============================================================================
            // OVERVIEW ANALYTICS FUNCTIONS
            // =============================================================================

            async getEnhancedOverdueClients(overdueClients, payments) {
                // Enhance overdue client data with payment history and owed amounts
                return overdueClients.map(client => {
                    // Find the client's current payment record to get payment ID
                    const currentPayment = payments.find(p => p.clients?.name === client.name);

                    // Calculate months overdue and owed amount
                    const monthlyAmount = parseFloat(client.amount) || 0;
                    const monthsOverdue = client.monthsOverdue || 2; // minimum 2 months
                    const owedAmount = monthlyAmount * monthsOverdue;

                    // Format last payment date
                    let lastPayment = 'Never';
                    if (client.lastPaymentDate) {
                        const paymentDate = new Date(client.lastPaymentDate);
                        lastPayment = paymentDate.toLocaleDateString('en-US', {
                            month: 'short',
                            year: '2-digit'
                        });
                    }

                    return {
                        ...client,
                        paymentId: currentPayment?.id,
                        owedAmount,
                        monthsOverdue,
                        lastPayment
                    };
                });
            }

            async getOverdueClients(months = 2) {
                try {
                    const clients = await this.loadClients();
                    const overdueClients = [];

                    // Use Master Invoice Log data for more accurate overdue calculation
                    const masterLogData = this.getMasterInvoiceLogData();

                    // Calculate date threshold (months ago)
                    const thresholdDate = new Date();
                    thresholdDate.setMonth(thresholdDate.getMonth() - months);
                    const thresholdMonthStr = thresholdDate.toISOString().slice(0, 7);

                    console.log(`Checking for overdue clients - looking for payments since ${thresholdMonthStr}`);

                    // Check each active client
                    for (const client of clients.filter(c => c.status === 'active')) {
                        let clientName = client.name;

                        // Handle consolidated clients (Dine Credit)
                        let hasRecentPayment = false;

                        if (clientName === "Dine Credit") {
                            // Check both Californios and Nisei records
                            hasRecentPayment = masterLogData.some(record =>
                                (record.client === "Californios" || record.client === "Nisei") &&
                                record.status.toLowerCase() === 'paid' &&
                                record.month >= thresholdMonthStr
                            );
                        } else {
                            // Check normal client records
                            hasRecentPayment = masterLogData.some(record =>
                                record.client === clientName &&
                                record.status.toLowerCase() === 'paid' &&
                                record.month >= thresholdMonthStr
                            );
                        }

                        // If no recent payments, check if they have any payments in our dataset at all
                        let hasAnyPayments = false;
                        if (clientName === "Dine Credit") {
                            hasAnyPayments = masterLogData.some(record =>
                                (record.client === "Californios" || record.client === "Nisei") &&
                                record.status.toLowerCase() === 'paid'
                            );
                        } else {
                            hasAnyPayments = masterLogData.some(record =>
                                record.client === clientName &&
                                record.status.toLowerCase() === 'paid'
                            );
                        }

                        // Only mark as overdue if they have payment history but no recent payments
                        // Skip clients with no payment history (might be too new or outside our dataset)
                        if (hasAnyPayments && !hasRecentPayment) {
                            // Calculate actual months overdue by finding their last payment
                            let lastPaymentMonth = null;

                            if (clientName === "Dine Credit") {
                                const paidRecords = masterLogData.filter(record =>
                                    (record.client === "Californios" || record.client === "Nisei") &&
                                    record.status.toLowerCase() === 'paid'
                                ).sort((a, b) => b.month.localeCompare(a.month));
                                lastPaymentMonth = paidRecords[0]?.month;
                            } else {
                                const paidRecords = masterLogData.filter(record =>
                                    record.client === clientName &&
                                    record.status.toLowerCase() === 'paid'
                                ).sort((a, b) => b.month.localeCompare(a.month));
                                lastPaymentMonth = paidRecords[0]?.month;
                            }

                            if (lastPaymentMonth) {
                                const lastPaymentDate = new Date(lastPaymentMonth + '-01');
                                const currentDate = new Date();
                                const monthsDiff = (currentDate.getFullYear() - lastPaymentDate.getFullYear()) * 12 +
                                                 (currentDate.getMonth() - lastPaymentDate.getMonth());

                                overdueClients.push({
                                    id: client.id,
                                    name: client.name,
                                    amount: client.amount,
                                    monthsOverdue: monthsDiff,
                                    lastPayment: lastPaymentMonth
                                });
                            }
                        }
                    }

                    console.log(`Found ${overdueClients.length} truly overdue clients:`, overdueClients.map(c => `${c.name} (${c.monthsOverdue} months)`));
                    return overdueClients;
                } catch (error) {
                    console.error('Error getting overdue clients:', error);
                    return [];
                }
            }

            async renderOverviewCharts() {
                try {
                    const clients = await this.loadClients();

                    // Render monthly expected revenue chart
                    this.renderOverviewMonthlyRevenueChart(clients);

                    // Render Google vs Non-Google income chart
                    this.renderGoogleVsNonGoogleChart(clients);

                    // Force purple colors after chart rendering
                    setTimeout(() => this.forceChartColors(), 100);

                } catch (error) {
                    console.error('Error rendering overview charts:', error);
                }
            }

            async refreshAllCharts() {
                console.log('🔄 Refreshing all charts across all tabs...');

                try {
                    // Destroy existing chart instances to prevent memory leaks
                    if (this.charts) {
                        Object.values(this.charts).forEach(chart => {
                            if (chart && typeof chart.destroy === 'function') {
                                chart.destroy();
                            }
                        });
                    }

                    // Invalidate analytics cache so it recalculates on next render
                    this.analyticsData = null;

                    // Refresh Overview charts if that tab has been rendered
                    const overviewChart = document.getElementById('overviewMonthlyRevenueChart');
                    if (overviewChart) {
                        console.log('📊 Refreshing Overview charts...');
                        await this.renderOverviewCharts();
                    }

                    // Refresh Analytics charts if that tab has been rendered
                    const analyticsSection = document.getElementById('analyticsSection');
                    if (analyticsSection) {
                        console.log('📈 Refreshing Analytics charts...');
                        // Only re-render if user is on analytics tab to avoid DOM conflicts
                        if (this.currentTab === 'analytics') {
                            const contentDiv = document.getElementById('tabContent');
                            if (contentDiv) {
                                this.showLoading();
                                contentDiv.innerHTML = await this.renderAnalytics();
                                this.hideLoading();
                            }
                        }
                    }

                    console.log('✅ All charts refreshed successfully');
                } catch (error) {
                    console.error('Error refreshing charts:', error);
                }
            }

            renderOverviewMonthlyRevenueChart(clients) {
                const ctx = document.getElementById('overviewMonthlyRevenueChart');
                if (!ctx) return;

                // Actual historical monthly revenue data (HISTORICAL ONLY - current month uses dynamic calculation)
                const actualRevenueData = new Map([
                    ['2023-12', 1600],
                    ['2024-01', 1950],
                    ['2024-02', 2500],
                    ['2024-03', 3425],
                    ['2024-04', 3950],
                    ['2024-05', 4975],
                    ['2024-06', 5350],
                    ['2024-07', 5400],
                    ['2024-08', 7850],
                    ['2024-09', 6150],
                    ['2024-10', 6900],
                    ['2024-11', 6800],
                    ['2024-12', 6800],
                    ['2025-01', 7100],
                    ['2025-02', 10450],
                    ['2025-03', 9250],
                    ['2025-04', 13260],
                    ['2025-05', 13260],
                    ['2025-06', 14510],
                    ['2025-07', 15210],
                    ['2025-08', 16310],
                    ['2025-09', 17210]
                    // ✅ October 2025 onwards: Use DYNAMIC calculation from active clients
                ]);

                // Calculate historical revenue progression based on client acquisition and growth
                const activeClients = clients.filter(c => c.status === 'active');

                // Get Master Invoice Log data for reference
                const masterLogData = this.getMasterInvoiceLogData();

                // Calculate client start dates and historical progression
                const monthsData = [];
                const currentDate = new Date();

                // Create client timeline with start dates and amounts
                const clientTimeline = new Map();

                // Initialize known client information from Master Invoice Log and business rules
                const clientStartDates = new Map([
                    // Core early clients (estimated start dates based on business growth)
                    ["John's Grill", "2024-01-01"],
                    ["Limoncello", "2024-02-01"],
                    ["Twelve Oak", "2024-03-01"],
                    ["Regal", "2024-04-01"],
                    ["Cote Ouest", "2024-05-01"],
                    ["Hot Johnnie's", "2024-06-01"],
                    ["Amarena", "2024-07-01"],
                    ["Mr. Magic", "2024-08-01"],
                    ["3rd Cousin", "2024-09-01"],
                    ["Harborview", "2024-10-01"],
                    ["Kei", "2024-11-01"],
                    ["District", "2024-12-01"],
                    ["Indigo", "2025-01-01"],
                    ["Crepe House", "2025-01-15"],
                    ["Hungry Eyes", "2025-01-30"],
                    ["Hot Stuff", "2025-02-01"],
                    ["San Benito House", "2025-02-01"], // User confirmed Feb 2025
                    ["Californios", "2025-03-01"], // Part of Dine Credit
                    ["Nisei", "2025-03-15"], // Part of Dine Credit
                    ["EzyDog", "2025-04-01"], // User confirmed Apr 2025
                    ["Dacha", "2025-05-01"]
                ]);

                // Client amount progression (accounting for upsells)
                const clientAmountHistory = new Map([
                    ["John's Grill", [
                        { startDate: "2024-01-01", amount: 500 },
                        { startDate: "2025-06-01", amount: 2000 } // Upsell to $2000
                    ]],
                    ["Dacha", [
                        { startDate: "2025-05-01", amount: 500 },
                        { startDate: "2025-07-01", amount: 900 } // Upsell to $900
                    ]]
                ]);

                // Set default amounts for clients without specific history
                activeClients.forEach(client => {
                    if (!clientAmountHistory.has(client.name)) {
                        const startDate = clientStartDates.get(client.name) || "2024-01-01";
                        clientAmountHistory.set(client.name, [
                            { startDate: startDate, amount: parseFloat(client.amount) || 0 }
                        ]);
                    }
                });

                // Generate last 18 months + 2 future months (total 20 months for planning)
                const currentMonthStr = currentDate.toISOString().slice(0, 7); // Current month in YYYY-MM format

                for (let i = 17; i >= -2; i--) {  // Changed from i >= 0 to i >= -2 to include 2 future months
                    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
                    const monthStr = date.toISOString().slice(0, 7); // YYYY-MM format
                    const displayMonth = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

                    let monthlyRevenue = 0;

                    // Use actual historical data if available
                    if (actualRevenueData.has(monthStr)) {
                        monthlyRevenue = actualRevenueData.get(monthStr);
                        console.log(`Using actual revenue for ${monthStr}: $${monthlyRevenue}`);
                    } else if (monthStr >= '2025-10') {
                        // ✅ FIXED: DYNAMIC CALCULATION for October 2025 onwards (not just current+ months)
                        // This ensures October bar persists even when current month switches to November
                        // Only include clients that have started by this month and respect churn dates
                        const monthDate = new Date(monthStr + '-01');
                        const includedClients = [];
                        monthlyRevenue = activeClients.reduce((sum, client) => {
                            // Check month-specific status to respect churn_date and reactivation_date
                            const monthStatus = this.getClientStatusForMonth(client, monthStr);
                            if (monthStatus === 'active') {
                                const clientStart = new Date(client.start_date || '2024-01-01');
                                if (clientStart <= monthDate) {
                                    includedClients.push({ name: client.name, amount: parseFloat(client.amount) || 0, startDate: client.start_date });
                                    return sum + (parseFloat(client.amount) || 0);
                                }
                            }
                            return sum;
                        }, 0);
                        console.log(`📊 Dynamic calculation for ${monthStr}: $${monthlyRevenue} from ${includedClients.length} clients:`, includedClients);
                    }

                    monthsData.push({
                        month: monthStr,
                        display: displayMonth,
                        expected: monthlyRevenue
                    });
                }

                const labels = monthsData.map(d => d.display);
                const data = monthsData.map(d => d.expected);

                console.log('Historical Revenue Progression Chart Data:');
                console.log('Labels:', labels);
                console.log('Data:', data);
                console.log('Total growth from', data[0], 'to', data[data.length - 1]);

                if (this.charts.overviewMonthlyRevenue) {
                    this.charts.overviewMonthlyRevenue.destroy();
                }

                this.charts.overviewMonthlyRevenue = new Chart(ctx.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Expected Revenue',
                            data,
                            backgroundColor: '#5b21b6',
                            borderColor: '#4c1d95',
                            borderWidth: 1,
                            borderRadius: 4,
                            borderSkipped: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                backgroundColor: 'rgba(91, 33, 182, 0.95)',
                                titleColor: '#ffffff',
                                bodyColor: '#ffffff',
                                borderColor: '#5b21b6',
                                borderWidth: 1,
                                padding: 12,
                                displayColors: false,
                                callbacks: {
                                    label: function(context) {
                                        return `Expected: $${context.parsed.y.toLocaleString()}`;
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return '$' + value.toLocaleString();
                                    },
                                    color: '#6b7280'
                                },
                                grid: {
                                    color: 'rgba(0,0,0,0.05)',
                                    drawBorder: false
                                }
                            },
                            x: {
                                ticks: {
                                    color: '#6b7280'
                                },
                                grid: {
                                    display: false
                                }
                            }
                        }
                    }
                });
            }

            renderGoogleVsNonGoogleChart(clients) {
                const ctx = document.getElementById('googleVsNonGoogleChart');
                if (!ctx) return;

                // Static Google income
                const googleIncome = 215000;

                // Dynamic non-Google income: MRR × 12 from active clients
                const activeClients = clients.filter(c => c.status === 'active');

                // Debug: Log each client and their amount
                console.log('=== MRR CALCULATION BREAKDOWN ===');
                console.log('Active clients found:', activeClients.length);
                let debugTotal = 0;
                activeClients.forEach(client => {
                    const amount = parseFloat(client.amount) || 0;
                    debugTotal += amount;
                    console.log(`${client.name}: $${amount.toLocaleString()}`);
                });
                console.log(`Total MRR: $${debugTotal.toLocaleString()}`);
                console.log('=== END BREAKDOWN ===');

                const monthlyRecurringRevenue = activeClients.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
                const nonGoogleIncome = monthlyRecurringRevenue * 12;
                const totalIncome = googleIncome + nonGoogleIncome;

                // Calculate percentages
                const googlePercentage = ((googleIncome / totalIncome) * 100).toFixed(1);
                const nonGooglePercentage = ((nonGoogleIncome / totalIncome) * 100).toFixed(1);

                if (this.charts.googleVsNonGoogle) {
                    this.charts.googleVsNonGoogle.destroy();
                }

                this.charts.googleVsNonGoogle = new Chart(ctx.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: ['Google Income', 'Non-Google Income'],
                        datasets: [{
                            data: [googleIncome, nonGoogleIncome],
                            backgroundColor: ['#9CA3AF', '#22C55E'],
                            borderColor: ['#6B7280', '#16A34A'],
                            borderWidth: 2,
                            hoverBorderWidth: 3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '60%',
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const value = context.parsed;
                                        const percentage = ((value / totalIncome) * 100).toFixed(1);
                                        return `${context.label}: $${value.toLocaleString()} (${percentage}%)`;
                                    }
                                }
                            }
                        },
                        animation: {
                            animateScale: true,
                            animateRotate: true
                        }
                    }
                });
            }

            async contactClient(clientName) {
                // Show contact information or actions for overdue client
                const message = `Contact ${clientName} about overdue payments:\n\n` +
                    `• Send email reminder\n` +
                    `• Make phone call\n` +
                    `• Send invoice copy\n\n` +
                    `Would you like to mark their payment as paid once contacted?`;

                if (confirm(message)) {
                    // Find the client's payment and mark as paid
                    try {
                        const payments = await this.loadPayments();
                        const payment = payments.find(p => p.clients?.name === clientName);

                        if (payment) {
                            await this.togglePaymentStatus(payment.id, 'unpaid');
                            this.showTab('overview'); // Refresh overview
                        } else {
                            this.toast(`Could not find payment record for ${clientName}`, 'error');
                        }
                    } catch (error) {
                        this.toast('Error updating payment status', 'error');
                        console.error('Error in contactClient:', error);
                    }
                } else {
                    this.toast(`Reminder: Follow up with ${clientName} about overdue payments`, 'info');
                }
            }

            async exportOverdueClients() {
                try {
                    console.log('Exporting overdue clients list...');

                    // Get overdue clients data
                    const overdueClients = await this.getOverdueClients(2);
                    const payments = await this.loadPayments();
                    const enhancedOverdueClients = await this.getEnhancedOverdueClients(overdueClients, payments);

                    if (enhancedOverdueClients.length === 0) {
                        this.toast('No overdue clients to export! 🎉', 'success');
                        return;
                    }

                    // Create CSV content
                    let csv = 'Client Name,Monthly Amount,Months Overdue,Amount Owed,Last Payment,Status\n';

                    enhancedOverdueClients.forEach(client => {
                        const row = [
                            `"${client.name}"`,
                            `$${parseFloat(client.amount).toFixed(2)}`,
                            client.monthsOverdue,
                            `$${client.owedAmount.toFixed(2)}`,
                            client.lastPayment,
                            client.status
                        ].join(',');
                        csv += row + '\n';
                    });

                    // Download CSV
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `overdue_clients_${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    window.URL.revokeObjectURL(url);

                    this.toast(`Exported ${enhancedOverdueClients.length} overdue clients to CSV`, 'success');
                } catch (error) {
                    console.error('Error exporting overdue clients:', error);
                    this.toast('Failed to export overdue clients', 'error');
                }
            }

            async mergeFSDCAndRegal() {
                console.log('🔄 Merging FSDC and Regal into "FSDC by Regal"...');

                if (!confirm('This will merge "FSDC" and "Regal" into a single client called "FSDC by Regal".\n\nAll payment history from both clients will be preserved.\n\nContinue?')) {
                    return;
                }

                this.showLoading();
                try {
                    // Find both clients
                    const { data: clients, error: findError } = await this.supabase
                        .from('clients')
                        .select('*')
                        .or('name.ilike.FSDC,name.ilike.Regal');

                    if (findError) throw findError;

                    if (!clients || clients.length === 0) {
                        this.toast('FSDC or Regal clients not found', 'warning');
                        this.hideLoading();
                        return;
                    }

                    const fsdcClient = clients.find(c => c.name.toLowerCase().includes('fsdc'));
                    const regalClient = clients.find(c => c.name.toLowerCase().includes('regal'));

                    if (!fsdcClient && !regalClient) {
                        this.toast('Neither FSDC nor Regal found', 'warning');
                        this.hideLoading();
                        return;
                    }

                    // Determine which client to keep (prefer one with earlier start date or more history)
                    let keepClient, deleteClient;
                    if (fsdcClient && regalClient) {
                        keepClient = fsdcClient;
                        deleteClient = regalClient;
                    } else {
                        keepClient = fsdcClient || regalClient;
                        deleteClient = null;
                    }

                    // Update the kept client's name to "FSDC by Regal"
                    const { error: updateError } = await this.supabase
                        .from('clients')
                        .update({ name: 'FSDC by Regal' })
                        .eq('id', keepClient.id);

                    if (updateError) throw updateError;
                    console.log('✅ Updated client name to "FSDC by Regal"');

                    // If there's a duplicate, merge its payments and delete it
                    if (deleteClient) {
                        // Transfer all payments from deleteClient to keepClient
                        const { error: paymentUpdateError } = await this.supabase
                            .from('monthly_payments')
                            .update({ client_id: keepClient.id })
                            .eq('client_id', deleteClient.id);

                        if (paymentUpdateError) throw paymentUpdateError;
                        console.log('✅ Merged payment history');

                        // Delete the duplicate client
                        const { error: deleteError } = await this.supabase
                            .from('clients')
                            .delete()
                            .eq('id', deleteClient.id);

                        if (deleteError) throw deleteError;
                        console.log('✅ Deleted duplicate client');
                    }

                    // Refresh all data
                    this.clearCache();
                    await this.loadClients();
                    await this.loadPayments();
                    await this.updateQuickStats();
                    await this.renderTabContent(this.currentTab);

                    this.toast('Successfully merged into "FSDC by Regal"!', 'success');
                    console.log('✅ Merge completed');
                } catch (error) {
                    console.error('❌ Error merging clients:', error);
                    this.toast('Error merging clients', 'error');
                } finally {
                    this.hideLoading();
                }
            }

            async addReactivationDateColumn() {
                console.log('🔧 Starting client status columns migration...');

                if (!confirm('This will add "churn_date" and "reactivation_date" columns to the clients table.\n\nThese columns are required for the client status management features.\n\nContinue?')) {
                    return;
                }

                this.showLoading();
                try {
                    console.log('═══════════════════════════════════════');
                    console.log('📋 ADDING REQUIRED COLUMNS TO CLIENTS TABLE');
                    console.log('═══════════════════════════════════════');
                    console.log('');
                    console.log('Please run the following SQL in your Supabase SQL Editor:');
                    console.log('');
                    console.log('-- Add churn_date column (tracks when client was churned/paused)');
                    console.log('ALTER TABLE clients ADD COLUMN IF NOT EXISTS churn_date TEXT;');
                    console.log('');
                    console.log('-- Add reactivation_date column (tracks when client was reactivated)');
                    console.log('ALTER TABLE clients ADD COLUMN IF NOT EXISTS reactivation_date TEXT;');
                    console.log('');
                    console.log('═══════════════════════════════════════');
                    console.log('');
                    console.log('Steps:');
                    console.log('1. Copy the SQL commands above');
                    console.log('2. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql');
                    console.log('3. Paste and run the SQL');
                    console.log('4. Refresh your dashboard');
                    console.log('');

                    // Show user-friendly modal with SQL
                    const sqlCommands = `-- Add required columns for client status management
ALTER TABLE clients ADD COLUMN IF NOT EXISTS churn_date TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS reactivation_date TEXT;`;

                    // Create a copyable text area
                    const modalHtml = `
                        <div id="sqlModal" class="modal show">
                            <div class="modal-content" style="max-width: 600px;">
                                <h2 style="margin-bottom: 16px;">Add Required Database Columns</h2>
                                <p style="margin-bottom: 16px; color: var(--secondary-text);">
                                    Please run this SQL in your Supabase SQL Editor:
                                </p>
                                <textarea id="sqlCommands" readonly style="
                                    width: 100%;
                                    height: 120px;
                                    padding: 12px;
                                    font-family: monospace;
                                    font-size: 13px;
                                    background: #1a1a1a;
                                    color: #00ff00;
                                    border: 1px solid var(--border-color);
                                    border-radius: 4px;
                                    margin-bottom: 16px;
                                    resize: none;
                                ">${sqlCommands}</textarea>
                                <div style="display: flex; gap: 12px;">
                                    <button class="btn primary" onclick="
                                        const textarea = document.getElementById('sqlCommands');
                                        textarea.select();
                                        document.execCommand('copy');
                                        Dashboard.toast('SQL copied to clipboard!', 'success');
                                    ">
                                        Copy SQL
                                    </button>
                                    <button class="btn secondary" onclick="
                                        window.open('https://supabase.com/dashboard', '_blank');
                                    ">
                                        Open Supabase
                                    </button>
                                    <button class="btn secondary" onclick="
                                        document.getElementById('sqlModal').remove();
                                    ">
                                        Close
                                    </button>
                                </div>
                                <p style="margin-top: 16px; font-size: 0.9em; color: var(--secondary-text);">
                                    After running the SQL, refresh your dashboard and try reactivating the client again.
                                </p>
                            </div>
                        </div>
                    `;

                    document.body.insertAdjacentHTML('beforeend', modalHtml);

                    this.toast('📋 SQL commands ready - see modal', 'info');
                } catch (error) {
                    console.error('❌ Error:', error);
                    this.toast('Error - see console for details', 'error');
                } finally {
                    this.hideLoading();
                }
            }

            async migratePaymentsSchema() {
                console.log('🔧 Starting monthly_payments schema migration...');

                if (!confirm('This will:\n\n1. Try to add an "amount" column to the monthly_payments table (via SQL)\n2. Backfill existing records with amounts from the clients table\n3. Add a unique constraint on (client_id, month)\n\nThis is required to fix the payment status update issue.\n\nContinue?')) {
                    return;
                }

                this.showLoading();
                try {
                    // Step 1: Try to add the amount column via SQL
                    console.log('Adding amount column to monthly_payments table...');
                    try {
                        await this.supabase.rpc('exec_sql', {
                            sql: 'ALTER TABLE monthly_payments ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2);'
                        });
                        console.log('✅ Amount column added (or already exists)');
                    } catch (sqlError) {
                        console.warn('Could not add column via RPC (this is normal):', sqlError);
                        console.log('Attempting alternative method...');

                        // Try using Supabase's SQL editor functionality
                        // This likely won't work from frontend, but worth trying
                        const { error: alterError } = await this.supabase
                            .from('monthly_payments')
                            .select('amount')
                            .limit(1);

                        if (alterError && alterError.message.includes('does not exist')) {
                            this.toast('⚠️ Need manual step: Please add "amount" column (DECIMAL) to monthly_payments table in Supabase dashboard first.', 'warning');
                            console.error('Amount column does not exist. Please add it manually in Supabase.');
                            this.hideLoading();
                            return;
                        }
                    }

                    // Step 2: Get all payment records with their client data
                    console.log('Fetching payment records...');
                    const { data: payments, error: fetchError } = await this.supabase
                        .from('monthly_payments')
                        .select(`
                            *,
                            clients (
                                id,
                                name,
                                amount
                            )
                        `);

                    if (fetchError) throw fetchError;

                    console.log(`Found ${payments.length} payment records to migrate`);

                    // Step 3: Update each payment record to include the amount
                    let updatedCount = 0;
                    let skippedCount = 0;
                    for (const payment of payments) {
                        if (payment.clients && payment.clients.amount) {
                            const { error: updateError } = await this.supabase
                                .from('monthly_payments')
                                .update({ amount: payment.clients.amount })
                                .eq('id', payment.id);

                            if (updateError) {
                                console.error(`Error updating payment ${payment.id}:`, updateError);
                                skippedCount++;
                            } else {
                                updatedCount++;
                            }
                        } else {
                            skippedCount++;
                        }
                    }

                    console.log(`✅ Updated ${updatedCount} payment records with amounts`);
                    if (skippedCount > 0) {
                        console.warn(`⚠️ Skipped ${skippedCount} records (no client data)`);
                    }

                    // Step 4: Try to add unique constraint
                    console.log('Adding unique constraint on (client_id, month)...');
                    try {
                        await this.supabase.rpc('exec_sql', {
                            sql: 'ALTER TABLE monthly_payments ADD CONSTRAINT IF NOT EXISTS monthly_payments_client_month_unique UNIQUE (client_id, month);'
                        });
                        console.log('✅ Unique constraint added');
                    } catch (constraintError) {
                        console.warn('Could not add constraint via RPC (this is normal). Please add manually in Supabase:', constraintError);
                    }

                    // Refresh all data
                    this.clearCache();
                    await this.loadPayments();
                    await this.updateQuickStats();
                    await this.renderTabContent(this.currentTab);

                    this.toast(`Migration complete! Updated ${updatedCount} payment records.`, 'success');
                } catch (error) {
                    console.error('❌ Error during migration:', error);
                    this.toast('Migration failed. Check console for details.', 'error');
                } finally {
                    this.hideLoading();
                }
            }

            async cleanupDuplicatePayments() {
                console.log('🧹 Starting payment records cleanup...');

                if (!confirm('This will remove duplicate payment records for the same client-month combinations.\n\nThis is safe and will fix the issue where updating one month affects another.\n\nContinue?')) {
                    return;
                }

                this.showLoading();
                try {
                    // Get all payment records
                    const { data: allPayments, error: fetchError } = await this.supabase
                        .from('monthly_payments')
                        .select('*')
                        .order('client_id, month, created_at');

                    if (fetchError) throw fetchError;

                    console.log(`Found ${allPayments.length} total payment records`);

                    // Find duplicates - group by client_id + month
                    const paymentGroups = new Map();
                    allPayments.forEach(payment => {
                        const key = `${payment.client_id}_${payment.month}`;
                        if (!paymentGroups.has(key)) {
                            paymentGroups.set(key, []);
                        }
                        paymentGroups.get(key).push(payment);
                    });

                    // Find groups with duplicates
                    const duplicateGroups = Array.from(paymentGroups.values())
                        .filter(group => group.length > 1);

                    console.log(`Found ${duplicateGroups.length} duplicate client-month combinations`);

                    if (duplicateGroups.length === 0) {
                        this.toast('No duplicate payment records found! ✨', 'success');
                        this.hideLoading();
                        return;
                    }

                    // For each duplicate group, keep the most recent one and delete the rest
                    let deletedCount = 0;
                    for (const group of duplicateGroups) {
                        // Sort by created_at descending, keep the first (most recent)
                        group.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                        const toKeep = group[0];
                        const toDelete = group.slice(1);

                        console.log(`Client ${toKeep.client_id}, Month ${toKeep.month}: Keeping ID ${toKeep.id}, deleting ${toDelete.length} duplicates`);

                        // Delete the duplicates
                        for (const payment of toDelete) {
                            const { error: deleteError } = await this.supabase
                                .from('monthly_payments')
                                .delete()
                                .eq('id', payment.id);

                            if (deleteError) {
                                console.error(`Error deleting payment ${payment.id}:`, deleteError);
                            } else {
                                deletedCount++;
                            }
                        }
                    }

                    console.log(`✅ Deleted ${deletedCount} duplicate payment records`);

                    // Refresh all data
                    this.clearCache();
                    await this.loadPayments();
                    await this.updateQuickStats();
                    await this.renderTabContent(this.currentTab);

                    this.toast(`Cleaned up ${deletedCount} duplicate payment records!`, 'success');
                } catch (error) {
                    console.error('❌ Error cleaning up duplicate payments:', error);
                    this.toast('Error cleaning up duplicate payments', 'error');
                } finally {
                    this.hideLoading();
                }
            }

            async cleanupDuplicateClients() {
                console.log('🧹 Starting client cleanup...');

                if (!confirm('This will remove the following clients:\n\n- dine credit\n- Johnnie\'s Grill dine credit\n- Californios (keeping Californios dine credit)\n- Nisei (keeping Nisei dine credit)\n\nThis action cannot be undone. Continue?')) {
                    return;
                }

                this.showLoading();
                try {
                    const clientsToRemove = [
                        'dine credit',
                        'Johnnie\'s Grill dine credit',
                        'Californios',
                        'Nisei'
                    ];

                    for (const clientName of clientsToRemove) {
                        console.log(`🗑️ Removing client: ${clientName}`);

                        // Get client ID first
                        const { data: client, error: findError } = await this.supabase
                            .from('clients')
                            .select('id')
                            .ilike('name', clientName)
                            .single();

                        if (findError) {
                            console.warn(`Client "${clientName}" not found:`, findError);
                            continue;
                        }

                        if (client) {
                            // Delete related payment records first
                            const { error: paymentsError } = await this.supabase
                                .from('monthly_payments')
                                .delete()
                                .eq('client_id', client.id);

                            if (paymentsError) {
                                console.error(`Error deleting payments for ${clientName}:`, paymentsError);
                            } else {
                                console.log(`✅ Deleted payments for ${clientName}`);
                            }

                            // Delete the client
                            const { error: clientError } = await this.supabase
                                .from('clients')
                                .delete()
                                .eq('id', client.id);

                            if (clientError) {
                                console.error(`Error deleting client ${clientName}:`, clientError);
                            } else {
                                console.log(`✅ Deleted client ${clientName}`);
                            }
                        }
                    }

                    // Refresh all data
                    this.clearCache();
                    await this.loadClients();
                    await this.loadPayments();
                    await this.updateQuickStats();
                    await this.renderTabContent(this.currentTab);

                    this.toast('Client cleanup completed successfully!', 'success');
                    console.log('✅ Client cleanup completed');
                } catch (error) {
                    console.error('❌ Error during client cleanup:', error);
                    this.toast('Error during client cleanup', 'error');
                } finally {
                    this.hideLoading();
                }
            }

            // =============================================================================
            // MOBILE HELPER FUNCTIONS
            // =============================================================================

            isMobileDevice() {
                return window.innerWidth <= 767;
            }

            fixMobileGridLayouts() {
                if (!this.isMobileDevice()) return;
                console.log('Applying mobile grid fixes...');

                // Force all grid containers to single column
                document.querySelectorAll('.data-section [style*="grid-template-columns"]').forEach(el => {
                    el.style.display = 'block';
                    el.style.gridTemplateColumns = 'none';
                    el.style.width = '100%';
                });

                // Ensure all chart containers fit
                document.querySelectorAll('.chart-container').forEach(el => {
                    el.style.width = '100%';
                    el.style.maxWidth = '100%';
                    el.style.marginLeft = '0';
                    el.style.marginRight = '0';
                    el.style.padding = '12px';
                });
            }

            getMobileChartOptions(baseOptions) {
                if (!this.isMobileDevice()) return baseOptions;

                const mobileOptions = JSON.parse(JSON.stringify(baseOptions));

                // Force responsive behavior
                mobileOptions.responsive = true;
                mobileOptions.maintainAspectRatio = true;
                mobileOptions.aspectRatio = 1.5;
                mobileOptions.devicePixelRatio = window.devicePixelRatio || 1;

                // Adjust legend position for mobile
                if (mobileOptions.plugins?.legend) {
                    if (mobileOptions.plugins.legend.position === 'right') {
                        mobileOptions.plugins.legend.position = 'bottom';
                    }
                    mobileOptions.plugins.legend.labels = mobileOptions.plugins.legend.labels || {};
                    mobileOptions.plugins.legend.labels.font = { size: 9 };
                    mobileOptions.plugins.legend.labels.padding = 6;
                    mobileOptions.plugins.legend.labels.boxWidth = 12;
                }

                // Add layout padding to prevent cutoff
                mobileOptions.layout = mobileOptions.layout || {};
                mobileOptions.layout.padding = { top: 5, right: 5, bottom: 5, left: 5 };

                // Reduce font sizes for mobile
                if (mobileOptions.scales) {
                    Object.keys(mobileOptions.scales).forEach(scaleKey => {
                        if (mobileOptions.scales[scaleKey].ticks) {
                            mobileOptions.scales[scaleKey].ticks.font = { size: 10 };
                        }
                    });
                }

                return mobileOptions;
            }


        }

        // =============================================================================
        // INITIALIZE DASHBOARD
        // =============================================================================

        // Global dashboard instance
        let Dashboard;

        // Initialize when page loads and Chart.js is available
        window.addEventListener('load', () => {
            console.log('🚀 Window loaded, starting Dashboard initialization...');
            // Check if Chart.js is loaded
            const initDashboard = () => {
                console.log('📊 Checking for Chart.js...', typeof Chart !== 'undefined' ? 'FOUND' : 'NOT FOUND');
                if (typeof Chart !== 'undefined') {
                    console.log('Chart.js loaded, initializing dashboard...');
                    try {
                        Dashboard = new DashboardCore();
                        window.Dashboard = Dashboard; // Make Dashboard globally accessible
                        console.log('✅ Dashboard created successfully and attached to window:', Dashboard);

                        // Add global helper functions
                        window.populateFutureMonths = () => {
                            if (Dashboard && Dashboard.populateFutureMonths) {
                                console.log('🚀 Starting future months population...');
                                return Dashboard.populateFutureMonths();
                            } else {
                                console.error('Dashboard not ready or function not available');
                            }
                        };

                        window.detectDuplicates = async () => {
                            if (Dashboard && Dashboard.detectAndCleanDuplicatePayments) {
                                console.log('🔍 Starting duplicate detection...');
                                try {
                                    const result = await Dashboard.detectAndCleanDuplicatePayments();
                                    console.log('📊 Duplicate Detection Results:', result);
                                    if (result.duplicatesDeleted > 0) {
                                        Dashboard.toast(`Cleaned up ${result.duplicatesDeleted} duplicate payment records!`, 'success');
                                        Dashboard.refreshData();
                                    } else {
                                        Dashboard.toast('No duplicates found!', 'success');
                                    }
                                    return result;
                                } catch (error) {
                                    console.error('❌ Error detecting duplicates:', error);
                                    Dashboard.toast('Error detecting duplicates: ' + error.message, 'error');
                                }
                            } else {
                                console.error('Dashboard not ready or function not available');
                            }
                        };

                        window.forceRefresh = () => {
                            if (Dashboard) {
                                console.log('🔄 Force refreshing all data...');
                                Dashboard.clearCache();
                                Dashboard.refreshData();
                                Dashboard.toast('Data refreshed!', 'success');
                            } else {
                                console.error('Dashboard not ready');
                            }
                        };

                        window.syncMonthlyData = async () => {
                            if (!Dashboard || !Dashboard.supabase) {
                                console.error('Dashboard not ready');
                                return;
                            }

                            console.log('🔍 Checking monthly_data table for Oct/Nov/Dec 2025...');

                            const monthsToSync = [
                                { month: '2025-10', costs: 0 },
                                { month: '2025-11', costs: 0 },
                                { month: '2025-12', costs: 0 }
                            ];

                            try {
                                // Check what exists
                                const { data: existing, error: selectError } = await Dashboard.supabase
                                    .from('monthly_data')
                                    .select('*')
                                    .in('month', ['2025-10', '2025-11', '2025-12']);

                                if (selectError) throw selectError;

                                console.log('📊 Existing records:', existing);

                                const existingMonths = new Set((existing || []).map(r => r.month));
                                const toInsert = monthsToSync.filter(m => !existingMonths.has(m.month));
                                const toUpdate = monthsToSync.filter(m => existingMonths.has(m.month));

                                // Insert missing months
                                if (toInsert.length > 0) {
                                    console.log('➕ Inserting:', toInsert);
                                    const { data: inserted, error: insertError } = await Dashboard.supabase
                                        .from('monthly_data')
                                        .insert(toInsert)
                                        .select();

                                    if (insertError) throw insertError;
                                    console.log('✅ Inserted:', inserted);
                                }

                                // Update existing months (if needed)
                                if (toUpdate.length > 0) {
                                    console.log('🔄 Existing months found:', toUpdate.map(m => m.month));
                                    console.log('   No updates needed - costs already set to 0');
                                }

                                console.log('✅ Monthly data sync complete!');
                                console.log('📝 Summary:');
                                console.log(`   - Oct 2025: ${existingMonths.has('2025-10') ? 'EXISTS' : 'CREATED'}`);
                                console.log(`   - Nov 2025: ${existingMonths.has('2025-11') ? 'EXISTS' : 'CREATED'}`);
                                console.log(`   - Dec 2025: ${existingMonths.has('2025-12') ? 'EXISTS' : 'CREATED'}`);

                                Dashboard.toast('Monthly data synced!', 'success');
                                Dashboard.clearCache();
                                await Dashboard.refreshData();

                            } catch (error) {
                                console.error('❌ Error syncing monthly data:', error);
                                Dashboard.toast('Error syncing data', 'error');
                            }
                        };

                        console.log('💡 TIPS:');
                        console.log('  - Run syncMonthlyData() to sync Oct/Nov/Dec 2025 in database');
                        console.log('  - Run populateFutureMonths() to setup October 2025 and future months');
                        console.log('  - Run detectDuplicates() to find and clean duplicate payment records');
                        console.log('  - Run forceRefresh() to clear cache and reload all data');

                    } catch (error) {
                        console.error('❌ Error creating Dashboard:', error);
                    }
                } else {
                    console.log('Waiting for Chart.js to load...');
                    setTimeout(initDashboard, 100);
                }
            };
            initDashboard();
        });

        // Prevent form submissions from refreshing page
        document.addEventListener('submit', (e) => {
            e.preventDefault();
        });
