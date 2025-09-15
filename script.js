// Transifex Ticket Builder - Questions data
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
        id: 'customerType',
        text: 'Customer Plan?',
        options: [
            { value: 'A', label: 'Enterprise', score: 5 },
            { value: 'B', label: 'Growth', score: 4 },
            { value: 'C', label: 'Starter', score: 3 },
            { value: 'D', label: 'Opensource', score: 2 },
            { value: 'E', label: 'Reported Internally by the Transifex team', score: 1 },
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

// Step management
let currentStep = 1;
const totalSteps = 6;
const stepTitles = [
    'Report Type',
    'Ticket Type',
    'Customer Details', 
    'Impact Assessment',
    'Bug Documentation',
    'Final Report'
];

// Application data
const appData = {
    reportType: 'bug',
    ticketType: 'new', // 'new' or 'update'
    isInternal: false,
    customerName: '',
    monthlyARR: '',
    intercomURL: '',
    slackURL: '',
    questionsAnswered: {},
    bugSummary: '',
    stepsToReproduce: '',
    expectedVsActual: '',
    calculatedScore: 0,
    priority: '',
    images: {}, // Store image data: { imageId: { fileName, base64Data } }
    finalTemplateWithImages: '' // Store the version with full base64 for copying
};

// Image counter for unique IDs
let imageCounter = 0;

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
    if (selectBugBtn) {
        selectBugBtn.addEventListener('click', () => {
            appData.reportType = 'bug';
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
    
    // Update progress and navigation
    updateProgressIndicator();
    updateNavigation();
    
    // Focus management
    focusFirstElement(stepNumber);
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
    
    if (currentStep === 1) {
        navigationContainer.classList.add('hidden');
    } else if (currentStep === totalSteps) {
        navigationContainer.classList.add('hidden');
    } else {
        navigationContainer.classList.remove('hidden');
        
        if (prevBtn) {
            prevBtn.disabled = currentStep <= 3;
            prevBtn.classList.toggle('opacity-50', currentStep <= 3);
            prevBtn.classList.toggle('cursor-not-allowed', currentStep <= 3);
        }
        
        if (nextBtn) {
            const canProceed = canProceedFromCurrentStep();
            nextBtn.disabled = !canProceed;
            nextBtn.classList.toggle('opacity-50', !canProceed);
            nextBtn.classList.toggle('cursor-not-allowed', !canProceed);
        }
    }
}

/**
 * Checks if user can proceed from current step
 */
function canProceedFromCurrentStep() {
    switch (currentStep) {
        case 3: // Customer details
            const internalCheckbox = document.getElementById('internalReport');
            if (internalCheckbox && internalCheckbox.checked) {
                return true; // No required fields for internal reports
            }
            const customerName = document.getElementById('customerName');
            return customerName && customerName.value.trim() !== '';
        case 4: // Impact assessment
            return questions.every(q => 
                document.querySelector(`input[name="${q.id}"]:checked`)
            );
        case 5: // Bug documentation
            const bugSummary = document.getElementById('bugSummary');
            // For update tickets, only summary is required
            if (appData.ticketType === 'update') {
                return bugSummary && bugSummary.value.trim() !== '';
            }
            // For new tickets, all fields are required
            const stepsToReproduce = document.getElementById('stepsToReproduce');
            const expectedVsActual = document.getElementById('expectedVsActual');
            return bugSummary && bugSummary.value.trim() !== '' &&
                   stepsToReproduce && stepsToReproduce.value.trim() !== '' &&
                   expectedVsActual && expectedVsActual.value.trim() !== '';
        default:
            return true;
    }
}

/**
 * Moves to next step
 */
function nextStep() {
    if (currentStep < totalSteps && canProceedFromCurrentStep()) {
        saveCurrentStepData();
        
        if (currentStep === 5) {
            // Calculate score before showing final step
            calculateScore();
        }
        
        // Update UI based on ticket type when moving to bug documentation step
        if (currentStep + 1 === 5) {
            updateBugDocumentationStep();
        }
        
        showStep(currentStep + 1);
    }
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
            appData.intercomURL = document.getElementById('intercomURL').value;
            appData.slackURL = document.getElementById('slackURL').value;
            break;
        case 4: // Impact assessment
            questions.forEach(question => {
                const selectedOption = document.querySelector(`input[name="${question.id}"]:checked`);
                if (selectedOption) {
                    appData.questionsAnswered[question.id] = selectedOption.value;
                }
            });
            break;
        case 5: // Bug documentation
            appData.bugSummary = document.getElementById('bugSummary').value;
            appData.stepsToReproduce = document.getElementById('stepsToReproduce').value;
            appData.expectedVsActual = document.getElementById('expectedVsActual').value;
            break;
    }
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
}

/**
 * Calculates the bug score and generates the final output
 */
function calculateScore() {
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
    
    // Apply waitTime multiplier
    const waitTimeValue = appData.questionsAnswered['waitTime'];
    if (waitTimeValue) {
        const waitTimeOption = questions.find(q => q.id === 'waitTime')
            .options.find(opt => opt.value === waitTimeValue);
        if (waitTimeOption) {
            totalScore *= waitTimeOption.score;
        }
    }
    
    appData.calculatedScore = totalScore;
    appData.priority = getPriority(totalScore);
    
    // Generate the final output
    generateFinalOutput();
}

/**
 * Generates the final ticket template
 */
function generateFinalOutput() {
    // Determine customer info
    let customerInfo;
    let plan = 'N/A';
    
    if (appData.isInternal) {
        customerInfo = 'Reported internally';
        plan = 'Internal';
    } else {
        customerInfo = appData.customerName || 'N/A';
        const customerTypeValue = appData.questionsAnswered['customerType'];
        if (customerTypeValue) {
            const planMap = { 'A': 'Enterprise', 'B': 'Growth', 'C': 'Starter', 'D': 'Open-source', 'E': 'Internal' };
            plan = planMap[customerTypeValue] || 'N/A';
        }
    }
    
    const annualARR = appData.isInternal ? 0 : (parseFloat(appData.monthlyARR || 0) * 12);
    const intercomURL = appData.intercomURL || 'N/A';
    const slackURL = appData.slackURL || 'N/A';
    
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
    
    // Create template based on ticket type
    let template;
    
    if (appData.ticketType === 'update') {
        // For update tickets: Customer details + Questionnaire + Summary only
        template = `## Customer Details
**Customer:** ${customerInfo}, ${plan}, $${annualARR.toFixed(2)}
**Intercom URL:** ${intercomURL}  
**Slack URL:** ${slackURL}

${qaSection}**Final Score:** ${appData.calculatedScore}

## Summary
${appData.bugSummary}`;
    } else {
        // For new tickets: Full template with all fields
        template = `## Summary
${appData.bugSummary}

## Steps to Reproduce
${appData.stepsToReproduce}

## Expected vs Actual Behavior
${appData.expectedVsActual}

## Customer Details
**Customer:** ${customerInfo}, ${plan}, $${annualARR.toFixed(2)}
**Intercom URL:** ${intercomURL}  
**Slack URL:** ${slackURL}

${qaSection}**Final Score:** ${appData.calculatedScore}`;
    }
    
    // Store the version with full base64 for copying
    appData.finalTemplateWithImages = replaceImagePlaceholders(template);
    
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
    
    if (scoreValueEl) scoreValueEl.textContent = appData.calculatedScore;
    if (priorityTextEl) priorityTextEl.textContent = appData.priority.text;
    if (copyTextEl) copyTextEl.value = template;
    
    if (priorityAlertEl) {
        priorityAlertEl.className = appData.priority.classList;
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

/**
 * Determines the priority level and corresponding CSS classes based on the score.
 */
function getPriority(score) {
    const baseClasses = "p-4 rounded-lg shadow-md border-l-4 mb-4 text-sm";
    if (score >= 100) {
        return { text: 'Severe', classList: `${baseClasses} bg-red-100 dark:bg-red-800/70 border-red-500 dark:border-red-500 text-red-700 dark:text-red-200` };
    } else if (score >= 50) {
        return { text: 'High', classList: `${baseClasses} bg-orange-100 dark:bg-orange-800/70 border-orange-500 dark:border-orange-500 text-orange-700 dark:text-orange-200` };
    } else if (score >= 20) {
        return { text: 'Medium', classList: `${baseClasses} bg-amber-100 dark:bg-amber-800/70 border-amber-500 dark:border-amber-500 text-amber-700 dark:text-amber-200` };
    } else if (score > 0) {
        return { text: 'Low', classList: `${baseClasses} bg-sky-100 dark:bg-sky-800/70 border-sky-500 dark:border-sky-500 text-sky-700 dark:text-sky-200` };
    } else {
        return { text: 'Trivial', classList: `${baseClasses} bg-slate-200 dark:bg-slate-700/70 border-slate-500 dark:border-slate-500 text-slate-700 dark:text-slate-300` };
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
        intercomURL: '',
        slackURL: '',
        questionsAnswered: {},
        bugSummary: '',
        stepsToReproduce: '',
        expectedVsActual: '',
        calculatedScore: 0,
        priority: '',
        images: {},
        finalTemplateWithImages: ''
    });
    
    // Reset image counter
    imageCounter = 0;
    
    // Reset all form fields
    document.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(input => {
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
    }, 100);
});

/**
 * Adds image paste functionality to all textareas
 */
function addImagePasteSupport() {
    const textareas = ['bugSummary', 'stepsToReproduce', 'expectedVsActual'];
    
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
 * Inserts an image from a file into a textarea
 */
function insertImageFromFile(file, textarea) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const base64String = e.target.result;
        const fileName = file.name || 'pasted-image.png';
        
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
        showImagePasteFeedback(textarea);
    };
    
    reader.onerror = function() {
        console.error('Error reading image file');
        showImagePasteError(textarea);
    };
    
    reader.readAsDataURL(file);
}

/**
 * Shows feedback when an image is successfully pasted
 */
function showImagePasteFeedback(textarea) {
    const originalBorder = textarea.style.border;
    textarea.style.border = '2px solid #10b981';
    
    setTimeout(() => {
        textarea.style.border = originalBorder;
    }, 1000);
}

/**
 * Shows error feedback when image paste fails
 */
function showImagePasteError(textarea) {
    const originalBorder = textarea.style.border;
    textarea.style.border = '2px solid #ef4444';
    
    setTimeout(() => {
        textarea.style.border = originalBorder;
    }, 1000);
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
}

/**
 * Replaces image placeholders with full base64 markdown syntax
 */
function replaceImagePlaceholders(text) {
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