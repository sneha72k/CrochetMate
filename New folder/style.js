import { supabase } from './supabase-config.js';

/* ========================================= */
/* 1. GLOBAL VARIABLES & SETUP               */
/* ========================================= */
let isDeleteMode = false;
let currentSort = 'newest'; // Default sort order
let currentUser = null;

// RUN ON LOAD: Check login and fetch projects
document.addEventListener("DOMContentLoaded", async function() {
    // 1. Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        window.location.href = 'login.html'; // Kick to login if not
        return;
    }
    currentUser = user;

    // 2. Load their projects
    loadProjects();

    // 3. ADD THIS LINE: Load the account card info
    displayUserProfile();
});

/* ========================================= */
/* 2. NAVIGATION & MENUS                     */
/* ========================================= */

// "New" Button: Clears session to start fresh
window.addNewProject = function() {
    localStorage.removeItem("currentProjectId"); 
    window.location.href = 'project.html';
}

// "Quick Calc" Button: Opens Swatch Calc in Scratchpad Mode
window.openQuickSwatch = function() {
    localStorage.removeItem("currentProjectId");
    window.location.href = "quickswatch.html";
}

// Changed from handleLogin to handleLogout
window.handleLogout = async function(event) {
    if(event) event.preventDefault();
    await supabase.auth.signOut();
    window.location.href = "login.html";
}

/* --- Sort Menu Functions --- */
window.toggleSortMenu = function() {
    const menu = document.getElementById("sortMenu");
    menu.classList.toggle("show");
}

window.applySort = function(sortType) {
    currentSort = sortType; // Update global variable
    loadProjects();         // Refresh grid
    document.getElementById("sortMenu").classList.remove("show"); // Close menu
}

// Close Dropdowns if clicking outside
window.onclick = function(event) {
    if (!event.target.matches('.action-btn')) {
        const menus = document.getElementsByClassName("dropdown-menu");
        for (let i = 0; i < menus.length; i++) {
            if (menus[i].classList.contains('show')) {
                menus[i].classList.remove('show');
            }
        }
    }
}

/* ========================================= */
/* 3. LOAD PROJECTS (Render Grid)            */
/* ========================================= */
async function loadProjects() {
    const grid = document.getElementById("gridContainer");
    const emptyState = document.getElementById("emptyState");
    
    if (!grid || !emptyState) return;

    // 1. Show a simple loader in the grid area while fetching
    grid.innerHTML = "<p style='padding:20px; font-family:Sansita;'>Loading projects...</p>";

    // 2. Fetch projects only for the logged-in user
    const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', currentUser.id);

    if (error) {
        console.error("Error loading projects:", error);
        grid.innerHTML = "<p style='padding:20px; color:red;'>Failed to load projects.</p>";
        return;
    }

    // 3. TOGGLE VISIBILITY BASED ON DATA
    if (!projects || projects.length === 0) {
        // Show Welcome Text, Hide Grid
        emptyState.style.display = "flex";
        grid.style.display = "none";
        return; 
    } else {
        // Hide Welcome Text, Show Grid
        emptyState.style.display = "none";
        grid.style.display = "grid";
        grid.innerHTML = ""; // Clear the loader
    }

    // 4. SORTING LOGIC
    if (currentSort === 'newest') {
        projects.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (currentSort === 'oldest') {
        projects.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (currentSort === 'az') {
        projects.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (currentSort === 'za') {
        projects.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    } else if (currentSort === 'status') {
        // Planning (1) is smallest -> shows first
        // Ongoing (2) is middle
        // Done (3) is largest -> shows last
        const statusMap = { 
            "planning": 1, 
            "ongoing": 2, 
            "done": 3 
        };

        projects.sort((a, b) => {
            // Clean up the data from the database (lowercase and remove spaces)
            const statA = (a.status || "planning").toLowerCase().trim();
            const statB = (b.status || "planning").toLowerCase().trim();
            
            const valA = statusMap[statA] || 4; 
            const valB = statusMap[statB] || 4;
            
            return valA - valB; 
        });
    }

    // 5. RENDER CARDS
    projects.forEach(proj => {
        const card = document.createElement("div");
        card.classList.add("project-card");

        // Determine Status Color based on your Plum/Rose palette
        let statusColor = "#4A4447"; // Default Charcoal
        const s = (proj.status || "").toLowerCase();
        if (s === "done") statusColor = "#28a745"; 
        if (s === "ongoing") statusColor = "#5a174c";

        card.innerHTML = `
            <input type="checkbox" class="delete-checkbox" value="${proj.id}">
            <div class="card-content">
                <h3 class="card-title">${proj.name || "Untitled Project"}</h3>
                <p class="card-type">${proj.craft_type || "No Type Set"}</p>
                <p class="card-status-label" style="color: ${statusColor}">
                    ${proj.status || "Planning"}
                </p>
            </div>
        `;
        
        card.onclick = function(e) {
            if (isDeleteMode) {
                const checkbox = card.querySelector(".delete-checkbox");
                if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
                if (checkbox.checked) card.classList.add("selected");
                else card.classList.remove("selected");
                return;
            }
            localStorage.setItem("currentProjectId", proj.id);
            window.location.href = "project.html";
        };

        grid.appendChild(card);
    });
}

/* ========================================= */
/* 4. DELETE MODE LOGIC                      */
/* ========================================= */
window.toggleDeleteMode = async function(btnElement) {
    const grid = document.querySelector(".project-grid");
    
    if (!isDeleteMode) {
        // ENABLE DELETE MODE
        isDeleteMode = true;
        grid.classList.add("delete-active");
        btnElement.innerText = "Confirm Delete";
        btnElement.style.background = "#ff4444";
        btnElement.style.color = "white";
    } else {
        // EXECUTE DELETE
        const checkboxes = document.querySelectorAll(".delete-checkbox:checked");
        
        if (checkboxes.length > 0) {
            // Simple confirmation logic
                btnElement.innerText = "Deleting...";
                
                // Get all checked IDs
                const idsToDelete = Array.from(checkboxes).map(cb => cb.value);
                
                // ==========================================
                // NEW: DELETE IMAGES FROM BUCKET FIRST
                // ==========================================
                try {
                    // 1. Find the thumbnails for the projects we are deleting
                    const { data: projectsToDelete } = await supabase
                        .from('projects')
                        .select('thumbnail')
                        .in('id', idsToDelete);

                    // 2. Extract the file paths from the full URLs
                    if (projectsToDelete) {
                        const filePaths = [];
                        projectsToDelete.forEach(p => {
                            if (p.thumbnail) {
                                const urlParts = p.thumbnail.split('/public/project-images/');
                                if (urlParts.length > 1) {
                                    filePaths.push(urlParts[1]); // e.g., "user_id/timestamp.jpg"
                                }
                            }
                        });

                        // 3. Delete all those files from the Supabase bucket
                        if (filePaths.length > 0) {
                            const { error: storageError } = await supabase.storage
                                .from('project-images')
                                .remove(filePaths);
                            
                            if (storageError) console.error("Bucket delete error:", storageError);
                        }
                    }
                } catch (err) {
                    console.error("Error cleaning up images:", err);
                }
                // ==========================================

                // Tell Supabase to delete the rows from the database
                const { error } = await supabase
                    .from('projects')
                    .delete()
                    .in('id', idsToDelete);

                if (error) {
                    console.error("Error deleting:", error);
                    alert("Error deleting projects!");
                } else {
                    await loadProjects(); // Refresh grid from database
                }
            
        }

        // RESET UI
        isDeleteMode = false;
        grid.classList.remove("delete-active");
        btnElement.innerText = "Delete";
        btnElement.style.background = "";
        btnElement.style.color = "";
        
        // Clear selection visuals
        document.querySelectorAll(".project-card").forEach(c => c.classList.remove("selected"));
    }
}
/* ========================================= */
/* 5. USER PROFILE LOGIC                     */
/* ========================================= */
async function displayUserProfile() {
    // 1. Get the current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return;

    // 2. Fetch the username from your custom user_profiles table
    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('email', user.email)
        .single();

    if (profileError) console.error("Error fetching profile:", profileError);

    // --- Update Hover Card (Index Page) ---
    const nameEl = document.getElementById('user-display-name');
    const emailEl = document.getElementById('user-display-email');
    if (nameEl) nameEl.textContent = profile?.username || 'User';
    if (emailEl) emailEl.textContent = user.email;

    // --- Update Main Account Page (Account Page) ---
    const accName = document.getElementById('acc-username');
    const accEmail = document.getElementById('acc-email');
    const accDate = document.getElementById('acc-date');
    const accProjectCount = document.getElementById('acc-project-count');

    if (accName) accName.textContent = profile?.username || 'User';
    if (accEmail) accEmail.textContent = user.email;
    
    // Format and display the Join Date
    if (accDate) {
        const date = new Date(user.created_at).toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        accDate.textContent = date;
    }

    // Dynamic Project Count (Only runs if the element exists on the current page)
    if (accProjectCount) {
        const { count, error: countError } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true });

        if (!countError) {
            accProjectCount.textContent = count;
        } else {
            console.error("Error fetching project count:", countError);
            accProjectCount.textContent = "0";
        }
    }
}