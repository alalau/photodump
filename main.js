import * as THREE from 'three';

// Setup basic scene, camera, and renderer
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // Pure black

// Add subtle fog to fade out distant geometry
scene.fog = new THREE.FogExp2(0x000000, 0.025);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 18;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // optimize pixel ratio
container.appendChild(renderer.domElement);

// Zoom and Raycaster State
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let zoomedMesh = null;
let backgroundFade = 0;
let mouseDownPos = { x: 0, y: 0 };

const uiContainer = document.getElementById('ui-container');
const loader = document.getElementById('loader');
const loaderCircle = document.getElementById('loader-circle');
const circumference = 2 * Math.PI * 47; // Radius is 47

// Loading Manager for elegant entry
THREE.DefaultLoadingManager.onStart = () => {
    if (loaderCircle) loaderCircle.style.strokeDashoffset = circumference;
};

THREE.DefaultLoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
    if (!itemsTotal) return;
    const progress = itemsLoaded / itemsTotal;
    if (loaderCircle) {
        const offset = circumference - (progress * circumference);
        loaderCircle.style.strokeDashoffset = offset;
    }
};

THREE.DefaultLoadingManager.onLoad = () => {
    setTimeout(() => {
        if (loader) loader.classList.add('fade-out');
        if (uiContainer) uiContainer.classList.add('visible');
        if (container) container.classList.add('visible');
        
        // Remove loader from DOM after transition
        setTimeout(() => {
            if (loader) loader.remove();
        }, 1000);
    }, 500);
};

function setZoomMesh(mesh) {
    if (zoomedMesh && mesh && mesh !== zoomedMesh) {
        // Hard jump cut! Instantly drop the old mesh and instantly pop the new mesh
        zoomedMesh.userData.zoomProgress = 0;
        zoomedMesh.userData.wasZoomed = false;

        zoomedMesh = mesh;

        zoomedMesh.userData.zoomProgress = 1;
        zoomedMesh.userData.wasZoomed = true;
    } else {
        zoomedMesh = mesh;
    }

    // Toggle the CSS visual state cleanly 
    uiContainer.classList.toggle('is-zoomed', !!zoomedMesh);
}

// Custom Controls state for panning the grid
let targetScrollX = 0;
let targetScrollY = 0;
let currentScrollX = 0;
let currentScrollY = 0;

let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

const isMobile = window.matchMedia("(pointer: coarse)").matches;
const DRAG_SENSITIVITY = isMobile ? 0.15 : 0.05;
const ZOOM_SPEED = isMobile ? 14.0 : 14.0; // Triples the transition velocity on touchscreens organically!
const clock = new THREE.Clock();

// Trackpad and Mouse Wheel panning using native continuous inputs
window.addEventListener('wheel', (event) => {
    // If the album menu is active, immediately exit and yield scrolling to the browser natively!
    const albumMenu = document.getElementById('album-menu');
    if (albumMenu && albumMenu.classList.contains('is-open')) return;

    event.preventDefault(); // Prevents browser swipe navigation 

    if (zoomedMesh) return; // Freeze panning if visually zoomed in

    // Reverse orientation matching exact user request parameters 
    targetScrollX -= event.deltaX * 0.05;
    targetScrollY += event.deltaY * 0.05;
}, { passive: false });

// Mobile Touch and Mouse Drag Logic universally utilizing Pointer Events
window.addEventListener('pointerdown', (event) => {
    if (event.target.tagName === 'BUTTON' || event.target.closest('#menu-btn-container') || event.target.closest('#album-menu')) return; // Disable dragging physically from atop UI

    isDragging = true;
    previousMousePosition = { x: event.clientX, y: event.clientY };
    mouseDownPos = { x: event.clientX, y: event.clientY }; // Store initial down coordinate
});

window.addEventListener('pointermove', (event) => {
    if (isDragging && !zoomedMesh) {
        const deltaX = event.clientX - previousMousePosition.x;
        const deltaY = event.clientY - previousMousePosition.y;

        targetScrollX += deltaX * DRAG_SENSITIVITY;
        targetScrollY -= deltaY * DRAG_SENSITIVITY;

        previousMousePosition = { x: event.clientX, y: event.clientY };
    } else if (isDragging && zoomedMesh && isMobile) {
        // If they drag while zoomed in on mobile, instantly exit zoom for a tactile swipe-to-dismiss feel!
        const dist = Math.hypot(event.clientX - mouseDownPos.x, event.clientY - mouseDownPos.y);
        if (dist > 15) { // Needs a tiny threshold to prevent accidental finger jitters
            setZoomMesh(null);
            isDragging = false; // Cancel drag so it doesn't accidentally pan the background grid 
        }
    }
});

// Detect Click to Zoom In / Zoom Out
window.addEventListener('pointerup', (event) => {
    isDragging = false;

    // Ignore clicks that landed directly on our UI buttons, menus, or overlays
    if (event.target.tagName === 'BUTTON' || event.target.closest('#menu-btn-container') || event.target.closest('#album-menu') || event.target.closest('#artist-statement') || event.target.closest('#scrim') || event.target.closest('.nav-btn-container')) return;

    // Calculate distance the mouse travelled while held down
    const dist = Math.hypot(event.clientX - mouseDownPos.x, event.clientY - mouseDownPos.y);

    // If movement was negligible, count it as a click
    if (dist < 5) {
        if (zoomedMesh) {
            setZoomMesh(null); // Zoom back out
        } else {
            // Calculate coordinates for raycaster
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1; // Negative because WebGL Y originates at bottom

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(planes);

            if (intersects.length > 0) {
                setZoomMesh(intersects[0].object);
            }
        }
    } else {
        // Fallback for extremely fast swipes where pointerup fires before pointermove threshold was crossed natively
        if (zoomedMesh && isMobile) {
            setZoomMesh(null);
        }
    }
});

// Custom Cursor Global Tracking Loop
const customCursor = document.getElementById('custom-cursor');
window.addEventListener('pointermove', (event) => {
    // Utilize native GPU transform vectors rather than DOM top/left positions to guarantee zero latency layout jitter
    if (typeof customCursor !== 'undefined' && customCursor) customCursor.style.transform = `translate3d(calc(${event.clientX}px - 50%), calc(${event.clientY}px - 50%), 0)`;
});

function handleCycle(key) {
    if (!zoomedMesh) return;

    let targetI = zoomedMesh.userData.gridI;
    let targetJ = zoomedMesh.userData.gridJ;

    if (key === 'ArrowLeft') {
        targetI = (targetI - 1 + cols) % cols;
        targetScrollX += cellWidth; // Pan grid right physically
    } else if (key === 'ArrowRight') {
        targetI = (targetI + 1) % cols;
        targetScrollX -= cellWidth; // Pan grid left physically
    } else if (key === 'ArrowUp') {
        targetJ = (targetJ + 1) % rows;
        targetScrollY -= cellHeight; // Pan grid down physically
    } else if (key === 'ArrowDown') {
        targetJ = (targetJ - 1 + rows) % rows;
        targetScrollY += cellHeight; // Pan grid up physically
    } else if (key === 'Escape') {
        setZoomMesh(null); // zoom out
        return;
    } else {
        return; // ignore other keys
    }

    const nextMesh = planes.find(m => m.userData.gridI === targetI && m.userData.gridJ === targetJ);
    if (nextMesh) {
        setZoomMesh(nextMesh);
    }
}

// Arrow Keys to Cycle Zoom
window.addEventListener('keydown', (event) => {
    handleCycle(event.key);
});

// UI Buttons to Cycle Zoom
// Map explicit interaction logic mapping exactly to the padded outer DOM containers 
document.querySelector('.nav-btn-container.left').addEventListener('click', (event) => {
    event.stopPropagation();
    handleCycle('ArrowLeft');
});
document.querySelector('.nav-btn-container.right').addEventListener('click', (event) => {
    event.stopPropagation();
    handleCycle('ArrowRight');
});

// Menu and Artist Statement Overlay Control
const menuBtn = document.getElementById('menu-btn-container');
const albumMenu = document.getElementById('album-menu');
const scrim = document.getElementById('scrim');
const artistStatement = document.getElementById('artist-statement');
const pageTitleContainer = document.querySelector('.page-title-container');

pageTitleContainer.addEventListener('click', (event) => {
    event.stopPropagation();
    
    // Close album menu if open
    albumMenu.classList.remove('is-open');
    
    const isOpen = artistStatement.classList.toggle('is-open');
    scrim.classList.toggle('is-open', isOpen);
    menuBtn.classList.toggle('is-active', isOpen);
});

// Prevent pointer events from bubbling to the window raycaster
pageTitleContainer.addEventListener('pointerdown', (e) => e.stopPropagation());
pageTitleContainer.addEventListener('pointerup', (e) => e.stopPropagation());

menuBtn.addEventListener('click', (event) => {
    event.stopPropagation(); // Avoid raycaster triggering
    
    if (artistStatement.classList.contains('is-open')) {
        artistStatement.classList.remove('is-open');
        scrim.classList.remove('is-open');
        menuBtn.classList.remove('is-active');
    } else {
        const isOpen = albumMenu.classList.toggle('is-open');
        scrim.classList.toggle('is-open', isOpen);
        menuBtn.classList.toggle('is-active', isOpen);
    }
});

scrim.addEventListener('click', () => {
    albumMenu.classList.remove('is-open');
    artistStatement.classList.remove('is-open');
    scrim.classList.remove('is-open');
    menuBtn.classList.remove('is-active');
});

albumMenu.addEventListener('click', (event) => {
    // Determine if the click landed on the empty background flex space rather than specific list items
    if (event.target === albumMenu || event.target.tagName === 'UL') {
        albumMenu.classList.remove('is-open');
        scrim.classList.remove('is-open');
        menuBtn.classList.remove('is-active');
    }
});

artistStatement.addEventListener('click', (event) => {
    // Close if clicking the background flex space
    if (event.target === artistStatement) {
        artistStatement.classList.remove('is-open');
        scrim.classList.remove('is-open');
        menuBtn.classList.remove('is-active');
    }
});

// Hide custom cursor gracefully when overlapping the button container 
menuBtn.addEventListener('mouseenter', () => { if (typeof customCursor !== 'undefined' && customCursor) customCursor.classList.add('hidden') });
menuBtn.addEventListener('mouseleave', () => { if (typeof customCursor !== 'undefined' && customCursor) customCursor.classList.remove('hidden') });

const navContainers = document.querySelectorAll('.nav-btn-container');
navContainers.forEach(container => {
    container.addEventListener('mouseenter', () => { if (typeof customCursor !== 'undefined' && customCursor) customCursor.classList.add('hidden') });
    container.addEventListener('mouseleave', () => { if (typeof customCursor !== 'undefined' && customCursor) customCursor.classList.remove('hidden') });
});

window.addEventListener('pointerleave', () => { isDragging = false; });
window.addEventListener('pointercancel', () => { isDragging = false; }); // Handles native browser touch interruptions

// zoom factor
const zoom = 2

// --- TINKER HERE ---
// Gutter / Gap Configuration
// Adjust this value (from 0.0 to 1.0) to change the visible gap between photos.
// 1.0 = No gaps, photos touch edge-to-edge
// 0.85 = 15% margin around the photo cell
// 0.5 = Huge gaps, photos are half the cell size
const photoScaleFactor = 0.85;

// Bulbous / Fisheye Effect Configuration
// Adjust this to control how much the grid bends away at the edges
// 0.0 = Perfectly flat
// 0.015 = Gentle cinematic curve
// 0.04 = Extreme fisheye bubble
const bulbousAmount = 0;

// Random Depth Variation
// Adds dynamic back-and-forth Z-axis staggering so the grid looks layered and 3D
// 0.0 = completely flat against the bulbous curve
// 2.0 = medium depth variation
// 5.0 = extreme flying-through-space staggering
const randomDepthAmount = 1.0;

// The Infinite Grid Configuration
const cols = 20; // Number of columns in our grid chunk
const rows = 12; // Number of rows in our grid chunk
const cellWidth = 3 * zoom;
const cellHeight = 5 * zoom;
const totalWidth = cols * cellWidth;
const totalHeight = rows * cellHeight;

let currentAlbum = 'All photos';
let allAlbums = []; // will be populated from albums.json
let albumPhotosMap = {}; // Cache to store photo lists
let globalManifest = null; // Will store the production-safe manifest.json

const textureLoader = new THREE.TextureLoader();
// Start with a dummy texture to avoid modulo by zero during initial grid generation
let textures = [new THREE.Texture()];

async function fetchPhotosForAlbum(albumName) {
    if (albumPhotosMap[albumName]) return albumPhotosMap[albumName];

    // Production-safe method: Use manifest.json if available
    if (globalManifest && globalManifest[albumName]) {
        const photos = globalManifest[albumName].map(file => `albums/${albumName}/${file}`);
        albumPhotosMap[albumName] = photos;
        return photos;
    }

    // Local-only fallback: Parse directory listing HTML
    try {
        const response = await fetch(`albums/${albumName}/`);
        if (!response.ok) return [];
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = doc.querySelectorAll('a');
        const photos = [];
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.match(/\.(jpe?g|png|gif|webp)$/i)) {
                // Ensure we don't double-prefix if the link is relative
                const cleanHref = href.split('/').pop();
                photos.push(`albums/${albumName}/${cleanHref}`);
            }
        });
        albumPhotosMap[albumName] = photos;
        return photos;
    } catch (e) {
        console.warn(`Could not load directory listing for ${albumName}.`, e);
        return [];
    }
}

async function getAllPhotoUrls() {
    let urls = [];
    const promises = allAlbums.map(album => fetchPhotosForAlbum(album));
    await Promise.all(promises);
    allAlbums.forEach(album => {
        urls.push(...(albumPhotosMap[album] || []));
    });
    // Shuffle to mix the albums
    urls.sort(() => Math.random() - 0.5);
    return urls;
}

async function loadAlbumImages(albumName) {
    currentAlbum = albumName;

    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        pageTitle.textContent = albumName === 'All photos' ? 'Automatic' : albumName;
    }

    let newUrls = [];

    if (albumName === 'All photos') {
        newUrls = await getAllPhotoUrls();
    } else {
        newUrls = await fetchPhotosForAlbum(albumName);
    }

    if (newUrls.length === 0) {
        console.warn("No photos found. If this is a live server, directory listing may be disabled.");
        // Fail-safe: Reveal the site anyway so it's not stuck on a black screen
        setTimeout(() => {
            if (loader) loader.classList.add('fade-out');
            if (uiContainer) uiContainer.classList.add('visible');
            if (container) container.classList.add('visible');
        }, 500);
        return;
    }

    const newTextures = newUrls.map(url => {
        const tex = textureLoader.load(url);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    });

    textures.forEach(tex => tex.dispose());
    textures = newTextures;

    // Dynamically calculate a prime multiplier dynamically guaranteed to be coprime natively with the arbitrary dynamic photo count
    const primes = [17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
    const safeOffsetPrime = primes.find(p => textures.length % p !== 0) || 17;

    let index = 0;
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            // Apply mathematically dynamic coprime to distribute natively and infinitely cleanly independent of arbitrary dataset sizes
            const textureIndex = (i * safeOffsetPrime + j) % textures.length;
            const mesh = planes[index];
            if (mesh) {
                mesh.material.map = textures[textureIndex];
                mesh.material.needsUpdate = true;
            }
            index++;
        }
    }
}

const planes = [];

// Group to hold the grid items
const gridGroup = new THREE.Group();
scene.add(gridGroup);

// Geometry used for rendering the photos, scaled down by our gap factor
const planeGeo = new THREE.PlaneGeometry(cellWidth * photoScaleFactor, cellHeight * photoScaleFactor);

// Generate flat grid of Quads mapped to photos
for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
        const textureIndex = (i * 17 + j) % textures.length;
        const material = new THREE.MeshBasicMaterial({
            map: textures[textureIndex],
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1
        });

        const mesh = new THREE.Mesh(planeGeo, material);

        // Base starting position of the quad
        const baseX = (i - cols / 2) * cellWidth;
        const baseY = (j - rows / 2) * cellHeight;

        // Save base coordinates to dynamically wrap them later
        mesh.userData.baseX = baseX;
        mesh.userData.baseY = baseY;
        mesh.userData.gridI = i;
        mesh.userData.gridJ = j;
        mesh.userData.zoomProgress = 0;

        // Generate and store a static random depth offset for this cell
        mesh.userData.randomZ = (Math.random() - 0.5) * 2 * randomDepthAmount;

        mesh.position.set(baseX, baseY, 0);

        gridGroup.add(mesh);
        planes.push(mesh);
    }
}

// Render Loop
function animate() {
    requestAnimationFrame(animate);

    const dt = clock.getDelta(); // Frame-independent timing dynamically natively scaling physics

    // Math.exp handles mathematically perfect smoothing irrespective of frame rate!
    const scrollLerp = 1 - Math.exp(-3.0 * dt);  // Maps to approx original 0.05 at 60fps
    const zoomLerp = 1 - Math.exp(-ZOOM_SPEED * dt);    // Maps to approx original 0.1 at 60fps

    // Smooth panning dampening natively uncoupled from refresh delays 
    currentScrollX += (targetScrollX - currentScrollX) * scrollLerp;
    currentScrollY += (targetScrollY - currentScrollY) * scrollLerp;

    // Global background fade dampening
    const targetFade = zoomedMesh ? 1 : 0;
    backgroundFade += (targetFade - backgroundFade) * zoomLerp;

    // Apply logic to every plane
    for (const mesh of planes) {
        // Calculate the underlying infinite grid position
        let newX = (mesh.userData.baseX + currentScrollX) % totalWidth;
        let newY = (mesh.userData.baseY + currentScrollY) % totalHeight;

        if (newX < -totalWidth / 2) newX += totalWidth;
        else if (newX > totalWidth / 2) newX -= totalWidth;

        if (newY < -totalHeight / 2) newY += totalHeight;
        else if (newY > totalHeight / 2) newY -= totalHeight;

        // Foundational spatial states (mapped flat X/Y, pushed back Z in parabola, with random depth stagger)
        let targetX = newX;
        let targetY = newY;
        let targetZ = -(newX * newX + newY * newY) * (bulbousAmount / 2) + mesh.userData.randomZ;

        let targetRotX = newY * bulbousAmount;
        let targetRotY = -newX * bulbousAmount;

        let targetScaleX = 1;
        let targetScaleY = 1;

        // Compute aspect ratio FIT scales natively inside the cell
        const tex = mesh.material.map;
        if (tex && tex.image) {
            const imageAspect = tex.image.width / tex.image.height;
            const planeAspect = cellWidth / cellHeight;
            if (imageAspect > planeAspect) {
                targetScaleY = (1 / imageAspect) * planeAspect;
            } else {
                targetScaleX = imageAspect / planeAspect;
            }
        }

        // --- ZOOM INTERSECTION INTERPOLATION ---
        const isTarget = (mesh === zoomedMesh);

        // Handle individual lerp progress mathematically
        const targetZoomState = isTarget ? 1 : 0;
        mesh.userData.zoomProgress += (targetZoomState - mesh.userData.zoomProgress) * zoomLerp;
        const zp = mesh.userData.zoomProgress;

        // Background Opacity Fading
        if (zp < 0.01) {
            mesh.material.opacity = 1 - backgroundFade;
            mesh.renderOrder = 0;
        } else {
            mesh.material.opacity = 1;
        }

        if (zp > 0.001) {
            // Determine coordinate positioning right near the camera to FILL the screen
            const depthDistance = 8;
            const screenTargetZ = camera.position.z - depthDistance;

            // Calculate screen view bounds at our depth plane distance
            const vFov = THREE.MathUtils.degToRad(camera.fov);
            const screenH = 2 * Math.tan(vFov / 2) * depthDistance;
            const screenW = screenH * camera.aspect;

            // Actual physical plane base size (accounting for grid gap sizing configs + aspect FIT scales)
            const meshBaseW = cellWidth * photoScaleFactor * targetScaleX;
            const meshBaseH = cellHeight * photoScaleFactor * targetScaleY;

            // Scale multiplier to 'Contain' or 'Fit' the entire screen viewport dynamically 
            // Min forces the image to scale exactly until it touches the nearest screen edge without overflowing
            const scaleMult = Math.min(screenW / meshBaseW, screenH / meshBaseH);

            // Execute linear interpolation using THREE.MathUtils.lerp dynamically
            targetX = THREE.MathUtils.lerp(targetX, camera.position.x, zp);
            targetY = THREE.MathUtils.lerp(targetY, camera.position.y, zp);
            targetZ = THREE.MathUtils.lerp(targetZ, screenTargetZ, zp);

            targetRotX = THREE.MathUtils.lerp(targetRotX, 0, zp);
            targetRotY = THREE.MathUtils.lerp(targetRotY, 0, zp);

            targetScaleX = THREE.MathUtils.lerp(targetScaleX, targetScaleX * scaleMult, zp);
            targetScaleY = THREE.MathUtils.lerp(targetScaleY, targetScaleY * scaleMult, zp);

            // Layer priority adjustment to float this above other grid elements while transitioning
            mesh.renderOrder = 10;
        }

        // Output Final State calculations
        mesh.position.set(targetX, targetY, targetZ);
        mesh.rotation.x = targetRotX;
        mesh.rotation.y = targetRotY;
        mesh.scale.set(targetScaleX, targetScaleY, 1);
    }

    renderer.render(scene, camera);
}

// --- INK BLEED HOVER EFFECT EXPERT REFACTOR ---

// Timing & Configuration
const INK_BLEED_DURATION_MS = 350;   // Duration in milliseconds to fully bleed outwards when hovered
const INK_BLEED_SHRINK_SPEED = 1.0;  // Multiplier for how much faster it shrinks back when mouse leaves (e.g. 2x)

const blurVw = isMobile ? 4 : 0.5;  // Maximum blob expansion (size of bleed), cranked up for mobile
const scaleVw = isMobile ? 1 : 0.3; // Maximum displacement (roughness of edges), cranked up for mobile

function initInkBleed() {
    const svgDefs = document.querySelector('svg defs');
    const textEls = document.querySelectorAll('#album-menu li');

    textEls.forEach((textEl, index) => {
        // 1. Generate mathematically unique isolated filter IDs for every single DOM element
        const filterId = `ink-bleed-${index}`;

        // 2. Clone the core SVG pipeline algorithm uniquely allowing parallel visual interpolations
        const filterHTML = `
        <filter id="${filterId}" color-interpolation-filters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.01" result="blur" id="bleed-blur-${index}" />
            <feColorMatrix in="blur" mode="matrix" values="
                1 0 0 0 0  
                0 1 0 0 0  
                0 0 1 0 0  
                0 0 0 30 -10" result="goo" />
            <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="4" result="noise" />
            <feDisplacementMap in="goo" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" result="blob" id="bleed-disp-${index}" />
        </filter>
    `;

        svgDefs.insertAdjacentHTML('beforeend', filterHTML);

        // 3. Extract the isolated DOM objects exclusively for this list item
        const blurEl = document.getElementById(`bleed-blur-${index}`);
        const dispEl = document.getElementById(`bleed-disp-${index}`);

        let currentProgress = 0;
        let targetProgress = 0;
        let isAnimatingFilter = false;

        function updateInk() {
            if (currentProgress === targetProgress) {
                isAnimatingFilter = false;
                if (currentProgress === 0) {
                    // Instantly dismount it identically when fully hidden to preserve GPU rendering performance!
                    textEl.style.filter = 'none';
                }
                return;
            }

            // Calculate step amount based on standard 60 FPS requestAnimationFrame delta mapping (16.67ms per frame)
            const frameStepAmt = 16.67 / INK_BLEED_DURATION_MS;

            if (targetProgress === 1) {
                currentProgress = Math.min(currentProgress + frameStepAmt, 1);
            } else {
                currentProgress = Math.max(currentProgress - (frameStepAmt * INK_BLEED_SHRINK_SPEED), 0);
            }

            const maxBlur = (window.innerWidth / 100) * blurVw;
            const maxScale = (window.innerWidth / 100) * scaleVw;

            const visualProgress = 1 - Math.pow(1 - currentProgress, 3);

            blurEl.setAttribute('stdDeviation', Math.max(visualProgress * maxBlur, 0.01));
            dispEl.setAttribute('scale', visualProgress * maxScale);

            requestAnimationFrame(updateInk);
        }

        textEl.addEventListener('mouseenter', () => {
            // Mount it forcefully right before loop engages
            textEl.style.filter = `url('#${filterId}')`;
            targetProgress = 1;

            if (!isAnimatingFilter) {
                isAnimatingFilter = true;
                requestAnimationFrame(updateInk);
            }
        });

        textEl.addEventListener('mouseleave', () => {
            targetProgress = 0;

            if (!isAnimatingFilter) {
                isAnimatingFilter = true;
                requestAnimationFrame(updateInk);
            }
        });
    });
}

// Dynamic Folder Indexing natively mapped from HTTP directory intercepts
async function loadAlbums() {
    try {
        const response = await fetch('albums/albums.json');
        if (!response.ok) throw new Error('Failed to load albums configuration JSON');

        allAlbums = await response.json();

        // Load the production manifest if it exists
        try {
            const manifestResponse = await fetch('albums/manifest.json');
            if (manifestResponse.ok) {
                globalManifest = await manifestResponse.json();
            }
        } catch (e) {
            console.warn("No manifest.json found, falling back to directory listing.");
        }
        const albumList = document.getElementById('album-list');

        function closeMenu() {
            const albumMenu = document.getElementById('album-menu');
            const scrim = document.getElementById('scrim');
            const menuBtn = document.getElementById('menu-btn-container');
            if (albumMenu) albumMenu.classList.remove('is-open');
            if (scrim) scrim.classList.remove('is-open');
            if (menuBtn) menuBtn.classList.remove('is-active');
        }

        let isClosing = false;

        const handleAlbumClick = (folderName, liElement) => {
            if (isClosing) return;

            if (isMobile) {
                isClosing = true;
                // Force the hover state animation to bloom fully on touchscreens
                liElement.dispatchEvent(new Event('mouseenter'));

                // Wait for the ink bleed animation to fully finish before freezing the thread with heavy WebGL allocations
                setTimeout(() => {
                    loadAlbumImages(folderName);
                }, 350);

                // Delay the menu dismissal just slightly longer so the massive texture allocation happens securely behind the overlay
                setTimeout(() => {
                    closeMenu();
                    liElement.dispatchEvent(new Event('mouseleave')); // Reset for next time
                    isClosing = false;
                }, 400);
            } else {
                loadAlbumImages(folderName);
                closeMenu();
            }
        };

        // Attach listener to the static "All photos" li element
        const allPhotosLi = albumList.querySelector('li');
        if (allPhotosLi) {
            allPhotosLi.dataset.folder = 'All photos';
            allPhotosLi.addEventListener('click', () => handleAlbumClick('All photos', allPhotosLi));
        }

        allAlbums.forEach(folderName => {
            if (folderName) {
                const li = document.createElement('li');
                li.textContent = folderName;
                li.dataset.folder = folderName;
                li.addEventListener('click', () => handleAlbumClick(folderName, li));
                albumList.appendChild(li);
            }
        });

        // Mobile Scrubbing Interaction Logic
        if (isMobile) {
            const albumMenuNode = document.getElementById('album-menu');
            let currentHoveredLi = null;

            albumMenuNode.addEventListener('touchstart', (e) => {
                // Do NOT prevent default here so native scrolling remains fully functional
                const touch = e.touches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('li');
                if (target) {
                    currentHoveredLi = target;
                    currentHoveredLi.dispatchEvent(new Event('mouseenter'));
                }
            }, { passive: true });

            albumMenuNode.addEventListener('touchmove', (e) => {
                // Do NOT prevent default here so native scrolling remains fully functional
                const touch = e.touches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('li');

                if (target) {
                    if (target !== currentHoveredLi) {
                        if (currentHoveredLi) currentHoveredLi.dispatchEvent(new Event('mouseleave'));
                        currentHoveredLi = target;
                        currentHoveredLi.dispatchEvent(new Event('mouseenter'));
                    }
                } else {
                    if (currentHoveredLi) {
                        currentHoveredLi.dispatchEvent(new Event('mouseleave'));
                        currentHoveredLi = null;
                    }
                }
            }, { passive: true });

            albumMenuNode.addEventListener('touchend', (e) => {
                // Let the native click event handle the actual selection! 
                // We just clean up the scrubber hover states here.
                if (currentHoveredLi) {
                    currentHoveredLi.dispatchEvent(new Event('mouseleave'));
                    currentHoveredLi = null;
                }
            });

            albumMenuNode.addEventListener('touchcancel', (e) => {
                if (currentHoveredLi) {
                    currentHoveredLi.dispatchEvent(new Event('mouseleave'));
                    currentHoveredLi = null;
                }
            });
        }

        // Initialize grid with All photos
        loadAlbumImages('All photos');

        initInkBleed(); // Bootstrap typography geometric logic natively once parsed securely!
    } catch (e) {
        console.error("Error loading albums natively via JSON array configuration:", e);
    }
}

// Bootstrap
loadAlbums();

animate();

// Window Resize Handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
