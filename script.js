// =============================================================================
// CONSTANTS AND CONFIGURATION
// =============================================================================

// Questions data for impact assessment
const questions = [
    {
        id: 'impact',
        text: 'What is the customer impact?',
        options: [
            { value: 'A', label: 'Complete blocker - can\'t proceed with core workflow', score: 50 },
            { value: 'B', label: 'Major disruption - significant manual workaround', score: 35 },
            { value: 'C', label: 'Moderate impact - workflow slowed but manageable', score: 20 },
            { value: 'D', label: 'Minor inconvenience - doesn\'t block main tasks', score: 10 },
            { value: 'E', label: 'Cosmetic/edge case - barely noticeable', score: 5 }
        ]
    },
    {
        id: 'urgency',
        text: 'What is the customer urgency?',
        options: [
            { value: 'A', label: 'Immediate blocker for go-live/critical deadline', score: 40 },
            { value: 'B', label: 'Needed within 1-2 weeks', score: 25 },
            { value: 'C', label: 'Would like fix within a month', score: 20 },
            { value: 'D', label: 'No specific timeline/whenever convenient', score: 5 }
        ]
    },
    {
        id: 'scope',
        text: 'What is the scope of impact?',
        options: [
            { value: 'A', label: 'Affects all users/core functionality', score: 30 },
            { value: 'B', label: 'Affects most users/important features', score: 20 },
            { value: 'C', label: 'Affects some users/specific workflows', score: 10 },
            { value: 'D', label: 'Affects few users/edge cases', score: 5 }
        ]
    },
    {
        id: 'workaround',
        text: 'Is there a workaround available?',
        options: [
            { value: 'A', label: 'No workaround exists', score: 20 },
            { value: 'B', label: 'Workaround exists but very time-consuming/complex', score: 15 },
            { value: 'C', label: 'Reasonable workaround but not ideal', score: 8 },
            { value: 'D', label: 'Easy workaround available', score: 3 }
        ]
    }
];

// Step configuration
const TOTAL_STEPS = 7;
const STEP_TITLES = [
    'Report Type',
    'Ticket Type',
    'Due Diligence',
    'Customer Information',
    'Impact Assessment',
    'Documentation',
    'Final Report'
];


// Plan scoring constants (Customer Tier - Max: 10 points)
const PLAN_SCORES = {
    'Enterprise+': 10,
    'Growth': 7,
    'Starter': 5,
    'Open Source': 3,
    'Prospect': 5,
    'Internal': 1
};

// Priority thresholds (base score thresholds)
const PRIORITY_THRESHOLDS = {
    MEDIUM: 50,
    LOW: 20
};

// Display multipliers for priority levels
const PRIORITY_DISPLAY_MULTIPLIERS = {
    SEVERE: 1.0,
    HIGH: 1.0,
    MEDIUM: 1.3,
    LOW: 1.2,
    TRIVIAL: 1.1
};

// Max score for progress bar calculation (150 base × 2.5 multiplier × 1.3 display = ~500)
const MAX_SCORE_FOR_DISPLAY = 500;

// Step management
let currentStep = 1;

// DOM element cache for performance
const elements = {};

// Application data
const appData = {
    reportType: 'bug',
    ticketType: 'new', // 'new' or 'update'
    isQuickCalc: false, // Quick calculator mode
    reportSource: 'external', // 'external', 'prospect', or 'internal'
    isInternal: false, // Legacy field for backward compatibility
    customerName: '',
    monthlyARR: '',
    planType: '',
    customPlanText: '',
    customPlanScore: 1,
    intercomURLs: [''],
    slackURLs: [''],
    customerComment: '',
    dueDiligence: {
        checkedExistingTickets: false,
        reviewedDocumentation: false,
        checkedSlackDiscussions: false
    },
    questionsAnswered: {},
    // Bug-specific fields
    bugSummary: '',
    stepsToReproduce: '',
    expectedVsActual: '',
    calculatedScore: 0,
    priority: '',
    // Story-specific fields
    storyDescription: '',
    currentVsExpected: '',
    timelineContext: '',
};


// EasyMDE instances
const editors = {};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Debounces a function to limit how often it can be called
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Sanitizes user input to prevent XSS attacks
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;

    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes all user data before template generation
 */
function sanitizeAppData(appData) {
    const sanitizedData = {
        customerName: sanitizeInput(appData.customerName),
        customPlanText: sanitizeInput(appData.customPlanText),
        intercomURLs: appData.intercomURLs.map(url => sanitizeInput(url)).filter(url => url.trim()),
        slackURLs: appData.slackURLs.map(url => sanitizeInput(url)).filter(url => url.trim()),
        customerComment: sanitizeInput(appData.customerComment),
        bugSummary: sanitizeInput(appData.bugSummary),
        stepsToReproduce: sanitizeInput(appData.stepsToReproduce),
        expectedVsActual: sanitizeInput(appData.expectedVsActual),
        storyDescription: sanitizeInput(appData.storyDescription),
        currentVsExpected: sanitizeInput(appData.currentVsExpected),
        timelineContext: sanitizeInput(appData.timelineContext)
    };

    return sanitizedData;
}

/**
 * Formats a number as currency with thousand separators and no decimals
 */
function formatCurrency(value) {
    const rounded = Math.round(value);
    return rounded.toLocaleString('en-US');
}

/**
 * Gets the score based on the selected plan type from customer details
 */
function getPlanTypeScore(appData) {
    // Check report source first
    if (appData.reportSource === 'internal') {
        return PLAN_SCORES['Internal'];
    }

    if (appData.reportSource === 'prospect') {
        return PLAN_SCORES['Prospect'];
    }

    // Legacy support for isInternal flag
    if (appData.isInternal) {
        return PLAN_SCORES['Internal'];
    }

    if (appData.planType === 'Custom') {
        // Use custom score if provided, map 1-5 to new scale (1-10)
        const customScore = appData.customPlanScore || 1;
        return Math.min(customScore * 2, 10);
    }

    return PLAN_SCORES[appData.planType] || 1;
}

/**
 * Determines the impact/urgency multiplier based on selected answers
 */
function getImpactUrgencyMultiplier(appData) {
    const impact = appData.questionsAnswered.impact;
    const urgency = appData.questionsAnswered.urgency;

    if (impact === 'A' && urgency === 'A') {
        return 2.5;
    } else if (impact === 'A' || urgency === 'A') {
        return 2.0;
    } else if (impact === 'B' && urgency === 'B') {
        return 1.5;
    }
    return 1.0;
}

/**
 * Calculates the bug score based on questions and plan type
 * Returns object with baseScore, multiplier, and finalScore
 */
function calculateBugScore(appData) {
    let baseScore = 0;

    // Calculate score from questions (impact + urgency + scope + workaround)
    questions.forEach(question => {
        const selectedValue = appData.questionsAnswered[question.id];
        if (selectedValue) {
            const option = question.options.find(opt => opt.value === selectedValue);
            if (option) {
                baseScore += option.score;
            }
        }
    });

    // Add plan type score (Customer Tier)
    const planTypeScore = getPlanTypeScore(appData);
    baseScore += planTypeScore;

    // Get impact/urgency multiplier
    const multiplier = getImpactUrgencyMultiplier(appData);

    // Calculate final score with multiplier
    const finalScore = Math.round(baseScore * multiplier);

    return {
        baseScore,
        multiplier,
        finalScore
    };
}

/**
 * Determines the priority level and corresponding CSS classes based on score and multiplier.
 * Priority is determined by multiplier first, then base score thresholds.
 */
function getPriority(baseScore, multiplier) {
    const baseClasses = "p-4 rounded-lg shadow-md border-l-4 mb-4 text-sm";

    // Severe: multiplier >= 2.0 (Impact A and/or Urgency A)
    if (multiplier >= 2.0) {
        return {
            text: 'Severe',
            displayMultiplier: PRIORITY_DISPLAY_MULTIPLIERS.SEVERE,
            classList: `${baseClasses} bg-red-100 dark:bg-red-800/70 border-red-500 dark:border-red-500 text-red-700 dark:text-red-200`
        };
    }

    // High: multiplier = 1.5 (Impact B AND Urgency B)
    if (multiplier === 1.5) {
        return {
            text: 'High',
            displayMultiplier: PRIORITY_DISPLAY_MULTIPLIERS.HIGH,
            classList: `${baseClasses} bg-orange-100 dark:bg-orange-800/70 border-orange-500 dark:border-orange-500 text-orange-700 dark:text-orange-200`
        };
    }

    // Score-based priorities (with display multipliers)
    if (baseScore >= PRIORITY_THRESHOLDS.MEDIUM) {
        return {
            text: 'Medium',
            displayMultiplier: PRIORITY_DISPLAY_MULTIPLIERS.MEDIUM,
            classList: `${baseClasses} bg-amber-100 dark:bg-amber-800/70 border-amber-500 dark:border-amber-500 text-amber-700 dark:text-amber-200`
        };
    }

    if (baseScore >= PRIORITY_THRESHOLDS.LOW) {
        return {
            text: 'Low',
            displayMultiplier: PRIORITY_DISPLAY_MULTIPLIERS.LOW,
            classList: `${baseClasses} bg-sky-100 dark:bg-sky-800/70 border-sky-500 dark:border-sky-500 text-sky-700 dark:text-sky-200`
        };
    }

    return {
        text: 'Trivial',
        displayMultiplier: PRIORITY_DISPLAY_MULTIPLIERS.TRIVIAL,
        classList: `${baseClasses} bg-slate-200 dark:bg-slate-700/70 border-slate-500 dark:border-slate-500 text-slate-700 dark:text-slate-300`
    };
}

/**
 * Validates current step and returns validation result with specific error messages
 */
function validateCurrentStep(currentStep, appData) {
    const errors = [];
    let isValid = true;

    switch (currentStep) {
        case 3: // Due diligence
            if (appData.ticketType === 'new') {
                const checkedExistingTickets = document.getElementById('checkedExistingTickets');
                const reviewedDocumentation = document.getElementById('reviewedDocumentation');
                const checkedSlackDiscussions = document.getElementById('checkedSlackDiscussions');

                if (!checkedExistingTickets || !checkedExistingTickets.checked) {
                    errors.push('Please confirm you have checked for pre-existing tickets');
                    isValid = false;
                }

                if (!reviewedDocumentation || !reviewedDocumentation.checked) {
                    errors.push('Please confirm you have reviewed the documentation');
                    isValid = false;
                }

                if (!checkedSlackDiscussions || !checkedSlackDiscussions.checked) {
                    errors.push('Please confirm you have checked Slack discussions');
                    isValid = false;
                }
            }
            // Skip due diligence for update tickets
            break;

        case 4: // Customer details
            // Get report source from radio buttons
            const reportSourceRadio = document.querySelector('input[name="reportSource"]:checked');
            const reportSource = reportSourceRadio ? reportSourceRadio.value : 'external';

            if (reportSource === 'internal') {
                // For internal updates (bug or story), comment is required
                if (appData.ticketType === 'update') {
                    const customerComment = document.getElementById('customerComment');
                    const value = editors.customerComment ? editors.customerComment.value() : (customerComment ? customerComment.value : '');
                    if (!value.trim()) {
                        errors.push('Comment is required for internal updates');
                        isValid = false;
                    }
                }
            } else if (reportSource === 'prospect') {
                // Prospect: only customer name is required
                const customerName = document.getElementById('customerName');
                if (!customerName || customerName.value.trim() === '') {
                    errors.push('Customer/Prospect name is required');
                    isValid = false;
                }

                // For story updates, customer comment is also required
                if (appData.reportType === 'story' && appData.ticketType === 'update') {
                    const customerComment = document.getElementById('customerComment');
                    const value = editors.customerComment ? editors.customerComment.value() : (customerComment ? customerComment.value : '');
                    if (!value.trim()) {
                        errors.push('Customer comment is required for story updates');
                        isValid = false;
                    }
                }
            } else {
                // Customer: all fields required
                const customerName = document.getElementById('customerName');
                if (!customerName || customerName.value.trim() === '') {
                    errors.push('Customer name is required');
                    isValid = false;
                }

                // Monthly ARR is required for external reports
                const monthlyARR = document.getElementById('monthlyARR');
                if (!monthlyARR || monthlyARR.value.trim() === '') {
                    errors.push('Monthly ARR is required');
                    isValid = false;
                } else if (isNaN(parseFloat(monthlyARR.value)) || parseFloat(monthlyARR.value) < 0) {
                    errors.push('Monthly ARR must be a valid number (0 or greater)');
                    isValid = false;
                }

                // Plan type is required for external reports
                const planType = document.getElementById('planType');
                if (!planType || planType.value.trim() === '') {
                    errors.push('Plan type is required');
                    isValid = false;
                } else if (planType.value === 'Custom') {
                    const customPlanText = document.getElementById('customPlanText');
                    if (!customPlanText || customPlanText.value.trim() === '') {
                        errors.push('Custom plan type description is required');
                        isValid = false;
                    }

                    const customPlanScore = document.getElementById('customPlanScore');
                    if (!customPlanScore || customPlanScore.value.trim() === '') {
                        errors.push('Custom plan score is required');
                        isValid = false;
                    } else {
                        const score = parseInt(customPlanScore.value);
                        if (isNaN(score) || score < 1 || score > 5) {
                            errors.push('Custom plan score must be exactly 1, 2, 3, 4, or 5');
                            isValid = false;
                        }
                    }
                }

                // For story updates, customer comment is also required
                if (appData.reportType === 'story' && appData.ticketType === 'update') {
                    const customerComment = document.getElementById('customerComment');
                    const value = editors.customerComment ? editors.customerComment.value() : (customerComment ? customerComment.value : '');
                    if (!value.trim()) {
                        errors.push('Customer comment is required for story updates');
                        isValid = false;
                    }
                }
            }

            // Validate URL fields - ensure no empty fields between filled ones (for non-internal)
            if (reportSource !== 'internal') {
                const intercomURLs = collectURLValues('intercom');
                const slackURLs = collectURLValues('slack');

                // Check for gaps in URL arrays (empty fields between filled ones)
                const intercomFields = document.querySelectorAll('#intercomURLsContainer input[type="text"]');
                const slackFields = document.querySelectorAll('#slackURLsContainer input[type="text"]');

                let hasIntercomGap = false;
                let hasSlackGap = false;
                let foundIntercomContent = false;
                let foundSlackContent = false;

                // Check Intercom URLs for gaps
                Array.from(intercomFields).reverse().forEach(field => {
                    if (field.value.trim()) {
                        foundIntercomContent = true;
                    } else if (foundIntercomContent) {
                        hasIntercomGap = true;
                    }
                });

                // Check Slack URLs for gaps
                Array.from(slackFields).reverse().forEach(field => {
                    if (field.value.trim()) {
                        foundSlackContent = true;
                    } else if (foundSlackContent) {
                        hasSlackGap = true;
                    }
                });

                if (hasIntercomGap) {
                    errors.push('Please fill in all Intercom URL fields or remove empty ones');
                    isValid = false;
                }

                if (hasSlackGap) {
                    errors.push('Please fill in all Slack URL fields or remove empty ones');
                    isValid = false;
                }
            }
            break;

        case 5: // Impact assessment or Story documentation
            if (appData.reportType === 'story') {
                // For story updates, skip this step entirely
                if (appData.ticketType === 'update') {
                    break;
                }
                // For new stories, all story fields are required
                const requiredFields = [
                    { id: 'storyDescription', label: 'Description' },
                    { id: 'currentVsExpected', label: 'Current vs Expected functionality' },
                    { id: 'timelineContext', label: 'Timeline & context' }
                ];

                requiredFields.forEach(field => {
                    const element = document.getElementById(field.id);
                    const value = editors[field.id] ? editors[field.id].value() : (element ? element.value : '');
                    if (!value.trim()) {
                        errors.push(`${field.label} is required`);
                        isValid = false;
                    }
                });
            } else {
                // Bug impact assessment
                const unansweredQuestions = questions.filter(q =>
                    !document.querySelector(`input[name="${q.id}"]:checked`)
                );

                unansweredQuestions.forEach(q => {
                    errors.push(`Please answer: ${q.text}`);
                    isValid = false;
                });
            }
            break;

        case 6: // Bug documentation
            const requiredBugFields = [
                { id: 'bugSummary', label: 'Summary' }
            ];

            // For new tickets, all fields are required
            if (appData.ticketType === 'new') {
                requiredBugFields.push(
                    { id: 'stepsToReproduce', label: 'Steps to reproduce' },
                    { id: 'expectedVsActual', label: 'Expected vs actual behavior' }
                );
            }

            requiredBugFields.forEach(field => {
                const element = document.getElementById(field.id);
                const value = editors[field.id] ? editors[field.id].value() : (element ? element.value : '');
                if (!value.trim()) {
                    errors.push(`${field.label} is required`);
                    isValid = false;
                }
            });
            break;
    }

    return { isValid, errors };
}


/**
 * Caches commonly used DOM elements for better performance
 */
function cacheDOMElements() {
    // Form elements - Step 4 (Customer Details)
    elements.internalReport = document.getElementById('internalReport');
    elements.customerName = document.getElementById('customerName');
    elements.monthlyARR = document.getElementById('monthlyARR');
    elements.planType = document.getElementById('planType');
    elements.customPlanText = document.getElementById('customPlanText');
    elements.customPlanScore = document.getElementById('customPlanScore');
    elements.customerComment = document.getElementById('customerComment');
    elements.externalFields = document.getElementById('externalFields');
    elements.customPlanContainer = document.getElementById('customPlanContainer');

    // Navigation elements
    elements.prevBtn = document.getElementById('prevBtn');
    elements.nextBtn = document.getElementById('nextBtn');
    elements.navigationContainer = document.getElementById('navigationContainer');
    elements.progressIndicator = document.getElementById('progressIndicator');
    elements.quickProgressIndicator = document.getElementById('quickProgressIndicator');
    elements.stepTitle = document.getElementById('stepTitle');
    elements.progressBar = document.getElementById('progressBar');

    // Output elements - Step 7
    elements.scoreValue = document.getElementById('scoreValue');
    elements.priorityText = document.getElementById('priorityText');
    elements.priorityAlert = document.getElementById('priorityAlert');
    elements.scoreProgressBar = document.getElementById('scoreProgressBar');
    elements.copyText = document.getElementById('copyText');

    // Quick calculator elements
    elements.quickInternalReport = document.getElementById('quickInternalReport');
    elements.quickPlanType = document.getElementById('quickPlanType');
    elements.quickScoreValue = document.getElementById('quickScoreValue');
    elements.quickPriorityText = document.getElementById('quickPriorityText');
}

// Event listener for when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');

    // Cache DOM elements for performance
    cacheDOMElements();

    // Initialize dark mode based on system preference
    initDarkMode();

    // Initialize step navigation
    initStepNavigation();

    // Initialize questions
    initQuestions();

    // Initialize EasyMDE editors
    initEasyMDE();

    // Initialize dynamic URL fields
    initDynamicURLFields();

    // Initialize tooltips
    initTooltips();

    // Set up event listeners
    setupEventListeners();

    // Show the first step
    showStep(1);
});

/**
 * Initializes dark mode functionality.
 */
function initDarkMode() {
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        applyTheme(e.matches ? 'dark' : 'light');
    });
}

/**
 * Sets up all event listeners
 */
function setupEventListeners() {
    // Step 1: Report type selection
    const selectBugBtn = document.getElementById('selectBugBtn');
    const selectStoryBtn = document.getElementById('selectStoryBtn');
    const selectQuickCalcBtn = document.getElementById('selectQuickCalcBtn');

    if (selectBugBtn) {
        selectBugBtn.addEventListener('click', () => {
            appData.reportType = 'bug';
            appData.isQuickCalc = false;
            nextStep();
        });
    }

    if (selectStoryBtn) {
        selectStoryBtn.addEventListener('click', () => {
            appData.reportType = 'story';
            appData.isQuickCalc = false;
            nextStep();
        });
    }

    if (selectQuickCalcBtn) {
        selectQuickCalcBtn.addEventListener('click', () => {
            appData.reportType = 'bug'; // Quick calc uses bug logic for scoring
            appData.isQuickCalc = true;
            showStep(8); // Go directly to quick calc step
        });
    }

    // Step 2: Ticket type selection
    const selectNewTicketBtn = document.getElementById('selectNewTicketBtn');
    const selectUpdateTicketBtn = document.getElementById('selectUpdateTicketBtn');
    
    if (selectNewTicketBtn) {
        selectNewTicketBtn.addEventListener('click', () => {
            appData.ticketType = 'new';
            nextStep();
        });
    }
    
    if (selectUpdateTicketBtn) {
        selectUpdateTicketBtn.addEventListener('click', () => {
            appData.ticketType = 'update';
            nextStep();
        });
    }

    // Step 4: Report source radio buttons
    const reportSourceRadios = document.querySelectorAll('input[name="reportSource"]');
    reportSourceRadios.forEach(radio => {
        radio.addEventListener('change', handleReportSourceChange);
    });

    // Step 3: Plan type dropdown
    const planTypeSelect = document.getElementById('planType');
    if (planTypeSelect) {
        planTypeSelect.addEventListener('change', handlePlanTypeChange);
    }

    // Navigation buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', prevStep);
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', nextStep);
    }

    // Confirmation modal buttons
    const confirmResetBtn = document.getElementById('confirmResetBtn');
    const cancelResetBtn = document.getElementById('cancelResetBtn');

    if (confirmResetBtn) {
        confirmResetBtn.addEventListener('click', function() {
            hideResetConfirmationModal();
            startNewReport(); // Reset and go to step 1
        });
    }

    if (cancelResetBtn) {
        cancelResetBtn.addEventListener('click', function() {
            hideResetConfirmationModal();
            // Stay on current step - no action needed
        });
    }

    // Close modal when clicking outside
    const confirmationModal = document.getElementById('confirmationModal');
    if (confirmationModal) {
        confirmationModal.addEventListener('click', function(e) {
            if (e.target === confirmationModal) {
                hideResetConfirmationModal();
            }
        });
    }

    // Quick calculator navigation buttons
    const quickStep8PrevBtn = document.getElementById('quickStep8PrevBtn');
    const quickStep9PrevBtn = document.getElementById('quickStep9PrevBtn');

    if (quickStep8PrevBtn) {
        quickStep8PrevBtn.addEventListener('click', function() {
            // Reset data and go back to step 1 (start)
            startNewReport();
        });
    }

    if (quickStep9PrevBtn) {
        quickStep9PrevBtn.addEventListener('click', function() {
            // Go back to step 8 (questionnaire)
            showStep(8);
        });
    }

    // Step 7: Final actions
    const copyBtn = document.getElementById('copyBtn');
    const startNewBtn = document.getElementById('startNewBtn');

    if (copyBtn) {
        copyBtn.addEventListener('click', copyToClipboard);
    }

    if (startNewBtn) {
        startNewBtn.addEventListener('click', startNewReport);
    }
}

/**
 * Initializes step navigation UI
 */
function initStepNavigation() {
    updateProgressIndicator();
}

/**
 * Shows the specified step and hides others
 */
function showStep(stepNumber) {
    currentStep = stepNumber;

    // Hide all steps (including quick calc steps 8 and 9)
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        const stepElement = document.getElementById(`step${i}`);
        if (stepElement) {
            stepElement.classList.add('hidden');
        }
    }
    // Also hide quick calc steps
    const step8 = document.getElementById('step8');
    const step9 = document.getElementById('step9');
    if (step8) step8.classList.add('hidden');
    if (step9) step9.classList.add('hidden');

    // Show current step
    const currentStepElement = document.getElementById(`step${stepNumber}`);
    if (currentStepElement) {
        currentStepElement.classList.remove('hidden');
    }

    // Handle step 5 content based on report type
    if (stepNumber === 4) {
        updateStep5Content();
    }

    // Handle quick calculator step initialization
    if (stepNumber === 8) {
        initializeQuickCalculatorStep();
    }

    // Update progress and navigation
    updateProgressIndicator();
    updateNavigation();

    // Focus management
    focusFirstElement(stepNumber);

    // Announce step change to screen readers
    announceStepChange(stepNumber);

    // Update tab order for the new step
    updateTabOrder();

    // Ensure all hidden elements are properly untabbable
    setTimeout(() => {
        setHiddenElementsUntabbable();
    }, 50);
}

/**
 * Updates the progress indicator
 */
function updateProgressIndicator() {
    const progressIndicator = document.getElementById('progressIndicator');
    const quickProgressIndicator = document.getElementById('quickProgressIndicator');
    const currentStepEl = document.getElementById('currentStep');
    const stepTitleEl = document.getElementById('stepTitle');
    const progressBar = document.getElementById('progressBar');
    const quickStepTitleEl = document.getElementById('quickStepTitle');
    const quickProgressBar = document.getElementById('quickProgressBar');

    // Handle quick calculator steps
    if (currentStep === 8 || currentStep === 9) {
        progressIndicator.classList.add('hidden');
        quickProgressIndicator.classList.remove('hidden');

        if (currentStep === 8) {
            if (quickStepTitleEl) quickStepTitleEl.textContent = 'Impact Assessment';
            if (quickProgressBar) quickProgressBar.style.width = '50%';
        } else if (currentStep === 9) {
            if (quickStepTitleEl) quickStepTitleEl.textContent = 'Results';
            if (quickProgressBar) quickProgressBar.style.width = '100%';
        }
    } else {
        // Hide quick calculator progress and handle regular flow
        quickProgressIndicator.classList.add('hidden');

        if (currentStep === 1) {
            progressIndicator.classList.add('hidden');
        } else {
            progressIndicator.classList.remove('hidden');
            if (stepTitleEl) stepTitleEl.textContent = STEP_TITLES[currentStep - 1];
            if (progressBar) {
                const progressPercent = (currentStep / TOTAL_STEPS) * 100;
                progressBar.style.width = `${progressPercent}%`;
            }
        }
    }
}

/**
 * Updates navigation button states
 */
function updateNavigation() {
    const navigationContainer = document.getElementById('navigationContainer');
    const quickStep8Navigation = document.getElementById('quickStep8Navigation');
    const quickStep9Navigation = document.getElementById('quickStep9Navigation');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    // Hide all navigation containers first
    navigationContainer.classList.add('hidden');
    if (quickStep8Navigation) quickStep8Navigation.classList.add('hidden');
    if (quickStep9Navigation) quickStep9Navigation.classList.add('hidden');

    // Show appropriate navigation based on current step
    if (currentStep === 8) {
        // Quick calculator questionnaire step
        if (quickStep8Navigation) quickStep8Navigation.classList.remove('hidden');
    } else if (currentStep === 9) {
        // Quick calculator results step
        if (quickStep9Navigation) quickStep9Navigation.classList.remove('hidden');
    } else if (currentStep === 1 || currentStep === TOTAL_STEPS) {
        // Hide navigation for first and last steps of main flow
        navigationContainer.classList.add('hidden');
    } else if (currentStep === 2) {
        // Step 2: Show only Previous button (no Next button)
        navigationContainer.classList.remove('hidden');
        if (prevBtn) {
            prevBtn.disabled = false;
            prevBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        if (nextBtn) {
            nextBtn.style.display = 'none';
        }
    } else {
        navigationContainer.classList.remove('hidden');

        // Show Next button for steps 3-6
        if (nextBtn) {
            nextBtn.style.display = 'inline-flex';
            const canProceed = canProceedFromCurrentStep();
            nextBtn.disabled = !canProceed;
            nextBtn.classList.toggle('opacity-50', !canProceed);
            nextBtn.classList.toggle('cursor-not-allowed', !canProceed);
        }

        if (prevBtn) {
            prevBtn.disabled = false;
            prevBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }

        // Update tab order to prioritize Next button
        updateTabOrder();
    }
}

// Create debounced version for input events (150ms delay)
const debouncedUpdateNavigation = debounce(updateNavigation, 150);

/**
 * Updates tab order to make Next button come immediately after form elements
 */
function updateTabOrder() {
    // Clear all existing custom tabindex values first
    clearTabOrder();

    const isFormStep = currentStep >= 3 && currentStep <= 5;

    if (isFormStep) {
        // Set proper tab order for the current step
        setFormElementTabOrder();
    }
}

/**
 * Clears all custom tabindex values to reset to natural order
 */
function clearTabOrder() {
    const allElements = document.querySelectorAll('[tabindex]');
    allElements.forEach(element => {
        const tabindex = element.getAttribute('tabindex');
        // Don't remove tabindex="-1" (explicitly hidden) or skip links
        if (tabindex !== '-1' && !element.closest('.sr-only')) {
            element.removeAttribute('tabindex');
        }
    });
}

/**
 * Sets proper tab order on form elements for the current step
 */
function setFormElementTabOrder() {
    let tabIndex = 1;

    // Get all interactive elements in the current step
    const stepElement = document.getElementById(`step${currentStep}`);
    if (!stepElement) return;

    // Get form elements that are actually visible and enabled
    const formElements = stepElement.querySelectorAll(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
    );

    // Filter out hidden elements (check visibility)
    const visibleFormElements = Array.from(formElements).filter(element => {
        return isElementVisible(element);
    });

    // Set tabindex for visible form elements
    visibleFormElements.forEach(element => {
        element.setAttribute('tabindex', tabIndex.toString());
        tabIndex++;
    });

    // Now set navigation buttons to come after all form elements
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');

    if (nextBtn && !nextBtn.disabled && nextBtn.style.display !== 'none') {
        nextBtn.setAttribute('tabindex', tabIndex.toString());
        tabIndex++;
    }

    if (prevBtn && !prevBtn.disabled && prevBtn.style.display !== 'none') {
        prevBtn.setAttribute('tabindex', tabIndex.toString());
    }

    // Set hidden buttons to not be tabbable
    setHiddenElementsUntabbable();
}

/**
 * Checks if an element is visible (not hidden by CSS)
 */
function isElementVisible(element) {
    // Check if element itself is hidden
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
    }

    // Check if any parent has .hidden class or is hidden
    let parent = element.parentElement;
    while (parent) {
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.display === 'none' ||
            parentStyle.visibility === 'hidden' ||
            parent.classList.contains('hidden')) {
            return false;
        }
        parent = parent.parentElement;
    }

    // Check if element is in a different step container than current step
    const stepContainer = element.closest('.step-container');
    if (stepContainer && stepContainer.id !== `step${currentStep}`) {
        return false;
    }

    return true;
}

/**
 * Sets hidden elements to be untabbable
 */
function setHiddenElementsUntabbable() {
    // Find all buttons and interactive elements across the entire document
    const allInteractiveElements = document.querySelectorAll(
        'button, input, select, textarea, a[href]'
    );

    allInteractiveElements.forEach(element => {
        // Skip skip links and elements that should always be accessible
        if (element.closest('.sr-only')) {
            return;
        }

        if (!isElementVisible(element)) {
            element.setAttribute('tabindex', '-1');
        } else {
            // If element is visible but was previously hidden, remove tabindex="-1"
            if (element.getAttribute('tabindex') === '-1') {
                element.removeAttribute('tabindex');
            }
        }
    });
}

/**
 * Checks if user can proceed from current step (wrapper for imported validation)
 */
function canProceedFromCurrentStep() {
    return validateCurrentStep(currentStep, appData).isValid;
}

/**
 * Moves to next step
 */
function nextStep() {
    const validation = validateCurrentStep(currentStep, appData);

    if (currentStep < TOTAL_STEPS && validation.isValid) {
        saveCurrentStepData();

        let nextStepNumber = currentStep + 1;

        // Skip due diligence step for update tickets
        if (appData.ticketType === 'update' && currentStep === 2) {
            nextStepNumber = 4; // Skip step 3 (due diligence)
        }

        // For story updates, skip steps 5 and 6 (go directly to final step)
        if (appData.reportType === 'story' && appData.ticketType === 'update' && currentStep === 4) {
            nextStepNumber = 7; // Skip to final step
        }

        // For story updates, if somehow on step 5, skip to final step
        if (appData.reportType === 'story' && appData.ticketType === 'update' && currentStep === 5) {
            nextStepNumber = 7;
        }

        // For story reports (new), skip step 6 (bug documentation)
        if (appData.reportType === 'story' && appData.ticketType === 'new' && currentStep === 5) {
            nextStepNumber = 7;
        }

        if (nextStepNumber === 7) {
            // Generate final output before showing final step
            if (appData.reportType === 'bug') {
                calculateScore(); // Only calculate score for bugs
            } else {
                generateFinalOutput(); // Generate story output directly
            }
        }

        if (currentStep === 6) {
            // Calculate score before showing final step (for bugs)
            calculateScore();
        }

        // Update UI based on ticket type when moving to bug documentation step
        if (nextStepNumber === 6) {
            updateBugDocumentationStep();
        }

        showStep(nextStepNumber);
    } else if (!validation.isValid) {
        // Show validation errors
        showValidationErrors(validation.errors);
    }
}

/**
 * Shows validation errors to the user
 */
function showValidationErrors(errors) {
    const errorMessage = errors.length === 1 ?
        errors[0] :
        `Please fix the following issues:\n• ${errors.join('\n• ')}`;

    showUserMessage(errorMessage, 'error');
}

/**
 * Moves to previous step without data reset
 */
function prevStep() {
    if (currentStep > 1) {
        saveCurrentStepData();
        showStep(currentStep - 1);
    }
}

/**
 * Saves data from current step
 */
function saveCurrentStepData() {
    switch (currentStep) {
        case 3: // Due diligence
            if (appData.ticketType === 'new') {
                appData.dueDiligence.checkedExistingTickets = document.getElementById('checkedExistingTickets').checked;
                appData.dueDiligence.reviewedDocumentation = document.getElementById('reviewedDocumentation').checked;
                appData.dueDiligence.checkedSlackDiscussions = document.getElementById('checkedSlackDiscussions').checked;
            }
            break;
        case 4: // Customer details
            // Get report source from radio buttons
            const reportSourceRadio = document.querySelector('input[name="reportSource"]:checked');
            appData.reportSource = reportSourceRadio ? reportSourceRadio.value : 'external';
            appData.isInternal = (appData.reportSource === 'internal');
            appData.customerName = document.getElementById('customerName').value;
            appData.monthlyARR = document.getElementById('monthlyARR').value;
            appData.planType = document.getElementById('planType').value;
            appData.customPlanText = document.getElementById('customPlanText').value;
            appData.customPlanScore = parseInt(document.getElementById('customPlanScore').value) || 1;
            appData.intercomURLs = collectURLValues('intercom');
            appData.slackURLs = collectURLValues('slack');
            appData.customerComment = editors.customerComment ? editors.customerComment.value() : document.getElementById('customerComment').value;
            break;
        case 5: // Impact assessment or Story documentation
            if (appData.reportType === 'story') {
                // Save story documentation fields
                appData.storyDescription = editors.storyDescription ? editors.storyDescription.value() : document.getElementById('storyDescription').value;
                appData.currentVsExpected = editors.currentVsExpected ? editors.currentVsExpected.value() : document.getElementById('currentVsExpected').value;
                appData.timelineContext = editors.timelineContext ? editors.timelineContext.value() : document.getElementById('timelineContext').value;
            } else {
                // Save bug impact assessment questions
                questions.forEach(question => {
                    const selectedOption = document.querySelector(`input[name="${question.id}"]:checked`);
                    if (selectedOption) {
                        appData.questionsAnswered[question.id] = selectedOption.value;
                    }
                });
            }
            break;
        case 6: // Bug documentation
            appData.bugSummary = editors.bugSummary ? editors.bugSummary.value() : document.getElementById('bugSummary').value;
            appData.stepsToReproduce = editors.stepsToReproduce ? editors.stepsToReproduce.value() : document.getElementById('stepsToReproduce').value;
            appData.expectedVsActual = editors.expectedVsActual ? editors.expectedVsActual.value() : document.getElementById('expectedVsActual').value;
            break;
    }
}

/**
 * Updates Step 5 content based on report type
 */
function updateStep5Content() {
    const questionsContainer = document.getElementById('questionsContainer');
    const storyContainer = document.getElementById('storyContainer');
    const step5Title = document.getElementById('step5Title');

    if (appData.reportType === 'story') {
        // Show story documentation, hide questions
        questionsContainer.classList.add('hidden');
        storyContainer.classList.remove('hidden');
        step5Title.textContent = 'Story Documentation';
    } else {
        // Show questions, hide story documentation
        questionsContainer.classList.remove('hidden');
        storyContainer.classList.add('hidden');
        step5Title.textContent = 'Impact Assessment';
    }
}

/**
 * Handles plan type dropdown change
 */
function handlePlanTypeChange(event) {
    const planType = event.target.value;
    const customPlanContainer = document.getElementById('customPlanContainer');
    const customPlanText = document.getElementById('customPlanText');

    if (planType === 'Custom') {
        customPlanContainer.classList.remove('hidden');
        if (customPlanText) {
            customPlanText.focus();
        }
    } else {
        customPlanContainer.classList.add('hidden');
        if (customPlanText) {
            customPlanText.value = ''; // Clear custom text when switching away
        }
    }

    // Update tab order when plan fields change
    setTimeout(() => {
        updateTabOrder();
    }, 10);
}

/**
 * Handles report source radio button change (External/Prospect/Internal)
 */
function handleReportSourceChange(event) {
    const reportSource = event.target.value;
    appData.reportSource = reportSource;

    const externalFields = document.getElementById('externalFields');
    const customerNameField = document.getElementById('customerName');
    const monthlyARRField = document.getElementById('monthlyARR');
    const planTypeField = document.getElementById('planType');
    const arrContainer = monthlyARRField?.parentElement;
    const planContainer = planTypeField?.parentElement;
    const commentLabel = document.querySelector('label[for="customerComment"]');
    const commentTextarea = document.getElementById('customerComment');

    // Update legacy isInternal flag for backward compatibility
    const internalCheckbox = document.getElementById('internalReport');
    if (internalCheckbox) {
        internalCheckbox.checked = (reportSource === 'internal');
    }
    appData.isInternal = (reportSource === 'internal');

    if (externalFields) {
        if (reportSource === 'internal') {
            // Internal: Hide all customer fields
            externalFields.classList.add('hidden');
            // Clear the fields when switching to internal
            if (customerNameField) customerNameField.value = '';
            if (monthlyARRField) monthlyARRField.value = '';

            // Update comment label for internal
            if (commentLabel) {
                if (appData.ticketType === 'update') {
                    commentLabel.innerHTML = 'Comment <span class="text-red-500">*</span>';
                } else {
                    commentLabel.textContent = 'Comment';
                }
            }
            if (commentTextarea) {
                commentTextarea.placeholder = 'Add context or notes...';
            }
        } else if (reportSource === 'prospect') {
            // Prospect: Show customer name, hide ARR and plan type
            externalFields.classList.remove('hidden');
            if (arrContainer) arrContainer.classList.add('hidden');
            if (planContainer) planContainer.classList.add('hidden');
            // Clear ARR and plan when switching to prospect
            if (monthlyARRField) monthlyARRField.value = '';
            if (planTypeField) planTypeField.value = '';

            // Update comment label for prospect
            if (commentLabel) {
                commentLabel.textContent = 'Customer Comment';
            }
            if (commentTextarea) {
                commentTextarea.placeholder = 'Paste relevant conversation or customer quote...';
            }
        } else {
            // External: Show all fields
            externalFields.classList.remove('hidden');
            if (arrContainer) arrContainer.classList.remove('hidden');
            if (planContainer) planContainer.classList.remove('hidden');

            // Restore customer comment label for external
            if (commentLabel) {
                commentLabel.textContent = 'Customer Comment';
            }
            if (commentTextarea) {
                commentTextarea.placeholder = 'Paste relevant conversation or customer quote...';
            }
        }
    }

    updateNavigation();

    // Update tab order when fields are shown/hidden
    setTimeout(() => {
        updateTabOrder();
    }, 10);
}

/**
 * Legacy handler for internal report checkbox toggle (backward compatibility)
 */
function handleInternalReportToggle(event) {
    // Redirect to new handler
    const newEvent = {
        target: {
            value: event.target.checked ? 'internal' : 'external'
        }
    };
    handleReportSourceChange(newEvent);
}

/**
 * Renders questions into a container with specified prefix for radio names/IDs
 * @param {string} containerId - The ID of the container element
 * @param {string} prefix - Prefix for radio button names and IDs (e.g., '' or 'quick_')
 * @param {Function} onChangeHandler - Optional change event handler for radio buttons
 */
function renderQuestions(containerId, prefix = '', onChangeHandler = null) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Questions container '${containerId}' not found`);
        return;
    }
    container.innerHTML = '';

    questions.forEach(question => {
        const card = document.createElement('div');
        card.className = 'bg-slate-50 dark:bg-slate-700 rounded-lg p-6 border border-slate-200 dark:border-slate-600';
        card.setAttribute('aria-labelledby', `${prefix}question-${question.id}-title`);

        const cardTitle = document.createElement('h3');
        cardTitle.className = 'text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200';
        cardTitle.id = `${prefix}question-${question.id}-title`;
        cardTitle.textContent = question.text;
        card.appendChild(cardTitle);

        const fieldset = document.createElement('fieldset');
        fieldset.setAttribute('aria-labelledby', `${prefix}question-${question.id}-title`);
        const optionsList = document.createElement('div');
        optionsList.className = 'space-y-3';

        question.options.forEach((option) => {
            const optionWrapper = document.createElement('div');
            optionWrapper.className = 'flex items-start';

            const input = document.createElement('input');
            input.className = 'h-4 w-4 text-sky-600 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 rounded mt-1';
            input.type = 'radio';
            input.id = `${prefix}${question.id}-${option.value}`;
            input.name = `${prefix}${question.id}`;
            input.value = option.value;
            input.dataset.score = option.score;

            if (onChangeHandler) {
                input.addEventListener('change', onChangeHandler);
            }

            const label = document.createElement('label');
            label.className = 'ml-3 block text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer';
            label.htmlFor = `${prefix}${question.id}-${option.value}`;
            label.textContent = option.label;

            optionWrapper.appendChild(input);
            optionWrapper.appendChild(label);
            optionsList.appendChild(optionWrapper);
        });

        fieldset.appendChild(optionsList);
        card.appendChild(fieldset);
        container.appendChild(card);
    });
}

function initQuestions() {
    renderQuestions('questionsContainer', '', updateNavigation);

    // Update tab order after questions are rendered
    setTimeout(() => {
        updateTabOrder();
    }, 10);
}

/**
 * Initializes EasyMDE editors for all textareas
 */
function initEasyMDE() {
    const textareaConfigs = [
        { id: 'customerComment', minHeight: '100px' },
        { id: 'bugSummary', minHeight: '150px' },
        { id: 'stepsToReproduce', minHeight: '150px' },
        { id: 'expectedVsActual', minHeight: '150px', initialValue: '**Expected:**\n\n**Actual:**\n\n' },
        { id: 'storyDescription', minHeight: '100px' },
        { id: 'currentVsExpected', minHeight: '150px', initialValue: '**Current:**\n\n**Expected:**\n\n' },
        { id: 'timelineContext', minHeight: '100px' }
    ];

    textareaConfigs.forEach(config => {
        const textarea = document.getElementById(config.id);
        if (textarea) {
            const editorConfig = {
                element: textarea,
                autofocus: false,
                autoDownloadFontAwesome: true,
                spellChecker: false,
                status: false,
                minHeight: config.minHeight,
                toolbar: [
                    'bold', 'italic', '|',
                    'heading-1', 'heading-2', '|',
                    'unordered-list', 'ordered-list', '|',
                    'link', 'code', '|',
                    'preview', 'side-by-side', 'fullscreen'
                ],
                shortcuts: {
                    'toggleBold': 'Cmd-B',
                    'toggleItalic': 'Cmd-I',
                    'toggleCodeBlock': 'Cmd-Alt-C',
                    'togglePreview': 'Cmd-P',
                    'toggleSideBySide': 'F9',
                    'toggleFullScreen': 'F11'
                }
            };

            // Set initial value if specified
            if (config.initialValue) {
                editorConfig.initialValue = config.initialValue;
            }

            // Create the editor
            const editor = new EasyMDE(editorConfig);
            editors[config.id] = editor;

            // Add change listener for form validation
            editor.codemirror.on('change', () => {
                updateNavigation();
            });
        }
    });
}

/**
 * Calculates the bug score and generates the final output
 */
function calculateScore() {
    const scoreResult = calculateBugScore(appData);

    // Get priority based on base score and multiplier
    const priority = getPriority(scoreResult.baseScore, scoreResult.multiplier);

    // Calculate final displayed score with display multiplier
    const displayedScore = Math.round(scoreResult.finalScore * priority.displayMultiplier);

    appData.calculatedScore = displayedScore;
    appData.baseScore = scoreResult.baseScore;
    appData.multiplier = scoreResult.multiplier;
    appData.priority = priority;

    // Generate the final output
    generateFinalOutput();
}


/**
 * Generates the final ticket template
 */
function generateFinalOutput() {
    // Get sanitized data
    const sanitized = sanitizeAppData(appData);

    // Determine customer info header based on report source
    let customerInfoHeader;

    if (appData.reportSource === 'internal' || appData.isInternal) {
        customerInfoHeader = '## Internal Report';
    } else if (appData.reportSource === 'prospect') {
        const customerName = sanitized.customerName || 'N/A';
        customerInfoHeader = `## ${customerName} (Prospect)`;
    } else {
        const customerName = sanitized.customerName || 'N/A';
        let plan = 'N/A';

        // Use the planType dropdown from customer details
        if (appData.planType) {
            if (appData.planType === 'Custom' && sanitized.customPlanText) {
                plan = sanitized.customPlanText;
            } else if (appData.planType !== 'Custom') {
                plan = appData.planType; // planType from dropdown is safe
            }
        }

        const annualARR = parseFloat(appData.monthlyARR || 0) * 12;
        customerInfoHeader = `## ${customerName}, Plan: ${plan}, ARR: $${formatCurrency(annualARR)}`;
    }

    const intercomLinks = formatURLsAsJIRALinks(sanitized.intercomURLs, 'intercom');
    const slackLinks = formatURLsAsJIRALinks(sanitized.slackURLs, 'slack');
    const customerComment = sanitized.customerComment || '';

    // Create template based on report type
    let template;

    if (appData.reportType === 'story') {
        // Story template
        if (appData.ticketType === 'update') {
            // Story update: Only customer details + comment
            template = `${customerInfoHeader}
**Intercom Links:** ${intercomLinks}
**Slack Links:** ${slackLinks}`;
            if (customerComment.trim() !== '') {
                template += `\n**Comment:** ${customerComment}`;
            }
        } else {
            // New story: Full story template
            template = `## Description
${sanitized.storyDescription}

## Current vs Expected Functionality
${sanitized.currentVsExpected}

## Timeline & Context
${sanitized.timelineContext}

${customerInfoHeader}
**Intercom Links:** ${intercomLinks}
**Slack Links:** ${slackLinks}`;
            if (customerComment.trim() !== '') {
                template += `\n**Comment:** ${customerComment}`;
            }
        }
    } else {
        // Bug template (existing logic)
        // Generate Q&A section
        let qaSection = '';
        questions.forEach(question => {
            const selectedValue = appData.questionsAnswered[question.id];
            if (selectedValue) {
                const option = question.options.find(opt => opt.value === selectedValue);
                if (option) {
                    qaSection += `**${question.text}** ${option.label}\n`;
                }
            }
        });

        if (appData.ticketType === 'update') {
            // For bug update tickets: Customer details + Questionnaire + Summary only
            template = `${customerInfoHeader}
**Intercom Links:** ${intercomLinks}
**Slack Links:** ${slackLinks}`;
            if (customerComment.trim() !== '') {
                template += `\n**Comment:** ${customerComment}`;
            }
            template += `

${qaSection}**Final Score:** ${appData.calculatedScore}
**Priority: ${appData.priority.text}**

## Summary
${sanitized.bugSummary}`;
        } else {
            // For new bug tickets: Full template with all fields
            template = `## Summary
${sanitized.bugSummary}

## Steps to Reproduce
${sanitized.stepsToReproduce}

## Expected vs Actual Behavior
${sanitized.expectedVsActual}

${customerInfoHeader}
**Intercom Links:** ${intercomLinks}
**Slack Links:** ${slackLinks}`;
            if (customerComment.trim() !== '') {
                template += `\n**Comment:** ${customerComment}`;
            }
            template += `

${qaSection}**Final Score:** ${appData.calculatedScore}
**Priority: ${appData.priority.text}**`;
        }
    }

    // Add JIRA callout for images
    template += '\n\n---\n**Note:** Paste any relevant images or videos directly into the JIRA ticket.';

    // Display the template in the UI
    updateFinalStepUI(template);
}

/**
 * Updates the final step UI with calculated results
 */
function updateFinalStepUI(template) {
    const scoreValueEl = document.getElementById('scoreValue');
    const priorityTextEl = document.getElementById('priorityText');
    const priorityAlertEl = document.getElementById('priorityAlert');
    const progressBarEl = document.getElementById('scoreProgressBar');
    const copyTextEl = document.getElementById('copyText');

    if (copyTextEl) copyTextEl.value = template;

    // Update template title based on report type
    const templateTitle = document.getElementById('templateTitle');
    if (templateTitle) {
        if (appData.reportType === 'story') {
            templateTitle.textContent = 'JIRA Story Template';
        } else {
            templateTitle.textContent = 'JIRA Bug Template';
        }
    }

    if (appData.reportType === 'story') {
        // For stories, hide scoring elements
        if (priorityAlertEl) {
            priorityAlertEl.style.display = 'none';
        }
        const scoreContainer = progressBarEl?.parentElement?.parentElement;
        if (scoreContainer) {
            scoreContainer.style.display = 'none';
        }
    } else {
        // For bugs, show scoring elements
        if (scoreValueEl) scoreValueEl.textContent = appData.calculatedScore;
        if (priorityTextEl) priorityTextEl.textContent = appData.priority.text;

        if (priorityAlertEl) {
            priorityAlertEl.className = appData.priority.classList;
            priorityAlertEl.style.display = 'block';
        }

        const scoreContainer = progressBarEl?.parentElement?.parentElement;
        if (scoreContainer) {
            scoreContainer.style.display = 'block';
        }

        if (progressBarEl) {
            progressBarEl.style.width = '0%';
            progressBarEl.setAttribute('aria-valuenow', '0');

            setTimeout(() => {
                const progressPercent = Math.min(appData.calculatedScore / MAX_SCORE_FOR_DISPLAY * 100, 100);
                progressBarEl.style.width = progressPercent + '%';
                progressBarEl.setAttribute('aria-valuenow', progressPercent.toFixed(0));
            }, 50);
        }
    }
}


/**
 * Copies the content to clipboard
 */
function copyToClipboard() {
    const copyText = document.getElementById('copyText');
    if (!copyText) return;

    const textToCopy = copyText.value;

    copyText.select();
    copyText.setSelectionRange(0, 99999);

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showCopyFeedback();
        }).catch(err => {
            console.warn('Async clipboard copy failed, falling back.', err);
            fallbackCopyTextToClipboard(textToCopy);
        });
    } else {
        fallbackCopyTextToClipboard(textToCopy);
    }
}

/**
 * Fallback method to copy text to clipboard
 */
function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopyFeedback();
        } else {
            console.error('Fallback copy was unsuccessful');
        }
    } catch (err) {
        console.error('Fallback copy error', err);
    }

    document.body.removeChild(textArea);
}

/**
 * Shows visual feedback after copying
 */
function showCopyFeedback() {
    const copyBtn = document.getElementById('copyBtn');
    if (!copyBtn) return;
    
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = '✅ Copied!';
    copyBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
    copyBtn.classList.remove('bg-sky-500', 'hover:bg-sky-600');

    setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
        copyBtn.classList.add('bg-sky-500', 'hover:bg-sky-600');
    }, 2000);
}

/**
 * Starts a new report by resetting all data and going to step 1
 */
function startNewReport() {
    // Reset all application data
    Object.assign(appData, {
        reportType: 'bug',
        ticketType: 'new',
        isQuickCalc: false,
        isInternal: false,
        reportSource: 'external',
        customerName: '',
        monthlyARR: '',
        planType: '',
        customPlanText: '',
        customPlanScore: 1,
        intercomURLs: [''],
        slackURLs: [''],
        customerComment: '',
        dueDiligence: {
            checkedExistingTickets: false,
            reviewedDocumentation: false,
            checkedSlackDiscussions: false
        },
        questionsAnswered: {},
        // Bug-specific fields
        bugSummary: '',
        stepsToReproduce: '',
        expectedVsActual: '',
        calculatedScore: 0,
        priority: '',
        // Story-specific fields
        storyDescription: '',
        currentVsExpected: '',
        timelineContext: ''
    });

    // Properly destroy all EasyMDE editor instances to prevent memory leaks
    Object.keys(editors).forEach(editorKey => {
        if (editors[editorKey]) {
            editors[editorKey].toTextArea();  // Destroy the editor instance
            delete editors[editorKey];
        }
    });

    // Reset all form fields
    document.querySelectorAll('input[type="text"], input[type="number"], textarea, select').forEach(input => {
        input.value = '';
    });

    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
        input.checked = false;
    });

    // Reset report source radio buttons to default (external)
    const reportSourceExternal = document.getElementById('reportSourceExternal');
    if (reportSourceExternal) {
        reportSourceExternal.checked = true;
    }
    const quickReportSourceExternal = document.getElementById('quickReportSourceExternal');
    if (quickReportSourceExternal) {
        quickReportSourceExternal.checked = true;
    }

    // Show external fields again (including ARR and Plan Type)
    const externalFields = document.getElementById('externalFields');
    if (externalFields) {
        externalFields.classList.remove('hidden');
    }

    // Ensure ARR and Plan Type containers are visible (they might be hidden from prospect selection)
    const monthlyARRField = document.getElementById('monthlyARR');
    const planTypeField = document.getElementById('planType');
    if (monthlyARRField && monthlyARRField.parentElement) {
        monthlyARRField.parentElement.classList.remove('hidden');
    }
    if (planTypeField && planTypeField.parentElement) {
        planTypeField.parentElement.classList.remove('hidden');
    }

    // Hide custom plan container
    const customPlanContainer = document.getElementById('customPlanContainer');
    if (customPlanContainer) {
        customPlanContainer.classList.add('hidden');
    }

    // Reset quick calculator specific fields
    const quickExternalFields = document.getElementById('quickExternalFields');
    if (quickExternalFields) {
        quickExternalFields.classList.remove('hidden');
    }

    const quickCustomPlanContainer = document.getElementById('quickCustomPlanContainer');
    if (quickCustomPlanContainer) {
        quickCustomPlanContainer.classList.add('hidden');
    }

    const quickPlanScoreContext = document.getElementById('quickPlanScoreContext');
    if (quickPlanScoreContext) {
        quickPlanScoreContext.classList.add('hidden');
    }

    // Reset dynamic URL fields to single field
    const intercomContainer = document.getElementById('intercomURLsContainer');
    if (intercomContainer) {
        intercomContainer.innerHTML = `
            <div class="intercom-url-field mb-3">
                <div class="flex gap-2">
                    <input type="text" id="intercomURL0" placeholder="Enter Intercom URL" class="flex-1 px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:text-white">
                    <button type="button" class="remove-intercom-btn hidden bg-red-500 hover:bg-red-600 text-white px-3 py-2.5 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500">Remove</button>
                </div>
            </div>
        `;
    }

    const slackContainer = document.getElementById('slackURLsContainer');
    if (slackContainer) {
        slackContainer.innerHTML = `
            <div class="slack-url-field mb-3">
                <div class="flex gap-2">
                    <input type="text" id="slackURL0" placeholder="Enter Slack URL" class="flex-1 px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:text-white">
                    <button type="button" class="remove-slack-btn hidden bg-red-500 hover:bg-red-600 text-white px-3 py-2.5 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500">Remove</button>
                </div>
            </div>
        `;
    }

    // Go back to step 1
    showStep(1);
}

/**
 * Checks if we should show reset confirmation when going back
 */
function shouldShowResetConfirmation() {
    // Only show confirmation when navigating back to Due Diligence (step 3) or Customer Information (step 4)
    // from Impact Assessment, Documentation, or Final Report (steps 5+)
    // and when there's actual data that would be lost
    if ((currentStep >= 5) && hasFormData()) {
        return true;
    }
    return false;
}

/**
 * Checks if there's any form data that would be lost
 */
function hasFormData() {
    // Check if any important fields have data
    const fieldsToCheck = [
        'customerName', 'monthlyARR', 'planType', 'customPlanText',
        'bugSummary', 'stepsToReproduce', 'expectedVsActual',
        'storyDescription', 'currentVsExpected', 'timelineContext'
    ];

    for (let fieldId of fieldsToCheck) {
        const field = document.getElementById(fieldId);
        if (field && field.value && field.value.trim()) {
            return true;
        }
    }

    // Check if any questionnaire questions are answered
    if (Object.keys(appData.questionsAnswered).length > 0) {
        return true;
    }

    // Check if any due diligence checkboxes are checked
    if (appData.dueDiligence.checkedExistingTickets ||
        appData.dueDiligence.reviewedDocumentation ||
        appData.dueDiligence.checkedSlackDiscussions) {
        return true;
    }

    return false;
}

/**
 * Shows the reset confirmation modal
 */
function showResetConfirmationModal() {
    const modal = document.getElementById('confirmationModal');
    if (modal) {
        modal.classList.remove('hidden');
        // Focus on the cancel button by default
        const cancelBtn = document.getElementById('cancelResetBtn');
        if (cancelBtn) {
            cancelBtn.focus();
        }
    }
}

/**
 * Hides the reset confirmation modal
 */
function hideResetConfirmationModal() {
    const modal = document.getElementById('confirmationModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Sets focus to the first interactive element in the step
 */
function focusFirstElement(stepNumber) {
    setTimeout(() => {
        const stepElement = document.getElementById(`step${stepNumber}`);
        if (stepElement) {
            const firstInput = stepElement.querySelector('input, button, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }
    }, 100);
}

/**
 * Announces step changes to screen readers
 */
function announceStepChange(stepNumber) {
    const announcements = document.getElementById('announcements');
    if (announcements) {
        const stepTitle = STEP_TITLES[stepNumber - 1];
        announcements.textContent = `Step ${stepNumber} of ${TOTAL_STEPS}: ${stepTitle}`;
    }
}

// Add input event listeners for real-time validation
document.addEventListener('DOMContentLoaded', function() {
    // Wait for elements to be available, then add event listeners
    setTimeout(() => {
        const customerNameInput = document.getElementById('customerName');
        const bugSummaryInput = document.getElementById('bugSummary');
        const stepsToReproduceInput = document.getElementById('stepsToReproduce');
        const expectedVsActualInput = document.getElementById('expectedVsActual');
        
        if (customerNameInput) {
            customerNameInput.addEventListener('input', debouncedUpdateNavigation);
        }

        // Add due diligence checkboxes validation
        const checkedExistingTickets = document.getElementById('checkedExistingTickets');
        const reviewedDocumentation = document.getElementById('reviewedDocumentation');
        const checkedSlackDiscussions = document.getElementById('checkedSlackDiscussions');

        if (checkedExistingTickets) {
            checkedExistingTickets.addEventListener('change', updateNavigation);
        }
        if (reviewedDocumentation) {
            reviewedDocumentation.addEventListener('change', updateNavigation);
        }
        if (checkedSlackDiscussions) {
            checkedSlackDiscussions.addEventListener('change', updateNavigation);
        }

        // Add monthly ARR validation
        const monthlyARRInput = document.getElementById('monthlyARR');
        if (monthlyARRInput) {
            monthlyARRInput.addEventListener('input', debouncedUpdateNavigation);
        }

        // Add plan type validation
        const planTypeSelect = document.getElementById('planType');
        const customPlanInput = document.getElementById('customPlanText');
        const customScoreInput = document.getElementById('customPlanScore');

        if (planTypeSelect) {
            planTypeSelect.addEventListener('change', updateNavigation);
        }

        if (customPlanInput) {
            customPlanInput.addEventListener('input', debouncedUpdateNavigation);
        }

        if (customScoreInput) {
            customScoreInput.addEventListener('input', function() {
                validateCustomScore(this);
                debouncedUpdateNavigation();
            });
            customScoreInput.addEventListener('focus', showPlanScoreContext);
            customScoreInput.addEventListener('blur', hidePlanScoreContext);
        }

        if (bugSummaryInput) {
            bugSummaryInput.addEventListener('input', debouncedUpdateNavigation);
        }

        if (stepsToReproduceInput) {
            stepsToReproduceInput.addEventListener('input', debouncedUpdateNavigation);
        }

        if (expectedVsActualInput) {
            expectedVsActualInput.addEventListener('input', debouncedUpdateNavigation);
        }
        
        // Image paste functionality is now handled in initEasyMDE()

        // Add input event listeners for story fields
        addStoryFieldListeners();
    }, 100);
});

/**
 * Generic function to handle dynamic field groups (Intercom/Slack URLs)
 */
function initDynamicFieldGroup(config) {
    let fieldCount = 1;
    const {
        addButtonId,
        containerId,
        fieldClass,
        removeBtnClass,
        fieldIdPrefix,
        placeholder
    } = config;

    // Add field button
    document.getElementById(addButtonId).addEventListener('click', function() {
        const container = document.getElementById(containerId);
        const fieldDiv = document.createElement('div');
        fieldDiv.className = `${fieldClass} mb-3`;
        fieldDiv.innerHTML = `
            <div class="flex gap-2">
                <input type="text" id="${fieldIdPrefix}${fieldCount}" placeholder="${placeholder}" class="flex-1 px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:text-white">
                <button type="button" class="${removeBtnClass} bg-red-500 hover:bg-red-600 text-white px-3 py-2.5 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500">Remove</button>
            </div>
        `;
        container.appendChild(fieldDiv);
        fieldCount++;
        updateRemoveButtonsVisibility();
        updateNavigation();
    });

    // Handle remove buttons
    document.getElementById(containerId).addEventListener('click', function(e) {
        if (e.target.classList.contains(removeBtnClass)) {
            e.target.closest(`.${fieldClass}`).remove();
            updateRemoveButtonsVisibility();
            updateNavigation();
        }
    });

    // Show/hide remove buttons based on number of fields
    function updateRemoveButtonsVisibility() {
        const fields = document.querySelectorAll(`.${fieldClass}`);
        fields.forEach((field) => {
            const removeBtn = field.querySelector(`.${removeBtnClass}`);
            if (fields.length > 1) {
                removeBtn.classList.remove('hidden');
            } else {
                removeBtn.classList.add('hidden');
            }
        });
    }
}

/**
 * Initializes dynamic URL field functionality
 */
function initDynamicURLFields() {
    // Initialize Intercom URL fields
    initDynamicFieldGroup({
        addButtonId: 'addIntercomURL',
        containerId: 'intercomURLsContainer',
        fieldClass: 'intercom-url-field',
        removeBtnClass: 'remove-intercom-btn',
        fieldIdPrefix: 'intercomURL',
        placeholder: 'Enter Intercom URL'
    });

    // Initialize Slack URL fields
    initDynamicFieldGroup({
        addButtonId: 'addSlackURL',
        containerId: 'slackURLsContainer',
        fieldClass: 'slack-url-field',
        removeBtnClass: 'remove-slack-btn',
        fieldIdPrefix: 'slackURL',
        placeholder: 'Enter Slack URL'
    });
}

/**
 * Collects all URL values from dynamic fields
 */
function collectURLValues(type) {
    const urls = [];
    const fields = document.querySelectorAll(`#${type}URLsContainer input[type="text"]`);
    fields.forEach(field => {
        const value = field.value.trim();
        if (value) {
            urls.push(value);
        }
    });
    return urls.length > 0 ? urls : [''];
}

/**
 * Formats URLs as JIRA-compatible links
 */
function formatURLsAsJIRALinks(urls, type) {
    if (!urls || urls.length === 0 || (urls.length === 1 && !urls[0])) {
        return 'N/A';
    }

    const validUrls = urls.filter(url => url && url.trim());
    if (validUrls.length === 0) {
        return 'N/A';
    }

    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
    return validUrls.map((url, index) => {
        const linkText = index === 0 ? `${capitalizedType} Link` : `${capitalizedType} Link ${index + 1}`;
        return `[${linkText}](${url})`;
    }).join(' | ');
}

/**
 * Initializes tooltip functionality
 */
function initTooltips() {
    const tooltipContent = {
        'existing-tickets': 'Search your ticketing system (JIRA, etc.) for similar issues, error messages, or feature requests. Look for keywords related to your problem and check if there are existing solutions or workarounds.',
        'documentation': 'Check both public and internal documentation for relevant information:<br><br>' +
                        '• <a href="https://help.transifex.com/en/" target="_blank">Help Center</a> - Public documentation and guides<br>' +
                        '• <a href="https://xtm-cloud.atlassian.net/wiki/spaces/IKB/pages/4168941583/Help+Center" target="_blank">Internal Docs</a> - Internal knowledge base<br><br>' +
                        'Pay special attention to new/actively developed features or old/obscure/unfamiliar functionality.',
        'slack-discussions': 'Search relevant Slack channels for discussions about your issue. Look for recent conversations, solutions shared by teammates, or additional context that might help resolve the problem.'
    };

    document.addEventListener('click', function(e) {
        if (e.target.closest('[data-tooltip]')) {
            e.preventDefault();
            const button = e.target.closest('[data-tooltip]');
            const tooltipType = button.getAttribute('data-tooltip');
            const content = tooltipContent[tooltipType];

            if (content) {
                showTooltip(button, content);
            }
        } else {
            // Hide any visible tooltips when clicking elsewhere
            hideAllTooltips();
        }
    });
}

/**
 * Shows a tooltip with the given content
 */
function showTooltip(button, content) {
    // Hide any existing tooltips first
    hideAllTooltips();

    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.innerHTML = content;

    // Position the tooltip
    document.body.appendChild(tooltip);

    const buttonRect = button.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Position to the right of the button, vertically centered
    let left = buttonRect.right + 12;
    let top = buttonRect.top + (buttonRect.height / 2) - (tooltipRect.height / 2);

    // If tooltip would go off the right edge, position it to the left of the button
    if (left + tooltipRect.width > window.innerWidth - 8) {
        left = buttonRect.left - tooltipRect.width - 12;
    }

    // Adjust vertical position if tooltip would go off screen
    if (top < 8) top = 8;
    if (top + tooltipRect.height > window.innerHeight - 8) {
        top = window.innerHeight - tooltipRect.height - 8;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';

    // Show tooltip with animation
    setTimeout(() => {
        tooltip.classList.add('show');
    }, 10);

    // Mark this tooltip for cleanup
    tooltip.setAttribute('data-active-tooltip', 'true');
}

/**
 * Hides all visible tooltips
 */
function hideAllTooltips() {
    const tooltips = document.querySelectorAll('[data-active-tooltip]');
    tooltips.forEach(tooltip => {
        tooltip.classList.remove('show');
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        }, 200);
    });
}

/**
 * Validates and constrains custom plan score input to 1-5 range
 */
function validateCustomScore(input) {
    let value = parseInt(input.value);

    // Remove any non-numeric characters
    input.value = input.value.replace(/[^0-9]/g, '');

    // Parse the cleaned value
    value = parseInt(input.value);

    // Enforce 1-5 range
    if (!isNaN(value)) {
        if (value < 1) {
            input.value = '1';
        } else if (value > 5) {
            input.value = '5';
        }
    }

    // If empty or invalid, clear the field
    if (isNaN(value) || input.value === '') {
        input.value = '';
    }
}

/**
 * Shows plan score context when custom score field is focused
 */
function showPlanScoreContext() {
    const contextDiv = document.getElementById('planScoreContext');
    if (contextDiv) {
        contextDiv.classList.remove('hidden');
    }
}

/**
 * Hides plan score context when custom score field loses focus
 */
function hidePlanScoreContext() {
    const contextDiv = document.getElementById('planScoreContext');
    if (contextDiv) {
        // Add a small delay to allow clicking on the context without it disappearing
        setTimeout(() => {
            contextDiv.classList.add('hidden');
        }, 100);
    }
}

/**
 * Adds input event listeners for story fields
 */
function addStoryFieldListeners() {
    const storyFields = ['storyDescription', 'currentVsExpected', 'timelineContext', 'customerComment'];

    storyFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', debouncedUpdateNavigation);
        }
    });
}


/**
 * Shows a user message with appropriate styling
 */
function showUserMessage(message, type = 'info') {
    // Remove any existing messages
    const existingMessage = document.getElementById('user-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.id = 'user-message';
    messageDiv.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 transform translate-x-full`;

    // Set styling based on type
    if (type === 'success') {
        messageDiv.className += ' bg-green-100 border border-green-400 text-green-700';
    } else if (type === 'error') {
        messageDiv.className += ' bg-red-100 border border-red-400 text-red-700';
    } else {
        messageDiv.className += ' bg-blue-100 border border-blue-400 text-blue-700';
    }

    messageDiv.textContent = message;

    // Add to page
    document.body.appendChild(messageDiv);

    // Animate in
    setTimeout(() => {
        messageDiv.classList.remove('translate-x-full');
    }, 10);

    // Remove after delay
    setTimeout(() => {
        messageDiv.classList.add('translate-x-full');
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 300);
    }, 3000);
}

/**
 * Updates the bug documentation step based on ticket type
 */
function updateBugDocumentationStep() {
    const stepsToReproduceDiv = document.getElementById('stepsToReproduce').closest('div');
    const expectedVsActualDiv = document.getElementById('expectedVsActual').closest('div');
    
    if (appData.ticketType === 'update') {
        // Hide Steps to Reproduce and Expected vs Actual for update tickets
        if (stepsToReproduceDiv) stepsToReproduceDiv.classList.add('hidden');
        if (expectedVsActualDiv) expectedVsActualDiv.classList.add('hidden');
    } else {
        // Show all fields for new tickets
        if (stepsToReproduceDiv) stepsToReproduceDiv.classList.remove('hidden');
        if (expectedVsActualDiv) expectedVsActualDiv.classList.remove('hidden');
    }

    // Update tab order after changing field visibility
    setTimeout(() => {
        updateTabOrder();
    }, 10);
}

// =============================================================================
// QUICK CALCULATOR FUNCTIONS
// =============================================================================

/**
 * Initializes the quick calculator step
 */
function initializeQuickCalculatorStep() {
    // Populate questions
    populateQuickCalculatorQuestions();

    // Set up event listeners for report source radio buttons
    const quickReportSourceRadios = document.querySelectorAll('input[name="quickReportSource"]');
    const quickExternalFields = document.getElementById('quickExternalFields');
    const quickInternalReport = document.getElementById('quickInternalReport');

    quickReportSourceRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const reportSource = this.value;
            // Update legacy checkbox for backward compatibility
            if (quickInternalReport) {
                quickInternalReport.checked = (reportSource === 'internal');
            }
            // Show/hide external fields based on report source
            if (quickExternalFields) {
                // Internal and Prospect hide the plan type fields
                if (reportSource === 'external') {
                    quickExternalFields.classList.remove('hidden');
                } else {
                    quickExternalFields.classList.add('hidden');
                }
            }
        });
    });

    // Set up plan type dropdown
    const quickPlanType = document.getElementById('quickPlanType');
    const quickCustomPlanContainer = document.getElementById('quickCustomPlanContainer');
    const quickPlanScoreContext = document.getElementById('quickPlanScoreContext');

    if (quickPlanType) {
        quickPlanType.addEventListener('change', function() {
            if (quickCustomPlanContainer && quickPlanScoreContext) {
                if (this.value === 'Custom') {
                    quickCustomPlanContainer.classList.remove('hidden');
                    quickPlanScoreContext.classList.remove('hidden');
                } else {
                    quickCustomPlanContainer.classList.add('hidden');
                    quickPlanScoreContext.classList.add('hidden');
                }
            }
        });
    }

    // Add Calculate Score button
    addQuickCalculatorButton();
}

/**
 * Populates the quick calculator questions
 */
function populateQuickCalculatorQuestions() {
    renderQuestions('quickQuestionsContainer', 'quick_', null);
}

/**
 * Adds the Calculate Score button to the quick calculator step
 */
function addQuickCalculatorButton() {
    const container = document.getElementById('quickQuestionsContainer');
    if (!container) return;

    // Check if button already exists
    const existingButton = document.getElementById('quickCalculateBtn');
    if (existingButton) return;

    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'mt-8 text-center';

    const calculateBtn = document.createElement('button');
    calculateBtn.id = 'quickCalculateBtn';
    calculateBtn.className = 'bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-8 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-purple-500 transition duration-150 ease-in-out text-lg';
    calculateBtn.textContent = '🧮 Calculate Score';

    calculateBtn.addEventListener('click', function() {
        if (validateQuickCalculatorStep()) {
            saveQuickCalculatorData();
            calculateQuickScore();
            showStep(9);
        }
    });

    buttonDiv.appendChild(calculateBtn);
    container.parentNode.appendChild(buttonDiv);
}

/**
 * Validates the quick calculator step
 */
function validateQuickCalculatorStep() {
    const errors = [];

    // Get report source from radio buttons
    const quickReportSourceRadio = document.querySelector('input[name="quickReportSource"]:checked');
    const reportSource = quickReportSourceRadio ? quickReportSourceRadio.value : 'external';

    // Only require plan type for external customers (not prospects or internal)
    if (reportSource === 'external') {
        const planType = document.getElementById('quickPlanType')?.value;
        if (!planType) {
            errors.push('Please select a plan type');
        }

        if (planType === 'Custom') {
            const customPlanText = document.getElementById('quickCustomPlanText')?.value;
            const customPlanScore = document.getElementById('quickCustomPlanScore')?.value;

            if (!customPlanText) {
                errors.push('Please enter custom plan type');
            }
            if (!customPlanScore) {
                errors.push('Please enter custom plan score');
            }
        }
    }

    // Check if all questions are answered
    questions.forEach(question => {
        const checkedOption = document.querySelector(`input[name="quick_${question.id}"]:checked`);
        if (!checkedOption) {
            errors.push(`Please answer: ${question.text}`);
        }
    });

    if (errors.length > 0) {
        showValidationErrors(errors);
        return false;
    }

    return true;
}

/**
 * Saves quick calculator data to appData
 */
function saveQuickCalculatorData() {
    // Get report source from radio buttons
    const quickReportSourceRadio = document.querySelector('input[name="quickReportSource"]:checked');
    appData.reportSource = quickReportSourceRadio ? quickReportSourceRadio.value : 'external';
    appData.isInternal = (appData.reportSource === 'internal');

    // Only save plan type for external customers
    if (appData.reportSource === 'external') {
        appData.planType = document.getElementById('quickPlanType')?.value || '';

        if (appData.planType === 'Custom') {
            appData.customPlanText = document.getElementById('quickCustomPlanText')?.value || '';
            appData.customPlanScore = parseInt(document.getElementById('quickCustomPlanScore')?.value) || 1;
        }
    } else {
        // Clear plan type for internal and prospect
        appData.planType = '';
    }

    // Save question answers
    appData.questionsAnswered = {};
    questions.forEach(question => {
        const checkedOption = document.querySelector(`input[name="quick_${question.id}"]:checked`);
        if (checkedOption) {
            appData.questionsAnswered[question.id] = checkedOption.value;
        }
    });
}

/**
 * Calculates quick score and generates output
 */
function calculateQuickScore() {
    const scoreResult = calculateBugScore(appData);

    // Get priority based on base score and multiplier
    const priority = getPriority(scoreResult.baseScore, scoreResult.multiplier);

    // Calculate final displayed score with display multiplier
    const displayedScore = Math.round(scoreResult.finalScore * priority.displayMultiplier);

    appData.calculatedScore = displayedScore;
    appData.baseScore = scoreResult.baseScore;
    appData.multiplier = scoreResult.multiplier;
    appData.priority = priority;

    // Generate quick calculator output
    generateQuickCalculatorOutput();
}

/**
 * Generates the quick calculator output
 */
function generateQuickCalculatorOutput() {
    const sanitized = {
        questionsAnswered: sanitizeInput(JSON.stringify(appData.questionsAnswered))
    };

    // Build questionnaire results
    let questionnaireResults = '';

    questions.forEach(question => {
        const userAnswer = appData.questionsAnswered[question.id];
        if (userAnswer) {
            const selectedOption = question.options.find(opt => opt.value === userAnswer);
            if (selectedOption) {
                questionnaireResults += `**${question.text}** ${selectedOption.label}\n`;
            }
        }
    });

    questionnaireResults += `**Final Score:** ${appData.calculatedScore}\n`;
    questionnaireResults += `**Priority: ${appData.priority.text}**`;

    // Update the UI
    updateQuickCalculatorResults(questionnaireResults);
}

/**
 * Updates the quick calculator results UI
 */
function updateQuickCalculatorResults(template) {
    // Update score and priority display
    const quickScoreValue = document.getElementById('quickScoreValue');
    const quickPriorityText = document.getElementById('quickPriorityText');
    const quickPriorityAlert = document.getElementById('quickPriorityAlert');
    const quickScoreProgressBar = document.getElementById('quickScoreProgressBar');
    const quickCopyText = document.getElementById('quickCopyText');

    // Update individual elements like main flow
    if (quickScoreValue) quickScoreValue.textContent = appData.calculatedScore;
    if (quickPriorityText) quickPriorityText.textContent = appData.priority.text;

    // Apply priority styling to alert container (like main flow)
    if (quickPriorityAlert) {
        quickPriorityAlert.className = appData.priority.classList;
    }

    // Update progress bar
    if (quickScoreProgressBar) {
        const progressPercent = Math.min((appData.calculatedScore / MAX_SCORE_FOR_DISPLAY) * 100, 100);
        setTimeout(() => {
            quickScoreProgressBar.style.width = `${progressPercent}%`;
            quickScoreProgressBar.setAttribute('aria-valuenow', progressPercent.toString());
        }, 50);
    }

    // Update template text
    if (quickCopyText) {
        quickCopyText.value = template;
    }

    // Set up copy and new report buttons
    setupQuickCalculatorButtons();
}

/**
 * Sets up the quick calculator buttons
 */
function setupQuickCalculatorButtons() {
    const quickCopyBtn = document.getElementById('quickCopyBtn');
    const quickStartNewBtn = document.getElementById('quickStartNewBtn');

    if (quickCopyBtn) {
        quickCopyBtn.addEventListener('click', function() {
            const quickCopyText = document.getElementById('quickCopyText');
            if (quickCopyText) {
                quickCopyText.select();
                quickCopyText.setSelectionRange(0, 99999);
                navigator.clipboard.writeText(quickCopyText.value).then(() => {
                    showUserMessage('Copied to clipboard!', 'success');
                }).catch(() => {
                    showUserMessage('Failed to copy to clipboard', 'error');
                });
            }
        });
    }

    if (quickStartNewBtn) {
        quickStartNewBtn.addEventListener('click', function() {
            startNewReport();
        });
    }
}

