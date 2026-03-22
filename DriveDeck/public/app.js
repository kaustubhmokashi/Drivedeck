const codeForm = document.getElementById("code-form");
const pairingCodeInput = document.getElementById("pairing-code-input");
const pairingCodeLabelEl = document.getElementById("pairing-code-label");
const pairingQrEl = document.getElementById("pairing-qr");
const pairingLinkEl = document.getElementById("pairing-link");
const openDirectLinkButton = document.getElementById("open-direct-link");
const backToPairingButton = document.getElementById("back-to-pairing");
const directBackButton = document.getElementById("direct-back-button");
const directLinkForm = document.getElementById("direct-link-form");
const directLinkInput = document.getElementById("direct-link-input");
const statusEl = document.getElementById("status");
const directStatusEl = document.getElementById("direct-status");
const systemStatusEl = document.getElementById("system-status");
const loadingIndicatorEl = document.getElementById("loading-indicator");
const loadingCopyEl = document.getElementById("loading-copy");
const directLoadingIndicatorEl = document.getElementById("direct-loading-indicator");
const directLoadingCopyEl = document.getElementById("direct-loading-copy");

const screenLink = document.getElementById("screen-link");
const screenDirectLink = document.getElementById("screen-direct-link");
const screenFolders = document.getElementById("screen-folders");
const screenGallery = document.getElementById("screen-gallery");

const folderTreeEl = document.getElementById("folder-tree");
const folderCountEl = document.getElementById("folder-count");
const folderPathStatusEl = document.getElementById("folder-path-status");
const foldersTitleEl = document.getElementById("folders-title");
const foldersSubtitleEl = document.getElementById("folders-subtitle");
const selectedFolderNameEl = document.getElementById("selected-folder-name");
const selectedFolderPathEl = document.getElementById("selected-folder-path");
const selectedFolderCountEl = document.getElementById("selected-folder-count");

const galleryEl = document.getElementById("gallery");
const galleryHeadingCopyEl = document.getElementById("gallery-heading-copy");
const galleryFolderPathEl = document.getElementById("gallery-folder-path");
const photoCountEl = document.getElementById("photo-count");
const selectedGridFolderEl = document.getElementById("selected-grid-folder");

const backToLinkButton = document.getElementById("back-to-link");
const continueToGalleryButton = document.getElementById("continue-to-gallery");
const backToFoldersButton = document.getElementById("back-to-folders");
const startSlideshowButton = document.getElementById("start-slideshow");

const durationInput = document.getElementById("duration-input");
const durationReadoutEl = document.getElementById("duration-readout");
const loopInput = document.getElementById("loop-input");
const autoplayInput = document.getElementById("autoplay-input");

const slideshowEl = document.getElementById("slideshow");
const slideImageEl = document.getElementById("slide-image");
const slideTitleEl = document.getElementById("slide-title");
const slideMetaEl = document.getElementById("slide-meta");
const slidePositionEl = document.getElementById("slide-position");
const closeSlideshowButton = document.getElementById("close-slideshow");
const prevSlideButton = document.getElementById("prev-slide");
const nextSlideButton = document.getElementById("next-slide");
const playPauseButton = document.getElementById("play-pause");
const toggleSettingsButton = document.getElementById("toggle-settings");
const dockSettingsButton = document.getElementById("dock-settings");
const slideshowSettingsEl = document.getElementById("slideshow-settings");
const closeSlideshowSettingsButton = document.getElementById("close-slideshow-settings");
const slideDurationInput = document.getElementById("slide-duration-input");
const slideDurationReadoutEl = document.getElementById("slide-duration-readout");
const slideLoopInput = document.getElementById("slide-loop-input");
const slideAutoplayInput = document.getElementById("slide-autoplay-input");

let currentFolders = [];
let selectedFolderId = null;
let images = [];
let currentSlideIndex = -1;
let imageLoadFailures = 0;
let autoplayTimer = null;
let loadTimer = null;
let loadStartedAt = 0;
let slideshowConfig = {
  duration: 8,
  loop: false,
  autoplay: false,
};

function focusElement(element) {
  if (!element) {
    return;
  }

  window.requestAnimationFrame(() => {
    element.focus();
    if (typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ block: "nearest" });
    }
  });
}

function moveFolderFocus(direction) {
  const buttons = Array.from(folderTreeEl.querySelectorAll(".folder-choice"));
  if (!buttons.length) {
    return;
  }

  const currentIndex = buttons.findIndex((button) => button === document.activeElement);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = Math.max(0, Math.min(buttons.length - 1, safeIndex + direction));
  focusElement(buttons[nextIndex]);
}

function getGalleryCards() {
  return Array.from(galleryEl.querySelectorAll(".photo-card"));
}

function moveGalleryFocus(direction) {
  const cards = getGalleryCards();
  if (!cards.length) {
    return;
  }

  const currentIndex = cards.findIndex((card) => card === document.activeElement);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;

  if (direction === "left" || direction === "right") {
    const delta = direction === "left" ? -1 : 1;
    const nextIndex = Math.max(0, Math.min(cards.length - 1, safeIndex + delta));
    focusElement(cards[nextIndex]);
    return;
  }

  const currentRect = cards[safeIndex].getBoundingClientRect();
  const currentCenterX = currentRect.left + currentRect.width / 2;
  const movingDown = direction === "down";
  let bestCard = null;
  let bestScore = Number.POSITIVE_INFINITY;

  cards.forEach((card, index) => {
    if (index === safeIndex) {
      return;
    }

    const rect = card.getBoundingClientRect();
    const isCandidate = movingDown ? rect.top > currentRect.top + 12 : rect.top < currentRect.top - 12;
    if (!isCandidate) {
      return;
    }

    const centerX = rect.left + rect.width / 2;
    const verticalDistance = Math.abs(rect.top - currentRect.top);
    const horizontalDistance = Math.abs(centerX - currentCenterX);
    const score = verticalDistance * 10 + horizontalDistance;

    if (score < bestScore) {
      bestScore = score;
      bestCard = card;
    }
  });

  if (bestCard) {
    focusElement(bestCard);
  }
}

function getSlideshowPrimaryControls() {
  return [
    toggleSettingsButton,
    closeSlideshowButton,
    prevSlideButton,
    playPauseButton,
    nextSlideButton,
    dockSettingsButton,
  ];
}

function getSlideshowSettingsControls() {
  return [
    closeSlideshowSettingsButton,
    slideDurationInput,
    slideLoopInput,
    slideAutoplayInput,
  ];
}

function moveFocusWithinList(controls, direction) {
  const activeIndex = controls.findIndex((control) => control === document.activeElement);
  if (activeIndex === -1) {
    focusElement(controls[0]);
    return true;
  }

  const nextIndex = Math.max(0, Math.min(controls.length - 1, activeIndex + direction));
  if (nextIndex !== activeIndex) {
    focusElement(controls[nextIndex]);
  }
  return true;
}

function handleSlideshowChromeNavigation(event) {
  const primaryControls = getSlideshowPrimaryControls();
  const activeElement = document.activeElement;
  const activeIndex = primaryControls.findIndex((control) => control === activeElement);

  if (activeIndex === -1) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusElement(playPauseButton);
      return true;
    }
    return false;
  }

  const topRow = [toggleSettingsButton, closeSlideshowButton];
  const dockRow = [prevSlideButton, playPauseButton, nextSlideButton, dockSettingsButton];

  if (topRow.includes(activeElement)) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      moveFocusWithinList(topRow, event.key === "ArrowLeft" ? -1 : 1);
      return true;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusElement(activeElement === toggleSettingsButton ? dockSettingsButton : playPauseButton);
      return true;
    }

    return false;
  }

  if (dockRow.includes(activeElement)) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      moveFocusWithinList(dockRow, event.key === "ArrowLeft" ? -1 : 1);
      return true;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusElement(activeElement === dockSettingsButton ? toggleSettingsButton : closeSlideshowButton);
      return true;
    }

    return false;
  }

  return false;
}

function handleSlideshowSettingsNavigation(event) {
  const settingsControls = getSlideshowSettingsControls();
  const activeElement = document.activeElement;

  if (!slideshowSettingsEl.contains(activeElement)) {
    return false;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveFocusWithinList(settingsControls, 1);
    return true;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveFocusWithinList(settingsControls, -1);
    return true;
  }

  return false;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffb4ac" : "";
  systemStatusEl.textContent = isError ? "NEEDS ATTENTION" : "READY WHEN YOU ARE";
}

function setDirectStatus(message, isError = false) {
  directStatusEl.textContent = message;
  directStatusEl.style.color = isError ? "#ffb4ac" : "";
}

function clearLoadingTimer() {
  if (loadTimer) {
    window.clearInterval(loadTimer);
    loadTimer = null;
  }
}

function formatElapsedCopy(baseMessage) {
  if (!loadStartedAt) {
    return baseMessage;
  }

  const elapsedSeconds = Math.max(1, Math.floor((Date.now() - loadStartedAt) / 1000));
  return `${baseMessage} Elapsed time: ${elapsedSeconds}s.`;
}

function setLoadingState(isLoading, message = "", options = {}) {
  const { direct = false, preserveStartTime = false } = options;
  const indicator = direct ? directLoadingIndicatorEl : loadingIndicatorEl;
  const copyEl = direct ? directLoadingCopyEl : loadingCopyEl;

  if (!indicator || !copyEl) {
    return;
  }

  if (!isLoading) {
    indicator.classList.add("hidden");
    copyEl.textContent = "";
    clearLoadingTimer();
    loadStartedAt = 0;
    return;
  }

  if (!preserveStartTime || !loadStartedAt) {
    loadStartedAt = Date.now();
  }

  const baseMessage =
    message || "We’re opening your folder now. Larger collections can take around 10 to 30 seconds.";
  copyEl.textContent = formatElapsedCopy(baseMessage);
  indicator.classList.remove("hidden");
  clearLoadingTimer();
  loadTimer = window.setInterval(() => {
    copyEl.textContent = formatElapsedCopy(baseMessage);
  }, 1000);
}

function setActiveScreen(step) {
  screenLink.classList.toggle("active", step === 1);
  screenDirectLink.classList.toggle("active", step === 2);
  screenFolders.classList.toggle("active", step === 3);
  screenGallery.classList.toggle("active", step === 4);

  if (step === 1) {
    focusElement(pairingCodeInput);
  } else if (step === 2) {
    focusElement(directLinkInput);
  } else if (step === 3) {
    focusElement(folderTreeEl.querySelector(".folder-choice") || continueToGalleryButton);
  } else if (step === 4) {
    focusElement(galleryEl.querySelector(".photo-card") || startSlideshowButton);
  }
}

function collectFolders(node, parentPath = "") {
  if (!node) {
    return [];
  }

  const path = parentPath ? `${parentPath}/${node.name}` : node.name;
  const folders = [];
  const ownImages = node.images || [];

  if (ownImages.length > 0) {
    folders.push({
      id: node.id,
      name: node.name,
      path,
      images: ownImages,
    });
  }

  node.folders.forEach((child) => {
    folders.push(...collectFolders(child, path));
  });

  return folders;
}

function getSelectedFolder() {
  return currentFolders.find((folder) => folder.id === selectedFolderId) || null;
}

function updateFolderSidePanel() {
  const folder = getSelectedFolder();
  selectedFolderNameEl.textContent = folder ? folder.name : "Nothing selected yet";
  selectedFolderPathEl.textContent = folder ? folder.path : "/";
  selectedFolderCountEl.textContent = folder
    ? `${folder.images.length} photo${folder.images.length === 1 ? "" : "s"}`
    : "0 photos";
  folderPathStatusEl.textContent = folder ? `PATH: ${folder.path}` : "PATH: //";
  foldersTitleEl.textContent = currentFolders.length > 1 ? "CHOOSE A FOLDER" : "FOLDER READY";
  foldersSubtitleEl.textContent = folder
    ? `You're all set to browse photos from ${folder.name}.`
    : "Pick the folder you'd like to show on screen.";
}

function renderFolderChoices(folders) {
  folderTreeEl.innerHTML = "";

  if (!folders.length) {
    folderTreeEl.innerHTML = '<div class="empty-sequence">We couldn\'t find any folders here.</div>';
    return;
  }

  folders.forEach((folder) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `folder-choice${folder.id === selectedFolderId ? " selected" : ""}`;
    button.innerHTML = `
      <div class="folder-choice-title">
        <strong>${folder.name}</strong>
        <span>${folder.images.length} photo${folder.images.length === 1 ? "" : "s"}</span>
      </div>
      <div class="folder-choice-path">${folder.path}</div>
    `;
    button.addEventListener("click", () => {
      selectedFolderId = folder.id;
      renderFolderChoices(currentFolders);
      updateFolderSidePanel();
      updateGalleryForSelectedFolder();
      setActiveScreen(4);
    });
    button.addEventListener("focus", () => {
      button.scrollIntoView({ block: "nearest" });
    });
    button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveFolderFocus(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveFolderFocus(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        updateGalleryForSelectedFolder();
        setActiveScreen(4);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectedFolderId = folder.id;
        renderFolderChoices(currentFolders);
        updateFolderSidePanel();
        updateGalleryForSelectedFolder();
        setActiveScreen(4);
      }
    });
    folderTreeEl.appendChild(button);
  });
}

function renderGallery(photoItems) {
  galleryEl.innerHTML = "";
  imageLoadFailures = 0;

  if (!photoItems.length) {
    galleryEl.innerHTML = '<div class="empty-sequence">This folder doesn\'t have any photos yet.</div>';
    return;
  }

  photoItems.forEach((photo, index) => {
    const card = document.createElement("button");
    card.className = "photo-card";
    card.type = "button";

    const image = document.createElement("img");
    image.src = photo.thumbnailUrl;
    image.alt = photo.name;
    image.loading = "lazy";
    image.addEventListener("error", () => {
      imageLoadFailures += 1;
      image.style.opacity = "0.14";
      setStatus(
        `${imageLoadFailures} image${imageLoadFailures === 1 ? "" : "s"} failed to load. Direct Drive media access may be restricted for some files.`,
        true
      );
    });

    const body = document.createElement("div");
    body.className = "photo-card-body";
    body.innerHTML = `
      <div class="photo-name">${photo.name}</div>
      <div class="photo-path">${photo.path || "Root folder"}</div>
    `;

    card.appendChild(image);
    card.appendChild(body);
    card.addEventListener("click", () => openSlideshow(index));
    card.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveGalleryFocus("left");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveGalleryFocus("right");
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveGalleryFocus("up");
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveGalleryFocus("down");
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openSlideshow(index);
      }
    });
    galleryEl.appendChild(card);
  });
}

function updateGalleryForSelectedFolder() {
  const selectedFolder = getSelectedFolder();
  images = selectedFolder ? selectedFolder.images : [];
  photoCountEl.textContent = `${images.length}`;
  galleryHeadingCopyEl.textContent = selectedFolder
    ? `Showing ${images.length} photo${images.length === 1 ? "" : "s"} from ${selectedFolder.path}. Choose any one to begin.`
    : "Choose any photo to begin.";
  galleryFolderPathEl.textContent = selectedFolder ? `PATH: ${selectedFolder.path}` : "PATH: //";
  selectedGridFolderEl.textContent = selectedFolder ? selectedFolder.name : "Nothing selected yet";
  renderGallery(images);
}

function updateDurationControls() {
  const value = `${Number(slideshowConfig.duration).toFixed(1)}s`;
  durationReadoutEl.textContent = value;
  slideDurationReadoutEl.textContent = value;
  durationInput.value = String(slideshowConfig.duration);
  slideDurationInput.value = String(slideshowConfig.duration);
  loopInput.checked = slideshowConfig.loop;
  slideLoopInput.checked = slideshowConfig.loop;
  autoplayInput.checked = slideshowConfig.autoplay;
  slideAutoplayInput.checked = slideshowConfig.autoplay;
  playPauseButton.textContent = slideshowConfig.autoplay ? "❚❚" : "▶";
}

function clearAutoplay() {
  if (autoplayTimer) {
    window.clearInterval(autoplayTimer);
    autoplayTimer = null;
  }
}

function startAutoplay() {
  clearAutoplay();

  if (!slideshowConfig.autoplay || images.length <= 1) {
    return;
  }

  autoplayTimer = window.setInterval(() => {
    const nextIndex = currentSlideIndex + 1;
    if (!slideshowConfig.loop && nextIndex >= images.length) {
      slideshowConfig.autoplay = false;
      updateDurationControls();
      clearAutoplay();
      return;
    }

    showSlide(nextIndex);
  }, slideshowConfig.duration * 1000);
}

function syncConfigFromInputs(source) {
  const durationValue = Number(source.duration.value);
  slideshowConfig.duration = durationValue;
  slideshowConfig.loop = source.loop.checked;
  slideshowConfig.autoplay = source.autoplay.checked;
  updateDurationControls();
  startAutoplay();
}

function showSlide(index) {
  if (!images.length) {
    return;
  }

  if (!slideshowConfig.loop && index < 0) {
    index = 0;
  } else if (!slideshowConfig.loop && index >= images.length) {
    index = images.length - 1;
  }

  currentSlideIndex = (index + images.length) % images.length;
  const photo = images[currentSlideIndex];

  slideImageEl.onerror = () => {
    setStatus(`Could not load "${photo.name}" in slideshow view.`, true);
  };

  slideImageEl.src = photo.url;
  slideImageEl.alt = photo.name;
  slideTitleEl.textContent = photo.name.replace(/\.[^.]+$/, "").toUpperCase();
  slideMetaEl.textContent = `${(photo.path || "ROOT FOLDER").replaceAll("/", " // ").toUpperCase()} // FRAME_${String(currentSlideIndex + 1).padStart(3, "0")}`;
  slidePositionEl.textContent = String(currentSlideIndex + 1).padStart(3, "0");
}

function openSlideshow(index = 0) {
  if (!images.length) {
    setStatus("There aren’t any photos ready to play just yet.", true);
    return;
  }

  showSlide(index);
  slideshowEl.classList.remove("hidden");
  slideshowEl.setAttribute("aria-hidden", "false");
  updateDurationControls();
  startAutoplay();
  focusElement(playPauseButton);
}

function closeSlideshow() {
  slideshowEl.classList.add("hidden");
  slideshowEl.setAttribute("aria-hidden", "true");
  slideshowSettingsEl.classList.add("hidden");
  clearAutoplay();
  focusElement(galleryEl.querySelector(".photo-card") || startSlideshowButton);
}

function handleKeydown(event) {
  const isBackKey =
    event.key === "Escape" ||
    event.key === "Backspace" ||
    event.key === "BrowserBack" ||
    event.key === "GoBack";

  if (isBackKey) {
    if (!slideshowEl.classList.contains("hidden")) {
      event.preventDefault();
      if (!slideshowSettingsEl.classList.contains("hidden")) {
        slideshowSettingsEl.classList.add("hidden");
        focusElement(closeSlideshowButton);
      } else {
        closeSlideshow();
      }
      return;
    }

      if (screenGallery.classList.contains("active")) {
        event.preventDefault();
        if (currentFolders.length > 1) {
          setActiveScreen(3);
        } else {
          setActiveScreen(1);
        }
        return;
      }

      if (screenDirectLink.classList.contains("active")) {
        event.preventDefault();
        setActiveScreen(1);
        return;
      }

      if (screenFolders.classList.contains("active")) {
        event.preventDefault();
        setActiveScreen(1);
      return;
    }
  }

  if (slideshowEl.classList.contains("hidden")) {
    return;
  }

  if (!slideshowSettingsEl.classList.contains("hidden") && handleSlideshowSettingsNavigation(event)) {
    return;
  }

  if (slideshowSettingsEl.classList.contains("hidden") && handleSlideshowChromeNavigation(event)) {
    return;
  }

  if (event.key === "ArrowRight") {
    showSlide(currentSlideIndex + 1);
  } else if (event.key === "ArrowLeft") {
    showSlide(currentSlideIndex - 1);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    focusElement(playPauseButton);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    focusElement(closeSlideshowButton);
  } else if (event.key === " ") {
    event.preventDefault();
    slideshowConfig.autoplay = !slideshowConfig.autoplay;
    updateDurationControls();
    startAutoplay();
  }
}

async function loadFolder(folderUrl) {
  setStatus("Getting everything ready...");
  systemStatusEl.textContent = "OPENING YOUR FOLDER";
  const isDirectEntry = screenDirectLink.classList.contains("active");
  setLoadingState(
    true,
    "We’re opening your folder now. Larger collections can take around 10 to 30 seconds.",
    { direct: isDirectEntry }
  );

  try {
    try {
      const metaResponse = await fetch(`/api/folder-meta?url=${encodeURIComponent(folderUrl)}`);
      const metaData = await metaResponse.json();
      if (metaResponse.ok && metaData.name) {
        setStatus(`Connecting to "${metaData.name}"...`);
        setLoadingState(
          true,
          `We’re connecting to "${metaData.name}" now. Larger collections can take around 10 to 30 seconds.`,
          { direct: isDirectEntry, preserveStartTime: true }
        );
      }
    } catch (error) {
      // Keep the generic loading state if metadata lookup fails.
    }

    const response = await fetch(`/api/folder?url=${encodeURIComponent(folderUrl)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load Google Drive folder.");
    }

    currentFolders = collectFolders(data.tree);
    selectedFolderId = currentFolders[0] ? currentFolders[0].id : null;
    folderCountEl.textContent = String(currentFolders.length);

    renderFolderChoices(currentFolders);
    updateFolderSidePanel();
    updateGalleryForSelectedFolder();

    if (currentFolders.length > 1) {
      setActiveScreen(3);
      setStatus(`You're in. We found ${currentFolders.length} folders to choose from.`);
    } else {
      setActiveScreen(4);
      setStatus("Everything's ready. Your photos are waiting.");
    }
    setLoadingState(false, "", { direct: isDirectEntry });
  } catch (error) {
    currentFolders = [];
    selectedFolderId = null;
    images = [];
    folderCountEl.textContent = "0";
    photoCountEl.textContent = "0";
    folderTreeEl.innerHTML = '<div class="empty-sequence">We couldn\'t load the folders this time.</div>';
    galleryEl.innerHTML = '<div class="empty-sequence">We couldn\'t load the photos this time.</div>';
    setActiveScreen(1);
    setStatus(error.message, true);
    setLoadingState(false, "", { direct: isDirectEntry });
  }
}

async function setupRemotePairingLink() {
  try {
    pairingCodeInput.value = "";
    const remoteUrl = new URL("/remote", window.location.href).toString();
    pairingLinkEl.textContent = remoteUrl;
    pairingQrEl.src = window.generateQrDataUrl(remoteUrl);
    pairingQrEl.alt = "QR code for remote pairing";
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function resolvePairingCode(code) {
  const response = await fetch(`/api/remote/resolve?code=${encodeURIComponent(code)}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to resolve code.");
  }

  if (!data.ready || !data.url) {
    throw new Error("This code exists, but no Drive link has been saved from mobile yet.");
  }

  return data.url;
}

codeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = pairingCodeInput.value.trim();
  if (!/^\d{6}$/.test(code)) {
    setStatus("Please enter a 6 digit pairing code.", true);
    return;
  }

  try {
    setStatus(`Looking up code ${code}...`);
    const folderUrl = await resolvePairingCode(code);
    await loadFolder(folderUrl);
  } catch (error) {
    setStatus(error.message, true);
    setLoadingState(false);
  }
});

directLinkForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const folderUrl = directLinkInput.value.trim();
  if (!folderUrl) {
    setDirectStatus("Paste a Google Drive folder link and we’ll open it for you.", true);
    return;
  }

  setDirectStatus("");
  await loadFolder(folderUrl);
});

openDirectLinkButton.addEventListener("click", () => {
  setDirectStatus("");
  setActiveScreen(2);
});

backToPairingButton.addEventListener("click", () => setActiveScreen(1));
directBackButton.addEventListener("click", () => setActiveScreen(1));

backToLinkButton.addEventListener("click", () => setActiveScreen(1));

continueToGalleryButton.addEventListener("click", () => {
  updateGalleryForSelectedFolder();
  setActiveScreen(4);
});

backToFoldersButton.addEventListener("click", () => {
  if (currentFolders.length > 1) {
    setActiveScreen(3);
  } else {
    setActiveScreen(1);
  }
});

startSlideshowButton.addEventListener("click", () => openSlideshow(0));

durationInput.addEventListener("input", () =>
  syncConfigFromInputs({
    duration: durationInput,
    loop: loopInput,
    autoplay: autoplayInput,
  })
);

loopInput.addEventListener("change", () =>
  syncConfigFromInputs({
    duration: durationInput,
    loop: loopInput,
    autoplay: autoplayInput,
  })
);

autoplayInput.addEventListener("change", () =>
  syncConfigFromInputs({
    duration: durationInput,
    loop: loopInput,
    autoplay: autoplayInput,
  })
);

slideDurationInput.addEventListener("input", () =>
  syncConfigFromInputs({
    duration: slideDurationInput,
    loop: slideLoopInput,
    autoplay: slideAutoplayInput,
  })
);

slideLoopInput.addEventListener("change", () =>
  syncConfigFromInputs({
    duration: slideDurationInput,
    loop: slideLoopInput,
    autoplay: slideAutoplayInput,
  })
);

slideAutoplayInput.addEventListener("change", () =>
  syncConfigFromInputs({
    duration: slideDurationInput,
    loop: slideLoopInput,
    autoplay: slideAutoplayInput,
  })
);

closeSlideshowButton.addEventListener("click", closeSlideshow);
prevSlideButton.addEventListener("click", () => showSlide(currentSlideIndex - 1));
nextSlideButton.addEventListener("click", () => showSlide(currentSlideIndex + 1));
playPauseButton.addEventListener("click", () => {
  slideshowConfig.autoplay = !slideshowConfig.autoplay;
  updateDurationControls();
  startAutoplay();
});

toggleSettingsButton.addEventListener("click", () => {
  slideshowSettingsEl.classList.toggle("hidden");
  focusElement(
    slideshowSettingsEl.classList.contains("hidden")
      ? closeSlideshowButton
      : closeSlideshowSettingsButton
  );
});

dockSettingsButton.addEventListener("click", () => {
  slideshowSettingsEl.classList.toggle("hidden");
  focusElement(
    slideshowSettingsEl.classList.contains("hidden")
      ? playPauseButton
      : closeSlideshowSettingsButton
  );
});

closeSlideshowSettingsButton.addEventListener("click", () => {
  slideshowSettingsEl.classList.add("hidden");
  focusElement(toggleSettingsButton);
});

document.addEventListener("keydown", handleKeydown);

slideshowEl.addEventListener("click", (event) => {
  if (event.target === slideshowEl) {
    closeSlideshow();
  }
});

updateDurationControls();
setupRemotePairingLink();
focusElement(pairingCodeInput);
