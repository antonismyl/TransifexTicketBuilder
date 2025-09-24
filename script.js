// =============================================================================
// CONSTANTS AND CONFIGURATION
// =============================================================================

// Questions data for impact assessment
const questions = [
    {
        id: 'importance',
        text: 'What\'s the impact on the customer?',
        options: [
            { value: 'A', label: 'This is a blocker.', score: 20 },
            { value: 'B', label: 'Significant workflow delay/requires manual effort.', score: 15 },
            { value: 'C', label: "Important but not urgent.", score: 10 },
            { value: 'D', label: 'Nice-to-have/reported issue.', score: 5 },
        ]
    },
    {
        id: 'workaround',
        text: 'Is there any workaround?',
        options: [
            { value: 'A', label: 'No', score: 5 },
            { value: 'B', label: "Yes, but inefficient/hard to maintain.", score: 4 },
            { value: 'C', label: "Yes, temporary solution only.", score: 3 },
            { value: 'D', label: 'No, but tolerable.', score: 2 },
            { value: 'E', label: 'Yes, acceptable alternative.', score: 1 },
        ]
    },
    {
        id: 'churnRisk',
        text: 'Churn Risk?',
        options: [
            { value: 'A', label: 'High churn risk', score: 20 },
            { value: 'B', label: 'Low churn risk', score: 0 },
        ]
    },
    {
        id: 'waitTime',
        text: 'How urgent is this fix?',
        options: [
            { value: 'A', label: 'ASAP', score: 5 },
            { value: 'B', label: '1 week', score: 4 },
            { value: 'C', label: '2 weeks', score: 3 },
            { value: 'D', label: '1-3 months', score: 2 },
            { value: 'E', label: '4-6 months', score: 1 },
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

// Image processing constants
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB in bytes
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

// Plan scoring constants
const PLAN_SCORES = {
    'Enterprise+': 5,
    'Enterprise': 5,
    'Growth': 4,
    'Starter': 3,
    'Open Source': 2,
    'Opensource': 2
};

// Priority thresholds
const PRIORITY_THRESHOLDS = {
    HIGH: 100,
    MEDIUM: 50,
    LOW: 20,
    TRIVIAL: 1
};

// Step management
let currentStep = 1;
const totalSteps = TOTAL_STEPS;
const stepTitles = STEP_TITLES;

// Application data
const appData = {
    reportType: 'bug',
    ticketType: 'new', // 'new' or 'update'
    isQuickCalc: false, // Quick calculator mode
    isInternal: false,
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
    currentFunctionality: '',
    expectedFunctionality: '',
    timelineContext: '',
    images: {}, // Store image data: { imageId: { fileName, base64Data } }
    finalTemplateWithImages: '' // Store the version with full base64 for copying
};

// Image counter for unique IDs
let imageCounter = 0;

// EasyMDE instances
const editors = {};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

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
        currentFunctionality: sanitizeInput(appData.currentFunctionality),
        expectedFunctionality: sanitizeInput(appData.expectedFunctionality),
        timelineContext: sanitizeInput(appData.timelineContext)
    };

    return sanitizedData;
}

/**
 * Gets the score based on the selected plan type from customer details
 */
function getPlanTypeScore(appData) {
    if (appData.isInternal) {
        return 1; // Internal report score
    }

    if (appData.planType === 'Custom') {
        // Use custom score if provided, otherwise fallback to 1
        return appData.customPlanScore || 1;
    }

    return PLAN_SCORES[appData.planType] || 1; // Default to 1 if plan not found
}

/**
 * Calculates the bug score based on questions and plan type
 */
function calculateBugScore(appData) {
    let totalScore = 0;

    // Calculate score from questions
    questions.forEach(question => {
        const selectedValue = appData.questionsAnswered[question.id];
        if (selectedValue) {
            const option = question.options.find(opt => opt.value === selectedValue);
            if (option && question.id !== 'waitTime') {
                totalScore += option.score;
            }
        }
    });

    // Add plan type score based on customer details planType
    const planTypeScore = getPlanTypeScore(appData);
    totalScore += planTypeScore;

    // Apply waitTime multiplier
    const waitTimeValue = appData.questionsAnswered['waitTime'];
    if (waitTimeValue) {
        const waitTimeOption = questions.find(q => q.id === 'waitTime')
            .options.find(opt => opt.value === waitTimeValue);
        if (waitTimeOption) {
            totalScore *= waitTimeOption.score;
        }
    }

    return totalScore;
}

/**
 * Determines the priority level and corresponding CSS classes based on the score and blocker status.
 */
function getPriority(score, isBlocker = false) {
    const baseClasses = "p-4 rounded-lg shadow-md border-l-4 mb-4 text-sm";

    // Severe priority is assigned when "This is a blocker" option is selected
    if (isBlocker) {
        return {
            text: 'Severe',
            classList: `${baseClasses} bg-red-100 dark:bg-red-800/70 border-red-500 dark:border-red-500 text-red-700 dark:text-red-200`
        };
    } else if (score >= PRIORITY_THRESHOLDS.HIGH) {
        return {
            text: 'High',
            classList: `${baseClasses} bg-orange-100 dark:bg-orange-800/70 border-orange-500 dark:border-orange-500 text-orange-700 dark:text-orange-200`
        };
    } else if (score >= PRIORITY_THRESHOLDS.MEDIUM) {
        return {
            text: 'Medium',
            classList: `${baseClasses} bg-amber-100 dark:bg-amber-800/70 border-amber-500 dark:border-amber-500 text-amber-700 dark:text-amber-200`
        };
    } else if (score >= PRIORITY_THRESHOLDS.LOW) {
        return {
            text: 'Low',
            classList: `${baseClasses} bg-sky-100 dark:bg-sky-800/70 border-sky-500 dark:border-sky-500 text-sky-700 dark:text-sky-200`
        };
    } else {
        return {
            text: 'Trivial',
            classList: `${baseClasses} bg-slate-200 dark:bg-slate-700/70 border-slate-500 dark:border-slate-500 text-slate-700 dark:text-slate-300`
        };
    }
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
            const internalCheckbox = document.getElementById('internalReport');
            if (internalCheckbox && internalCheckbox.checked) {
                // For story updates, customer comment is required
                if (appData.reportType === 'story' && appData.ticketType === 'update') {
                    const customerComment = document.getElementById('customerComment');
                    const value = editors.customerComment ? editors.customerComment.value() : (customerComment ? customerComment.value : '');
                    if (!value.trim()) {
                        errors.push('Customer comment is required for story updates');
                        isValid = false;
                    }
                }
            } else {
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

                // Validate URL fields - ensure no empty fields between filled ones
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
                    { id: 'currentFunctionality', label: 'Current functionality' },
                    { id: 'expectedFunctionality', label: 'Expected functionality' },
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
 * Validates image file before processing
 */
function validateImageFile(file) {
    const errors = [];

    // Validate file type
    if (!file.type.startsWith('image/')) {
        errors.push('Invalid file type. Please use image files only.');
    }

    // Check file size
    if (file.size > MAX_IMAGE_SIZE) {
        errors.push('Image too large. Please use images smaller than 2MB.');
    }

    // Check if valid image types
    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
        errors.push('Unsupported image format. Please use JPEG, PNG, GIF, or WebP.');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Replaces image placeholders with full base64 markdown syntax
 */
function replaceImagePlaceholders(text, appData) {
    // Regular expression to match [Image: filename.ext] patterns
    const placeholderRegex = /\[Image: ([^\]]+)\]/g;

    return text.replace(placeholderRegex, (match, fileName) => {
        // Find the image data by filename
        const imageEntry = Object.values(appData.images).find(img => img.fileName === fileName);

        if (imageEntry) {
            // Return full markdown image syntax with base64 data
            return `![${fileName}](${imageEntry.base64Data})`;
        } else {
            // If image not found, return the placeholder as-is
            return match;
        }
    });
}

// Event listener for when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');

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

    // Step 3: Internal report checkbox
    const internalReportCheckbox = document.getElementById('internalReport');
    if (internalReportCheckbox) {
        internalReportCheckbox.addEventListener('change', handleInternalReportToggle);
    }

    // Step 3: Plan type dropdown
    const planTypeSelect = document.getElementById('planType');
    if (planTypeSelect) {
        planTypeSelect.addEventListener('change', handlePlanTypeChange);
    }

    // Navigation buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const startFreshBtn = document.getElementById('startFreshBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', prevStep);
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', nextStep);
    }

    if (startFreshBtn) {
        startFreshBtn.addEventListener('click', startNewReport);
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
            // Go back to step 1 (start)
            showStep(1);
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
    for (let i = 1; i <= totalSteps; i++) {
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
            if (stepTitleEl) stepTitleEl.textContent = stepTitles[currentStep - 1];
            if (progressBar) {
                const progressPercent = (currentStep / totalSteps) * 100;
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
    const startFreshBtn = document.getElementById('startFreshBtn');

    // Hide all navigation containers first
    navigationContainer.classList.add('hidden');
    if (quickStep8Navigation) quickStep8Navigation.classList.add('hidden');
    if (quickStep9Navigation) quickStep9Navigation.classList.add('hidden');

    // Handle fixed Start Fresh button visibility
    if (startFreshBtn) {
        // Show Start Fresh button on steps 2-6, hide on step 1, 7, and quick calculator steps
        if (currentStep >= 2 && currentStep <= 6) {
            startFreshBtn.classList.remove('hidden');
        } else {
            startFreshBtn.classList.add('hidden');
        }
    }

    // Show appropriate navigation based on current step
    if (currentStep === 8) {
        // Quick calculator questionnaire step
        if (quickStep8Navigation) quickStep8Navigation.classList.remove('hidden');
    } else if (currentStep === 9) {
        // Quick calculator results step
        if (quickStep9Navigation) quickStep9Navigation.classList.remove('hidden');
    } else if (currentStep === 1 || currentStep === totalSteps) {
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

    if (currentStep < totalSteps && validation.isValid) {
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
            appData.isInternal = document.getElementById('internalReport').checked;
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
                appData.currentFunctionality = editors.currentFunctionality ? editors.currentFunctionality.value() : document.getElementById('currentFunctionality').value;
                appData.expectedFunctionality = editors.expectedFunctionality ? editors.expectedFunctionality.value() : document.getElementById('expectedFunctionality').value;
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
 * Handles internal report checkbox toggle
 */
function handleInternalReportToggle(event) {
    const isInternal = event.target.checked;
    const externalFields = document.getElementById('externalFields');
    
    if (externalFields) {
        if (isInternal) {
            externalFields.style.display = 'none';
            // Clear the fields when switching to internal
            document.getElementById('customerName').value = '';
            document.getElementById('monthlyARR').value = '';
        } else {
            externalFields.style.display = 'block';
        }
    }

    updateNavigation();

    // Update tab order when fields are shown/hidden
    setTimeout(() => {
        updateTabOrder();
    }, 10);
}

/**
 * Initializes and renders the questions on the page.
 */
function initQuestions() {
    const questionsContainer = document.getElementById('questionsContainer');
    if (!questionsContainer) {
        console.error('Questions container not found');
        return;
    }
    questionsContainer.innerHTML = '';

    questions.forEach(question => {
        const card = document.createElement('div');
        card.className = 'bg-slate-50 dark:bg-slate-700 rounded-lg p-6 border border-slate-200 dark:border-slate-600';
        card.setAttribute('aria-labelledby', `question-${question.id}-title`);
        
        const cardTitle = document.createElement('h3');
        cardTitle.className = 'text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200';
        cardTitle.id = `question-${question.id}-title`;
        cardTitle.textContent = question.text;
        card.appendChild(cardTitle);
        
        const fieldset = document.createElement('fieldset');
        fieldset.setAttribute('aria-labelledby', `question-${question.id}-title`);
        const optionsList = document.createElement('div');
        optionsList.className = 'space-y-3';

        question.options.forEach((option) => {
            const optionWrapper = document.createElement('div');
            optionWrapper.className = 'flex items-start';
            
            const input = document.createElement('input');
            input.className = 'h-4 w-4 text-sky-600 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 rounded mt-1';
            input.type = 'radio';
            input.id = `${question.id}-${option.value}`;
            input.name = question.id;
            input.value = option.value;
            input.dataset.score = option.score;
            
            // Add event listener to update navigation when answers change
            input.addEventListener('change', updateNavigation);
            
            const label = document.createElement('label');
            label.className = 'ml-3 block text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer';
            label.htmlFor = `${question.id}-${option.value}`;
            label.textContent = option.label;
            
            optionWrapper.appendChild(input);
            optionWrapper.appendChild(label);
            optionsList.appendChild(optionWrapper);
        });
        
        fieldset.appendChild(optionsList);
        card.appendChild(fieldset);
        questionsContainer.appendChild(card);
    });

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
        { id: 'currentFunctionality', minHeight: '100px' },
        { id: 'expectedFunctionality', minHeight: '100px' },
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

    // Add image paste support after all editors are created
    setTimeout(() => {
        addImagePasteSupport();
    }, 100);
}

/**
 * Calculates the bug score and generates the final output
 */
function calculateScore() {
    const totalScore = calculateBugScore(appData);

    // Check if "This is a blocker" option was selected
    const isBlocker = appData.questionsAnswered.importance === 'A';

    appData.calculatedScore = totalScore;
    appData.priority = getPriority(totalScore, isBlocker);

    // Generate the final output
    generateFinalOutput();
}


/**
 * Generates the final ticket template
 */
function generateFinalOutput() {
    // Get sanitized data
    const sanitized = sanitizeAppData(appData);

    // Determine customer info
    let customerInfo;
    let plan = 'N/A';

    if (appData.isInternal) {
        customerInfo = 'Reported internally';
        plan = 'Internal';
    } else {
        customerInfo = sanitized.customerName || 'N/A';

        // Use the planType dropdown from customer details
        if (appData.planType) {
            if (appData.planType === 'Custom' && sanitized.customPlanText) {
                plan = sanitized.customPlanText;
            } else if (appData.planType !== 'Custom') {
                plan = appData.planType; // planType from dropdown is safe
            }
        }
    }

    const annualARR = appData.isInternal ? 0 : (parseFloat(appData.monthlyARR || 0) * 12);
    const intercomLinks = formatURLsAsJIRALinks(sanitized.intercomURLs, 'intercom');
    const slackLinks = formatURLsAsJIRALinks(sanitized.slackURLs, 'slack');
    const customerComment = sanitized.customerComment || '';

    // Create template based on report type
    let template;

    if (appData.reportType === 'story') {
        // Story template
        if (appData.ticketType === 'update') {
            // Story update: Only customer details + comment
            template = `## ${customerInfo}, Plan: ${plan}, ARR: $${annualARR.toFixed(2)}
**Intercom Links:** ${intercomLinks}
**Slack Links:** ${slackLinks}`;
            if (customerComment.trim() !== '') {
                template += `\n**Comment:** ${customerComment}`;
            }
        } else {
            // New story: Full story template
            template = `## Description
${sanitized.storyDescription}

## Current Functionality
${sanitized.currentFunctionality}

## Expected Functionality
${sanitized.expectedFunctionality}

## Timeline & Context
${sanitized.timelineContext}

## ${customerInfo}, Plan: ${plan}, ARR: $${annualARR.toFixed(2)}
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
            template = `## ${customerInfo}, Plan: ${plan}, ARR: $${annualARR.toFixed(2)}
**Intercom Links:** ${intercomLinks}
**Slack Links:** ${slackLinks}`;
            if (customerComment.trim() !== '') {
                template += `\n**Comment:** ${customerComment}`;
            }
            template += `

${qaSection}**Final Score:** ${appData.calculatedScore}

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

## ${customerInfo}, Plan: ${plan}, ARR: $${annualARR.toFixed(2)}
**Intercom Links:** ${intercomLinks}
**Slack Links:** ${slackLinks}`;
            if (customerComment.trim() !== '') {
                template += `\n**Comment:** ${customerComment}`;
            }
            template += `

${qaSection}**Final Score:** ${appData.calculatedScore}`;
        }
    }

    // Store the version with full base64 for copying
    appData.finalTemplateWithImages = replaceImagePlaceholders(template, appData);

    // Display the clean version with placeholders in the UI
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
                const progressPercent = Math.min(appData.calculatedScore / 250 * 100, 100);
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
    
    // Use the version with full base64 data for copying
    const textToCopy = appData.finalTemplateWithImages || copyText.value;
    
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
        currentFunctionality: '',
        expectedFunctionality: '',
        timelineContext: '',
        images: {},
        finalTemplateWithImages: ''
    });

    // Reset image counter
    imageCounter = 0;

    // Reset all form fields
    document.querySelectorAll('input[type="text"], input[type="number"], textarea, select').forEach(input => {
        input.value = '';
    });

    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
        input.checked = false;
    });

    // Show external fields again
    const externalFields = document.getElementById('externalFields');
    if (externalFields) {
        externalFields.style.display = 'block';
    }

    // Hide custom plan container
    const customPlanContainer = document.getElementById('customPlanContainer');
    if (customPlanContainer) {
        customPlanContainer.classList.add('hidden');
    }

    // Reset quick calculator specific fields
    const quickExternalFields = document.getElementById('quickExternalFields');
    if (quickExternalFields) {
        quickExternalFields.style.display = 'block';
    }

    const quickCustomPlanContainer = document.getElementById('quickCustomPlanContainer');
    if (quickCustomPlanContainer) {
        quickCustomPlanContainer.classList.add('hidden');
    }

    const quickPlanScoreContext = document.getElementById('quickPlanScoreContext');
    if (quickPlanScoreContext) {
        quickPlanScoreContext.classList.add('hidden');
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
        'storyDescription', 'currentFunctionality', 'expectedFunctionality', 'timelineContext'
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
        const stepTitle = stepTitles[stepNumber - 1];
        announcements.textContent = `Step ${stepNumber} of ${totalSteps}: ${stepTitle}`;
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
            customerNameInput.addEventListener('input', updateNavigation);
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
            monthlyARRInput.addEventListener('input', updateNavigation);
        }

        // Add plan type validation
        const planTypeSelect = document.getElementById('planType');
        const customPlanInput = document.getElementById('customPlanText');
        const customScoreInput = document.getElementById('customPlanScore');

        if (planTypeSelect) {
            planTypeSelect.addEventListener('change', updateNavigation);
        }

        if (customPlanInput) {
            customPlanInput.addEventListener('input', updateNavigation);
        }

        if (customScoreInput) {
            customScoreInput.addEventListener('input', function() {
                validateCustomScore(this);
                updateNavigation();
            });
            customScoreInput.addEventListener('focus', showPlanScoreContext);
            customScoreInput.addEventListener('blur', hidePlanScoreContext);
        }
        
        if (bugSummaryInput) {
            bugSummaryInput.addEventListener('input', updateNavigation);
        }
        
        if (stepsToReproduceInput) {
            stepsToReproduceInput.addEventListener('input', updateNavigation);
        }
        
        if (expectedVsActualInput) {
            expectedVsActualInput.addEventListener('input', updateNavigation);
        }
        
        // Image paste functionality is now handled in initEasyMDE()

        // Add input event listeners for story fields
        addStoryFieldListeners();
    }, 100);
});

/**
 * Inserts an image from a file into a textarea
 */
function insertImageFromFile(file, textarea) {
    // Validate file
    const validation = validateImageFile(file);
    if (!validation.isValid) {
        showImagePasteError(textarea, validation.errors[0]);
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const base64String = e.target.result;
            const fileName = file.name || 'pasted-image.png';

            // Validate base64 string
            if (!base64String || !base64String.startsWith('data:image/')) {
                throw new Error('Invalid image data');
            }

            // Generate unique image ID
            imageCounter++;
            const imageId = `image-${imageCounter}`;

            // Store image data
            appData.images[imageId] = {
                fileName: fileName,
                base64Data: base64String
            };

            // Create compact placeholder instead of full base64
            const imagePlaceholder = `[Image: ${fileName}]`;

            // Insert at cursor position
            const cursorPosition = textarea.selectionStart;
            const textBefore = textarea.value.substring(0, cursorPosition);
            const textAfter = textarea.value.substring(textarea.selectionEnd);

            textarea.value = textBefore + imagePlaceholder + '\n\n' + textAfter;

            // Move cursor after the inserted placeholder
            const newCursorPosition = cursorPosition + imagePlaceholder.length + 2;
            textarea.setSelectionRange(newCursorPosition, newCursorPosition);

            // Focus the textarea
            textarea.focus();

            // Trigger input event for validation
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Show feedback
            showImagePasteFeedback(textarea, 'Image added successfully!');

        } catch (error) {
            console.error('Error processing image:', error);
            showImagePasteError(textarea, 'Failed to process image. Please try again.');
        }
    };

    reader.onerror = function(error) {
        console.error('FileReader error:', error);
        showImagePasteError(textarea, 'Error reading image file. Please try again.');
    };

    reader.readAsDataURL(file);
}

/**
 * Handles image paste events
 */
function handleImagePaste(e) {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    const items = Array.from(clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));

    if (imageItems.length > 0) {
        e.preventDefault();

        imageItems.forEach(item => {
            const file = item.getAsFile();
            if (file) {
                insertImageFromFile(file, e.target);
            }
        });
    }
}

/**
 * Shows feedback when an image is successfully pasted
 */
function showImagePasteFeedback(textarea, message = 'Image added successfully!') {
    const originalBorder = textarea.style.border;
    textarea.style.border = '2px solid #10b981';

    // Show user feedback message
    showUserMessage(message, 'success');

    setTimeout(() => {
        textarea.style.border = originalBorder;
    }, 1000);
}

/**
 * Shows error feedback when image paste fails
 */
function showImagePasteError(textarea, message = 'Error processing image') {
    const originalBorder = textarea.style.border;
    textarea.style.border = '2px solid #ef4444';

    // Show user error message
    showUserMessage(message, 'error');

    setTimeout(() => {
        textarea.style.border = originalBorder;
    }, 1000);
}

/**
 * Adds image paste functionality to all textareas
 */
function addImagePasteSupport() {
    const editorIds = ['bugSummary', 'stepsToReproduce', 'expectedVsActual', 'storyDescription', 'currentFunctionality', 'expectedFunctionality', 'timelineContext', 'customerComment'];

    editorIds.forEach(editorId => {
        const editor = editors[editorId];
        if (editor && editor.codemirror) {
            // Add paste event listener to the CodeMirror instance
            editor.codemirror.on('paste', (cm, event) => {
                handleImagePasteForEditor(event, editor, editorId);
            });

            // Add drag and drop support to the CodeMirror wrapper
            const wrapper = editor.codemirror.getWrapperElement();
            if (wrapper) {
                wrapper.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    wrapper.classList.add('drag-over');
                });

                wrapper.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    wrapper.classList.remove('drag-over');
                });

                wrapper.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    wrapper.classList.remove('drag-over');

                    const files = Array.from(e.dataTransfer.files);
                    const imageFiles = files.filter(file => file.type.startsWith('image/'));

                    imageFiles.forEach(file => {
                        insertImageFromFileForEditor(file, editor, editorId);
                    });
                });
            }
        }
    });
}

/**
 * Handles image paste events for EasyMDE editors
 */
function handleImagePasteForEditor(event, editor, editorId) {
    const clipboardData = event.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    const items = Array.from(clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));

    if (imageItems.length > 0) {
        event.preventDefault();
        imageItems.forEach(item => {
            const file = item.getAsFile();
            if (file) {
                insertImageFromFileForEditor(file, editor, editorId);
            }
        });
    }
}

/**
 * Inserts an image from a file into an EasyMDE editor
 */
function insertImageFromFileForEditor(file, editor, editorId) {
    // Validate file
    const validation = validateImageFile(file);
    if (!validation.isValid) {
        showImagePasteErrorForEditor(editor, validation.errors[0]);
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const base64Data = e.target.result;

            // Generate unique image ID and filename
            const imageId = `img_${Date.now()}_${imageCounter++}`;
            const fileName = file.name || `image_${imageId}.${file.type.split('/')[1]}`;

            // Store image data
            appData.images[imageId] = {
                fileName: fileName,
                base64Data: base64Data
            };

            // Insert image placeholder into editor
            const imagePlaceholder = `[Image: ${fileName}]`;
            const cursor = editor.codemirror.getCursor();
            editor.codemirror.replaceRange(imagePlaceholder + '\n\n', cursor);

            // Move cursor after the inserted placeholder
            const newLine = cursor.line + 2;
            editor.codemirror.setCursor(newLine, 0);
            editor.codemirror.focus();

            // Show feedback
            showImagePasteFeedbackForEditor(editor, 'Image added successfully!');
        } catch (error) {
            console.error('Error processing image:', error);
            showImagePasteErrorForEditor(editor, 'Failed to process image. Please try again.');
        }
    };

    reader.onerror = function(error) {
        console.error('FileReader error:', error);
        showImagePasteErrorForEditor(editor, 'Error reading image file. Please try again.');
    };

    reader.readAsDataURL(file);
}

/**
 * Shows feedback when an image is successfully pasted into EasyMDE
 */
function showImagePasteFeedbackForEditor(editor, message = 'Image added successfully!') {
    const wrapper = editor.codemirror.getWrapperElement();
    const originalBorder = wrapper.style.border;
    wrapper.style.border = '2px solid #10b981';

    // Show user feedback message
    showUserMessage(message, 'success');

    setTimeout(() => {
        wrapper.style.border = originalBorder;
    }, 1000);
}

/**
 * Shows error feedback when image paste fails in EasyMDE
 */
function showImagePasteErrorForEditor(editor, message = 'Error processing image') {
    const wrapper = editor.codemirror.getWrapperElement();
    const originalBorder = wrapper.style.border;
    wrapper.style.border = '2px solid #ef4444';

    // Show user error message
    showUserMessage(message, 'error');

    setTimeout(() => {
        wrapper.style.border = originalBorder;
    }, 1000);
}

/**
 * Initializes dynamic URL field functionality
 */
function initDynamicURLFields() {
    let intercomCount = 1;
    let slackCount = 1;

    // Add Intercom URL field
    document.getElementById('addIntercomURL').addEventListener('click', function() {
        const container = document.getElementById('intercomURLsContainer');
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'intercom-url-field mb-3';
        fieldDiv.innerHTML = `
            <div class="flex gap-2">
                <input type="text" id="intercomURL${intercomCount}" placeholder="Enter Intercom URL" class="flex-1 px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:text-white">
                <button type="button" class="remove-intercom-btn bg-red-500 hover:bg-red-600 text-white px-3 py-2.5 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500">Remove</button>
            </div>
        `;
        container.appendChild(fieldDiv);
        intercomCount++;
        updateRemoveButtonsVisibility();
        updateNavigation();
    });

    // Add Slack URL field
    document.getElementById('addSlackURL').addEventListener('click', function() {
        const container = document.getElementById('slackURLsContainer');
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'slack-url-field mb-3';
        fieldDiv.innerHTML = `
            <div class="flex gap-2">
                <input type="text" id="slackURL${slackCount}" placeholder="Enter Slack URL" class="flex-1 px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:text-white">
                <button type="button" class="remove-slack-btn bg-red-500 hover:bg-red-600 text-white px-3 py-2.5 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500">Remove</button>
            </div>
        `;
        container.appendChild(fieldDiv);
        slackCount++;
        updateRemoveButtonsVisibility();
        updateNavigation();
    });

    // Handle remove buttons for Intercom URLs
    document.getElementById('intercomURLsContainer').addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-intercom-btn')) {
            e.target.closest('.intercom-url-field').remove();
            updateRemoveButtonsVisibility();
            updateNavigation();
        }
    });

    // Handle remove buttons for Slack URLs
    document.getElementById('slackURLsContainer').addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-slack-btn')) {
            e.target.closest('.slack-url-field').remove();
            updateRemoveButtonsVisibility();
            updateNavigation();
        }
    });

    // Show/hide remove buttons based on number of fields
    function updateRemoveButtonsVisibility() {
        const intercomFields = document.querySelectorAll('.intercom-url-field');
        const slackFields = document.querySelectorAll('.slack-url-field');

        // Show remove buttons only if more than one field exists
        intercomFields.forEach((field, index) => {
            const removeBtn = field.querySelector('.remove-intercom-btn');
            if (intercomFields.length > 1) {
                removeBtn.classList.remove('hidden');
            } else {
                removeBtn.classList.add('hidden');
            }
        });

        slackFields.forEach((field, index) => {
            const removeBtn = field.querySelector('.remove-slack-btn');
            if (slackFields.length > 1) {
                removeBtn.classList.remove('hidden');
            } else {
                removeBtn.classList.add('hidden');
            }
        });
    }
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
    const storyFields = ['storyDescription', 'currentFunctionality', 'expectedFunctionality', 'timelineContext', 'customerComment'];

    storyFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', updateNavigation);
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
        if (stepsToReproduceDiv) stepsToReproduceDiv.style.display = 'none';
        if (expectedVsActualDiv) expectedVsActualDiv.style.display = 'none';
    } else {
        // Show all fields for new tickets
        if (stepsToReproduceDiv) stepsToReproduceDiv.style.display = 'block';
        if (expectedVsActualDiv) expectedVsActualDiv.style.display = 'block';
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

    // Set up event listeners for internal/external toggle
    const quickInternalReport = document.getElementById('quickInternalReport');
    const quickExternalFields = document.getElementById('quickExternalFields');

    if (quickInternalReport) {
        quickInternalReport.addEventListener('change', function() {
            if (quickExternalFields) {
                quickExternalFields.style.display = this.checked ? 'none' : 'block';
            }
        });
    }

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
    const container = document.getElementById('quickQuestionsContainer');
    if (!container) return;

    container.innerHTML = '';

    questions.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-6';

        const questionTitle = document.createElement('h4');
        questionTitle.className = 'text-base font-semibold mb-4 text-slate-700 dark:text-slate-200';
        questionTitle.textContent = question.text;
        questionDiv.appendChild(questionTitle);

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'space-y-3';

        question.options.forEach((option, optionIndex) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'flex items-start';

            const radioInput = document.createElement('input');
            radioInput.type = 'radio';
            radioInput.name = `quick_${question.id}`;
            radioInput.value = option.value;
            radioInput.id = `quick_${question.id}-${option.value}`;
            radioInput.className = 'h-4 w-4 text-sky-600 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 rounded mt-1';

            const label = document.createElement('label');
            label.className = 'ml-3 block text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer';
            label.htmlFor = `quick_${question.id}-${option.value}`;
            label.textContent = option.label;

            optionDiv.appendChild(radioInput);
            optionDiv.appendChild(label);
            optionsDiv.appendChild(optionDiv);
        });

        questionDiv.appendChild(optionsDiv);
        container.appendChild(questionDiv);
    });
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

    // Check if internal/external is properly configured
    const quickInternalReport = document.getElementById('quickInternalReport');
    const isInternal = quickInternalReport ? quickInternalReport.checked : false;

    if (!isInternal) {
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
    const quickInternalReport = document.getElementById('quickInternalReport');
    appData.isInternal = quickInternalReport ? quickInternalReport.checked : false;

    if (!appData.isInternal) {
        appData.planType = document.getElementById('quickPlanType')?.value || '';

        if (appData.planType === 'Custom') {
            appData.customPlanText = document.getElementById('quickCustomPlanText')?.value || '';
            appData.customPlanScore = parseInt(document.getElementById('quickCustomPlanScore')?.value) || 1;
        }
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
    const totalScore = calculateBugScore(appData);

    // Check if "This is a blocker" option was selected
    const isBlocker = appData.questionsAnswered.importance === 'A';

    appData.calculatedScore = totalScore;
    appData.priority = getPriority(totalScore, isBlocker);

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
    questionnaireResults += `**Priority:** ${appData.priority.text}`;

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
        const maxScore = 250; // Same max score as main flow
        const progressPercent = Math.min((appData.calculatedScore / maxScore) * 100, 100);
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

