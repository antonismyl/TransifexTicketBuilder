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
const TOTAL_STEPS = 6;
const STEP_TITLES = [
    'Report Type',
    'Ticket Type',
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
    SEVERE: 100,
    HIGH: 50,
    MEDIUM: 20,
    LOW: 0
};

// Step management
let currentStep = 1;
const totalSteps = TOTAL_STEPS;
const stepTitles = STEP_TITLES;

// Application data
const appData = {
    reportType: 'bug',
    ticketType: 'new', // 'new' or 'update'
    isInternal: false,
    customerName: '',
    monthlyARR: '',
    planType: '',
    customPlanText: '',
    customPlanScore: 1,
    intercomURL: '',
    slackURL: '',
    customerComment: '',
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
        intercomURL: sanitizeInput(appData.intercomURL),
        slackURL: sanitizeInput(appData.slackURL),
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
 * Determines the priority level and corresponding CSS classes based on the score.
 */
function getPriority(score) {
    const baseClasses = "p-4 rounded-lg shadow-md border-l-4 mb-4 text-sm";

    if (score >= PRIORITY_THRESHOLDS.SEVERE) {
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
    } else if (score > PRIORITY_THRESHOLDS.LOW) {
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
        case 3: // Customer details
            const internalCheckbox = document.getElementById('internalReport');
            if (internalCheckbox && internalCheckbox.checked) {
                // For story updates, customer comment is required
                if (appData.reportType === 'story' && appData.ticketType === 'update') {
                    const customerComment = document.getElementById('customerComment');
                    if (!customerComment || customerComment.value.trim() === '') {
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
                    if (!customerComment || customerComment.value.trim() === '') {
                        errors.push('Customer comment is required for story updates');
                        isValid = false;
                    }
                }
            }
            break;

        case 4: // Impact assessment or Story documentation
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
                    if (!element || element.value.trim() === '') {
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

        case 5: // Bug documentation
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
                if (!element || element.value.trim() === '') {
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

    if (selectBugBtn) {
        selectBugBtn.addEventListener('click', () => {
            appData.reportType = 'bug';
            nextStep();
        });
    }

    if (selectStoryBtn) {
        selectStoryBtn.addEventListener('click', () => {
            appData.reportType = 'story';
            nextStep();
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
    
    if (prevBtn) {
        prevBtn.addEventListener('click', prevStep);
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', nextStep);
    }

    // Step 5: Final actions
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

    // Hide all steps
    for (let i = 1; i <= totalSteps; i++) {
        const stepElement = document.getElementById(`step${i}`);
        if (stepElement) {
            stepElement.classList.add('hidden');
        }
    }

    // Show current step
    const currentStepElement = document.getElementById(`step${stepNumber}`);
    if (currentStepElement) {
        currentStepElement.classList.remove('hidden');
    }

    // Handle step 4 content based on report type
    if (stepNumber === 4) {
        updateStep4Content();
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
    const currentStepEl = document.getElementById('currentStep');
    const stepTitleEl = document.getElementById('stepTitle');
    const progressBar = document.getElementById('progressBar');
    
    if (currentStep === 1) {
        progressIndicator.classList.add('hidden');
    } else {
        progressIndicator.classList.remove('hidden');
        if (currentStepEl) currentStepEl.textContent = currentStep;
        if (stepTitleEl) stepTitleEl.textContent = stepTitles[currentStep - 1];
        if (progressBar) {
            const progressPercent = (currentStep / totalSteps) * 100;
            progressBar.style.width = `${progressPercent}%`;
        }
    }
}

/**
 * Updates navigation button states
 */
function updateNavigation() {
    const navigationContainer = document.getElementById('navigationContainer');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (currentStep === 1 || currentStep === totalSteps) {
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

        // Show Next button for steps 3-5
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

        // For story updates, skip steps 4 and 5 (go directly to final step)
        if (appData.reportType === 'story' && appData.ticketType === 'update' && currentStep === 3) {
            nextStepNumber = 6; // Skip to final step
        }

        // For story updates, if somehow on step 4, skip to final step
        if (appData.reportType === 'story' && appData.ticketType === 'update' && currentStep === 4) {
            nextStepNumber = 6;
        }

        // For story reports (new), skip step 5 (bug documentation)
        if (appData.reportType === 'story' && appData.ticketType === 'new' && currentStep === 4) {
            nextStepNumber = 6;
        }

        if (nextStepNumber === 6) {
            // Generate final output before showing final step
            if (appData.reportType === 'bug') {
                calculateScore(); // Only calculate score for bugs
            } else {
                generateFinalOutput(); // Generate story output directly
            }
        }

        if (currentStep === 5) {
            // Calculate score before showing final step (for bugs)
            calculateScore();
        }

        // Update UI based on ticket type when moving to bug documentation step
        if (nextStepNumber === 5) {
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
 * Moves to previous step
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
        case 3: // Customer details
            appData.isInternal = document.getElementById('internalReport').checked;
            appData.customerName = document.getElementById('customerName').value;
            appData.monthlyARR = document.getElementById('monthlyARR').value;
            appData.planType = document.getElementById('planType').value;
            appData.customPlanText = document.getElementById('customPlanText').value;
            appData.customPlanScore = parseInt(document.getElementById('customPlanScore').value) || 1;
            appData.intercomURL = document.getElementById('intercomURL').value;
            appData.slackURL = document.getElementById('slackURL').value;
            appData.customerComment = document.getElementById('customerComment').value;
            break;
        case 4: // Impact assessment or Story documentation
            if (appData.reportType === 'story') {
                // Save story documentation fields
                appData.storyDescription = document.getElementById('storyDescription').value;
                appData.currentFunctionality = document.getElementById('currentFunctionality').value;
                appData.expectedFunctionality = document.getElementById('expectedFunctionality').value;
                appData.timelineContext = document.getElementById('timelineContext').value;
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
        case 5: // Bug documentation
            appData.bugSummary = document.getElementById('bugSummary').value;
            appData.stepsToReproduce = document.getElementById('stepsToReproduce').value;
            appData.expectedVsActual = document.getElementById('expectedVsActual').value;
            break;
    }
}

/**
 * Updates Step 4 content based on report type
 */
function updateStep4Content() {
    const questionsContainer = document.getElementById('questionsContainer');
    const storyContainer = document.getElementById('storyContainer');
    const step4Title = document.getElementById('step4Title');

    if (appData.reportType === 'story') {
        // Show story documentation, hide questions
        questionsContainer.classList.add('hidden');
        storyContainer.classList.remove('hidden');
        step4Title.textContent = 'Story Documentation';
    } else {
        // Show questions, hide story documentation
        questionsContainer.classList.remove('hidden');
        storyContainer.classList.add('hidden');
        step4Title.textContent = 'Impact Assessment';
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
 * Calculates the bug score and generates the final output
 */
function calculateScore() {
    const totalScore = calculateBugScore(appData);

    appData.calculatedScore = totalScore;
    appData.priority = getPriority(totalScore);

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
    const intercomURL = sanitized.intercomURL || 'N/A';
    const slackURL = sanitized.slackURL || 'N/A';
    const customerComment = sanitized.customerComment || '';

    // Create template based on report type
    let template;

    if (appData.reportType === 'story') {
        // Story template
        if (appData.ticketType === 'update') {
            // Story update: Only customer details + comment
            template = `## ${customerInfo}, ${plan}, $${annualARR.toFixed(2)}
**Intercom URL:** ${intercomURL}
**Slack URL:** ${slackURL}`;
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

## ${customerInfo}, ${plan}, $${annualARR.toFixed(2)}
**Intercom URL:** ${intercomURL}
**Slack URL:** ${slackURL}`;
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
            template = `## ${customerInfo}, ${plan}, $${annualARR.toFixed(2)}
**Intercom URL:** ${intercomURL}
**Slack URL:** ${slackURL}`;
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

## ${customerInfo}, ${plan}, $${annualARR.toFixed(2)}
**Intercom URL:** ${intercomURL}
**Slack URL:** ${slackURL}`;
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
    copyBtn.classList.add('bg-green-500', 'hover:bg-green-600');
    copyBtn.classList.remove('bg-sky-500', 'hover:bg-sky-600');

    setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
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
        isInternal: false,
        customerName: '',
        monthlyARR: '',
        planType: '',
        customPlanText: '',
        customPlanScore: 1,
        intercomURL: '',
        slackURL: '',
        customerComment: '',
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

    // Go back to step 1
    showStep(1);
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
        
        // Add image paste functionality to textareas
        addImagePasteSupport();

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
    const textareas = ['bugSummary', 'stepsToReproduce', 'expectedVsActual', 'storyDescription', 'currentFunctionality', 'expectedFunctionality', 'timelineContext', 'customerComment'];

    textareas.forEach(textareaId => {
        const textarea = document.getElementById(textareaId);
        if (textarea) {
            // Add paste event listener
            textarea.addEventListener('paste', handleImagePaste);

            // Add drag and drop support
            textarea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                textarea.classList.add('drag-over');
            });

            textarea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                textarea.classList.remove('drag-over');
            });

            textarea.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                textarea.classList.remove('drag-over');

                const files = Array.from(e.dataTransfer.files);
                const imageFiles = files.filter(file => file.type.startsWith('image/'));

                imageFiles.forEach(file => {
                    insertImageFromFile(file, textarea);
                });
            });
        }
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

