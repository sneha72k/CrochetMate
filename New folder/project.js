    import { supabase } from './supabase-config.js';

let currentUser = null;
let isSaving = false; 

// Variables for timer and counter
let sessionSeconds = 0; 
let totalSeconds = 0;   
let timerInterval = null;
let isRunning = false;
let currentStitchCount = 0;
let completedRows = 0;
let stitchPerRow = 0; 
let currentStep = 1;
// RUN ON LOAD: Check login and load project
document.addEventListener("DOMContentLoaded", async function() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = user;

    const currentId = localStorage.getItem("currentProjectId");
    const tempData = localStorage.getItem("tempProjectData");
    const swatchText = localStorage.getItem("incomingSwatchData"); // ADD THIS

    // 1. Load from DB first
    if (currentId) {
        await loadExistingProject(currentId);
    } else {
        const createdEl = document.getElementById("createdDateDisplay");
        const updatedEl = document.getElementById("updatedDateDisplay");
        if (createdEl) createdEl.style.display = "none";
        if (updatedEl) updatedEl.style.display = "none";
    }
    
    // 2. Overwrite with temp data if returning from Swatch Calc
    if (tempData) {
        const project = JSON.parse(tempData);
        
        if (document.getElementById("projectName")) document.getElementById("projectName").value = project.name || "";
        if (document.getElementById("yarnInput")) document.getElementById("yarnInput").value = project.yarn || "";
        if (document.getElementById("needleInput")) document.getElementById("needleInput").value = project.needle || "";
        if (document.getElementById("projectStatus")) document.getElementById("projectStatus").value = project.status || "";
        if (document.getElementById("craftType")) document.getElementById("craftType").value = project.craft_type || "";
        
        const notesBox = document.querySelector(".notes-box");
        if (notesBox) notesBox.innerText = project.notes || "";
        
        totalSeconds = project.total_seconds || 0;
        updateTotalDisplay();
        currentStitchCount = project.stitches || 0;
        completedRows = project.rows || 0;
        updateCounterUI();

        localStorage.removeItem("tempProjectData");
    }

    // 3. NEW: Check for Swatch Results and add to Notes
    if (swatchText) {
        const notesBox = document.querySelector(".notes-box");
        if (notesBox) {
            // Append the swatch text to whatever is already in the notes
            const currentNotes = notesBox.innerText.trim();
            notesBox.innerText = currentNotes + (currentNotes ? "\n\n" : "") + swatchText;
        }
        // Clear it so it doesn't keep adding every time you refresh
        localStorage.removeItem("incomingSwatchData");
    }
    
    displayUserProfile();
});

/* ========================================= */
/* 1. TIMER FUNCTIONALITY                    */
/* ========================================= */
function startTimer() {
    if (!isRunning) {
        isRunning = true;
        timerInterval = setInterval(() => {
            sessionSeconds++;
            updateSessionDisplay();
        }, 1000);
    }
}

function stopTimer() {
    isRunning = false;
    clearInterval(timerInterval);
}

function addToTotal() {
    stopTimer(); 
    totalSeconds += sessionSeconds;
    sessionSeconds = 0;
    updateSessionDisplay();
    updateTotalDisplay();
}

function resetSession() {
    stopTimer();
    sessionSeconds = 0;
    updateSessionDisplay();
}

function formatTime(totalSecs) {
    let hrs = Math.floor(totalSecs / 3600);
    let mins = Math.floor((totalSecs % 3600) / 60);
    let secs = totalSecs % 60;
    return (hrs < 10 ? "0" + hrs : hrs) + ":" +
           (mins < 10 ? "0" + mins : mins) + ":" +
           (secs < 10 ? "0" + secs : secs);
}

function updateSessionDisplay() {
    const el = document.getElementById("sessionTimerDisplay");
    if(el) el.innerText = formatTime(sessionSeconds);
}

function updateTotalDisplay() {
    let formatted = formatTime(totalSeconds);
    const el = document.getElementById("totalTimeDisplay");
    if(el) el.innerText = formatted;
}

/* ========================================= */
/* 2. NOTES & IMAGE UPLOAD LOGIC             */
/* ========================================= */
window.toggleImageDropdown = function(event) {
    if (event) event.stopPropagation();
    document.getElementById("imgDropdown").classList.toggle("show");
}

window.triggerFile = function() {
    document.getElementById("fileInput").click();
    window.toggleImageDropdown();
}

window.triggerCamera = function() {
    document.getElementById("cameraInput").click();
    window.toggleImageDropdown();
}

// Find this function in project.js and add the 'window.' prefix
window.displayImage = function(src) {
    const gallery = document.getElementById("imageGallery");
    const wrapper = document.createElement("div");
    wrapper.classList.add("image-wrapper");
    wrapper.style.position = "relative"; // Ensure delete button stays pinned to image

    const img = document.createElement("img");
    img.src = src;
    img.classList.add("uploaded-img");
    img.style.width = "80px";
    img.style.height = "80px";
    img.style.objectFit = "cover";
    img.onclick = function() { window.openImageModal(this.src); };

    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = "×"; 
    deleteBtn.classList.add("delete-image-btn");
    deleteBtn.style.position = "absolute";
    deleteBtn.style.top = "0";
    deleteBtn.style.right = "0";
    deleteBtn.onclick = function(e) {
        e.stopPropagation();
        wrapper.remove();
    };

    wrapper.appendChild(img);
    wrapper.appendChild(deleteBtn);
    gallery.appendChild(wrapper);
}

/* ========================================= */
/* 3. STITCH COUNTER LOGIC                   */
/* ========================================= */
function setStep(value, btnElement) {
    currentStep = value;
    const buttons = document.querySelectorAll('.step-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
}

function applyStep(direction) {
    modifyStitch(direction * currentStep);
}

function modifyStitch(delta) {
    currentStitchCount += delta;
    if (currentStitchCount < 0) currentStitchCount = 0;
    if (stitchPerRow > 0 && delta > 0) {
        while (currentStitchCount >= stitchPerRow) {
            currentStitchCount -= stitchPerRow; 
            completedRows += 1;                
        }
    }
    updateCounterUI();
}

function updateTarget() {
    const inputVal = document.getElementById("targetStitchesInput").value;
    stitchPerRow = parseInt(inputVal) || 0;
}

function resetCounter() {
    if(confirm("Reset stitch counter?")) {
        currentStitchCount = 0;
        completedRows = 0;
        updateCounterUI();
    }
}

function updateCounterUI() {
    const stitchEl = document.getElementById("stitchDisplay");
    const rowEl = document.getElementById("rowDisplay");
    if(stitchEl) stitchEl.innerText = currentStitchCount;
    if(rowEl) rowEl.innerText = completedRows;
}

/* ========================================= */
/* 4. LOAD & SAVE LOGIC (Database Sync)      */
/* ========================================= */
async function loadExistingProject(id) {
    const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !project) return;

    // Fill inputs
    document.getElementById("projectName").value = project.name || "";
    document.getElementById("yarnInput").value = project.yarn || "";
    document.getElementById("needleInput").value = project.needle || "";
    document.getElementById("projectStatus").value = project.status || "";
    if (document.getElementById("craftType")) {
        document.getElementById("craftType").value = project.craft_type || "";
    }

    const notesBox = document.querySelector(".notes-box");
    if (notesBox && project.notes) notesBox.innerText = project.notes;

    // Update displays
    totalSeconds = project.total_seconds || 0;
    updateTotalDisplay();
    currentStitchCount = project.stitches || 0;
    completedRows = project.rows || 0;
    updateCounterUI();

    if (project.thumbnail) {
        window.displayImage(project.thumbnail);
    }

    // Helper function for DD/MM/YYYY
    const formatToDMY = (dateString) => {
        if (!dateString) return "--/--/----";
        const d = new Date(dateString);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Update Date Displays
    const createdEl = document.getElementById("createdDateDisplay");
    const updatedEl = document.getElementById("updatedDateDisplay");

    if (createdEl && project.created_at) {
        createdEl.innerText = `CREATED: ${formatToDMY(project.created_at)}`;
    }

    if (updatedEl) {
        const dateToFormat = project.updated_at || project.created_at;
        updatedEl.innerText = `LAST UPDATED: ${formatToDMY(dateToFormat)}`;
    }   
}

function gatherProjectData() {
    const nameVal = document.getElementById("projectName").value.trim();
    return {
        user_id: currentUser.id,
        name: nameVal === "" ? "Untitled Project" : nameVal,
        yarn: document.getElementById("yarnInput").value.trim(),
        needle: document.getElementById("needleInput").value.trim(),
        status: document.getElementById("projectStatus").value,
        craft_type: document.getElementById("craftType") ? document.getElementById("craftType").value : "", 
        notes: document.querySelector(".notes-box").innerText,
        total_seconds: totalSeconds || 0, 
        stitches: currentStitchCount || 0,
        rows: completedRows || 0,
        thumbnail: getFirstImage() 
    };
}

async function saveToDatabase(data) {
    let currentId = localStorage.getItem("currentProjectId");
    if (currentId) data.id = currentId;

    const { data: savedData, error } = await supabase
        .from('projects')
        .upsert(data)
        .select()
        .single();

    if (error) throw error;
    return savedData.id;
}
async function uploadProjectImage(file) {
    const fileName = `project-${Date.now()}.png`;
    const { data, error } = await supabase.storage
        .from('project-images') // Make sure this bucket exists in Supabase!
        .upload(fileName, file);

    if (error) throw error;

    // Get the public URL to save in the database
    const { data: { publicUrl } } = supabase.storage
        .from('project-images')
        .getPublicUrl(data.path);

    return publicUrl;
}
window.saveProjectAndExit = async function(btnElement) {
    if (isSaving) return;
    isSaving = true;
    
    try {
        const fileInput = document.getElementById("fileInput");
        let imageUrl = getFirstImage(); // Existing logic

        // If a new file was actually selected in the input
        if (fileInput.files[0]) {
            imageUrl = await uploadProjectImage(fileInput.files[0]);
        }

        const data = gatherProjectData();
        data.thumbnail = imageUrl; // Update the thumbnail with the Bucket URL

        await saveToDatabase(data);
        window.location.href = "index.html";
    } catch (err) {
        console.error(err);
        alert("Upload failed. Check if your Bucket is public!");
        isSaving = false;
    }
}

window.saveAndGoToSwatch = function(btnElement) {
    const temporaryData = gatherProjectData();
    localStorage.setItem("tempProjectData", JSON.stringify(temporaryData));
    window.location.href = "swatch.html";
}

function getFirstImage() {
    const gallery = document.getElementById("imageGallery");
    if (gallery && gallery.querySelector("img")) {
        return gallery.querySelector("img").src;
    }
    return null;
}

/* ========================================= */
/* 5. USER PROFILE & WINDOW ATTACHMENTS      */
/* ========================================= */
async function displayUserProfile() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return;

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('email', user.email)
        .single();

    const nameEl = document.getElementById('user-display-name');
    const emailEl = document.getElementById('user-display-email');
    if (nameEl) nameEl.textContent = profile?.username || 'User';
    if (emailEl) emailEl.textContent = user.email;
}

window.handleLogout = async function(event) {
    if (event) event.preventDefault();
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.href = "login.html";
}

// Ensure all functions are globally accessible
window.startTimer = startTimer;
window.stopTimer = stopTimer;
window.addToTotal = addToTotal;
window.resetSession = resetSession;
window.setStep = setStep;
window.applyStep = applyStep;
window.updateTarget = updateTarget;
window.resetCounter = resetCounter;

window.cancelProject = function() {
    localStorage.removeItem("currentProjectId");
    localStorage.removeItem("tempProjectData");
    window.location.href = "index.html";
}

window.handleImageUpload = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            // This calls your existing displayImage function 
            // to show the image in the UI immediately
            window.displayImage(e.target.result);
        };
        
        reader.readAsDataURL(input.files[0]);
    }
};

window.openImageModal = function(src) {
    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("fullImageDisplay");
    modal.style.display = "flex";
    modalImg.src = src;
};

window.closeImageModal = function() {
    document.getElementById("imageModal").style.display = "none";
};

let currentZoom = 1; // Tracks the current scale level

window.adjustZoom = function(delta) {
    const modalImg = document.getElementById("fullImageDisplay");
    currentZoom += delta;
    
    // Safety: Don't let it get too small or ridiculously huge
    if (currentZoom < 0.5) currentZoom = 0.5;
    if (currentZoom > 5) currentZoom = 5;
    
    modalImg.style.transform = `scale(${currentZoom})`;
};

window.resetZoom = function() {
    currentZoom = 1;
    const modalImg = document.getElementById("fullImageDisplay");
    modalImg.style.transform = `scale(1)`;
};

window.closeImageModal = function() {
    document.getElementById("imageModal").style.display = "none";
    window.resetZoom(); // Always reset zoom when closing so the next image starts fresh
};

let isDragging = false;
let startX, startY, translateX = 0, translateY = 0;

window.openImageModal = function(src) {
    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("fullImageDisplay");
    modal.style.display = "flex";
    modalImg.src = src;
    
    // Reset positions every time a new image opens
    translateX = 0;
    translateY = 0;
    currentZoom = 1;
    updateImageTransform();
};

// Helper to combine Zoom and Pan into one CSS property
function updateImageTransform() {
    const modalImg = document.getElementById("fullImageDisplay");
    modalImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentZoom})`;
}

// Attach Mouse Events for Dragging
const modalImg = document.getElementById("fullImageDisplay");

modalImg.addEventListener('mousedown', (e) => {
    if (currentZoom <= 1) return; // Only drag if zoomed in
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    modalImg.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    updateImageTransform();
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    modalImg.style.cursor = 'grab';
});

// Update your existing Zoom function to use the new helper
window.adjustZoom = function(delta) {
    currentZoom += delta;
    if (currentZoom < 0.5) currentZoom = 0.5;
    if (currentZoom > 5) currentZoom = 5;
    updateImageTransform();
};

window.resetZoom = function() {
    currentZoom = 1;
    translateX = 0;
    translateY = 0;
    updateImageTransform();
};