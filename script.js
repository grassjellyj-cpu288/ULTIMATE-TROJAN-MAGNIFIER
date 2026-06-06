// ===============================
//  CANVAS + GLOBALS
// ===============================
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";

let dpr = window.devicePixelRatio || 1;

// Image data
let img = new Image();
let imgX = 0, imgY = 0, imgScale = 1;
let draggingImage = false;
let lockImage = false;
let offsetX = 0, offsetY = 0;

// MARKERS
let markers = [];
let draggingPoint = null;
let draggingBubble = null;
let selectedMarkerIndex = null;

// TEXT ANNOTATIONS
let texts = [];
let selectedTextIndex = null;
let draggingTextIndex = null;
let dragTextOffsetX = 0, dragTextOffsetY = 0;
let nextTextId = 1;

// Undo / Redo stacks
let undoStack = [];
let redoStack = [];

// Drawing styles
let lineWidth = 5;
let pointSize = 12;
let canvasBg = "#222222";
let bgEnabled = false;

// Magnifier radius (can be adjusted 30-100)
let magRadius = 90;          // <--- เปลี่ยนเป็น let และกำหนดค่าเริ่มต้น 90

// Background image URL management
let currentBgUrl = "https://od.lk/s/N18yODQzMzIwNzdf/6db9d034-1022-40c3-b023-a0749ab58b01.png";
const BG_URL_1 = "https://od.lk/s/N18yODU5ODgxNTlf/706790976_1729170874768420_6936699414099320870_n.jpg";
const BG_URL_2 = "https://od.lk/s/N18yODQ0OTcxOTdf/789.jpg";
const BG_URL_3 = "https://od.lk/s/N18yODU5NjQyMTlf/SMART_SHARPEN_PRO.png";

// Speech synthesis
let speechEnabled = true;
let speechSynth = window.speechSynthesis;

function speak(text, force = false) {
    if (!speechEnabled && !force) return;
    if (!speechSynth) return;
    speechSynth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "th-TH";
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1;
    speechSynth.speak(utterance);
}

function toggleSpeech() {
    speechEnabled = !speechEnabled;
    const btn = document.getElementById("speakToggleBtn");
    if (speechEnabled) {
        btn.innerHTML = "🔊 เปิดเสียงตอบกลับ";
        btn.style.background = "#f97316";
        speak("เปิดเสียงตอบกลับแล้วครับเจ้านาย", true);
    } else {
        btn.innerHTML = "🔇 ปิดเสียงตอบกลับ";
        btn.style.background = "#6c757d";
    }
    saveStateFull();
}

// ===============================
//  STATE (รวม magRadius)
// ===============================
function getFullState() {
    return {
        markers: JSON.parse(JSON.stringify(markers)),
        texts: JSON.parse(JSON.stringify(texts)),
        lineWidth: lineWidth,
        pointSize: pointSize,
        canvasBg: canvasBg,
        bgEnabled: bgEnabled,
        lockImage: lockImage,
        imgX: imgX, imgY: imgY, imgScale: imgScale,
        selectedMarkerIndex: selectedMarkerIndex,
        selectedTextIndex: selectedTextIndex,
        currentBgUrl: currentBgUrl,
        speechEnabled: speechEnabled,
        nextTextId: nextTextId,
        magRadius: magRadius          // <--- เพิ่มบรรทัดนี้
    };
}

function saveStateFull() {
    undoStack.push(getFullState());
    redoStack = [];
}

function applyFullState(state) {
    markers = normalizeMarkers(state.markers);
    texts = state.texts ? state.texts.slice() : [];
    lineWidth = state.lineWidth;
    pointSize = state.pointSize;
    canvasBg = state.canvasBg;
    bgEnabled = state.bgEnabled;
    lockImage = state.lockImage;
    imgX = state.imgX;
    imgY = state.imgY;
    imgScale = state.imgScale;
    selectedMarkerIndex = state.selectedMarkerIndex;
    selectedTextIndex = state.selectedTextIndex;
    currentBgUrl = state.currentBgUrl;
    if (state.speechEnabled !== undefined) speechEnabled = state.speechEnabled;
    if (state.nextTextId) nextTextId = state.nextTextId;
    if (state.magRadius !== undefined) magRadius = state.magRadius;   // <--- เพิ่ม
    
    document.getElementById("lineSlider").value = lineWidth;
    document.getElementById("lineValue").innerText = lineWidth;
    document.getElementById("pointSlider").value = pointSize;
    document.getElementById("pointValue").innerText = pointSize;
    document.getElementById("bgColor").value = canvasBg;
    
    // อัปเดต UI ของ magRadius
    const radiusSlider = document.getElementById("radiusSlider");
    const radiusSpan = document.getElementById("radiusValue");
    if (radiusSlider) radiusSlider.value = magRadius;
    if (radiusSpan) radiusSpan.innerText = magRadius;
    
    const lockBtn = document.getElementById("lockBtn");
    if (lockImage) {
        lockBtn.innerHTML = "🔒 ล็อกรูปแล้ว";
        lockBtn.style.background = "#dc2626";
    } else {
        lockBtn.innerHTML = "🔓 ปลดล็อกภาพ";
        lockBtn.style.background = "#2563eb";
    }
    const speechBtn = document.getElementById("speakToggleBtn");
    if (speechEnabled) {
        speechBtn.innerHTML = "🔊 เปิดเสียงตอบกลับ";
        speechBtn.style.background = "#f97316";
    } else {
        speechBtn.innerHTML = "🔇 ปิดเสียงตอบกลับ";
        speechBtn.style.background = "#6c757d";
    }
    applyBackground();
    updateTextControlsVisibility();
    draw();
    updateSelectedInfoUI();
    updateTextSelectionStatus();
}

function undo() {
    if (!undoStack.length) return;
    redoStack.push(getFullState());
    const prevState = undoStack.pop();
    applyFullState(prevState);
    speak("เลิกทำ");
}

function redo() {
    if (!redoStack.length) return;
    undoStack.push(getFullState());
    const nextState = redoStack.pop();
    applyFullState(nextState);
    speak("ทำซ้ำ");
}

// ===============================
//  TEXT UTILITIES
// ===============================
function getTextBoundingBox(t) {
    ctx.save();
    ctx.font = `${t.fontSize}px "Sukhumvit Set", "Thonburi", "Noto Sans Thai", system-ui, -apple-system, sans-serif`;
    const metrics = ctx.measureText(t.text);
    const width = metrics.width;
    const height = t.fontSize * 1.2;
    ctx.restore();
    return { x: t.x, y: t.y, width: width, height: height };
}

function drawTextHighlight(t, isSelected) {
    if (!isSelected) return;
    const box = getTextBoundingBox(t);
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.width, box.height);
    ctx.strokeStyle = "#FFD966";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

function addTextAtCenter(textContent) {
    if (!textContent || textContent.trim() === "") return;
    saveStateFull();
    const defaultFontSize = 28;
    ctx.font = `${defaultFontSize}px "Sukhumvit Set", "Thonburi", "Noto Sans Thai", system-ui, sans-serif`;
    const metrics = ctx.measureText(textContent);
    const textWidth = metrics.width;
    const centerX = window.innerWidth / 2;
    const centerY = (window.innerHeight - 120) / 2;
    const anchorX = centerX - textWidth / 2;
    const anchorY = centerY - defaultFontSize * 0.6;
    texts.push({
        id: nextTextId++,
        text: textContent,
        x: anchorX,
        y: anchorY,
        fontSize: defaultFontSize,
        color: "#ffffff"
    });
    selectedTextIndex = texts.length - 1;
    selectedMarkerIndex = null;
    updateTextControlsVisibility();
    draw();
    updateTextSelectionStatus();
    speak("เพิ่มข้อความแล้วครับเจ้านาย");
}

function editSelectedText() {
    if (selectedTextIndex === null || !texts[selectedTextIndex]) return;
    const oldText = texts[selectedTextIndex].text;
    const newText = prompt("แก้ไขข้อความภาษาไทย:", oldText);
    if (newText && newText.trim() !== "") {
        saveStateFull();
        texts[selectedTextIndex].text = newText.trim();
        draw();
        speak("แก้ไขข้อความแล้วครับเจ้านาย");
    }
}

function deleteSelectedText() {
    if (selectedTextIndex === null || !texts[selectedTextIndex]) return;
    saveStateFull();
    texts.splice(selectedTextIndex, 1);
    if (texts.length === 0) selectedTextIndex = null;
    else if (selectedTextIndex >= texts.length) selectedTextIndex = texts.length - 1;
    updateTextControlsVisibility();
    draw();
    updateTextSelectionStatus();
    speak("ลบข้อความแล้วครับเจ้านาย");
}

function updateTextSelectionStatus() {
    const div = document.getElementById("textSelectionStatus");
    if (div) {
        if (selectedTextIndex !== null && texts[selectedTextIndex]) {
            div.innerHTML = `✏️ ข้อความที่เลือก: "${texts[selectedTextIndex].text}" (ลากวางได้)`;
        } else {
            div.innerHTML = "";
        }
    }
}

function updateTextControlsVisibility() {
    const panel = document.getElementById("textControls");
    if (!panel) return;
    const sizeSlider = document.getElementById("textSizeSlider");
    const sizeVal = document.getElementById("textSizeValue");
    const colorPicker = document.getElementById("textColorPicker");
    if (selectedTextIndex !== null && texts[selectedTextIndex]) {
        panel.style.display = "inline-flex";
        const t = texts[selectedTextIndex];
        if (sizeSlider) sizeSlider.value = t.fontSize;
        if (sizeVal) sizeVal.innerText = t.fontSize;
        if (colorPicker) colorPicker.value = t.color;
    } else {
        panel.style.display = "none";
    }
}

// ===============================
//  BACKGROUND
// ===============================
function applyBackground() {
    if (bgEnabled && currentBgUrl) {
        document.body.classList.add("transparent-bg");
        document.body.style.backgroundImage = `url('${currentBgUrl}')`;
        document.body.style.backgroundColor = "transparent";
    } else {
        document.body.classList.remove("transparent-bg");
        document.body.style.backgroundImage = "";
        document.body.style.backgroundColor = "#111";
    }
}

function changeBackgroundUrl(newUrl, shouldSave = true) {
    if (!newUrl) return;
    if (shouldSave) saveStateFull();
    currentBgUrl = newUrl;
    if (bgEnabled) applyBackground();
    const msg = "เปลี่ยนพื้นหลังรูปแล้ว";
    voiceFeedbackMsg(msg, false);
    speak(msg);
}

function setBgUrl1() { changeBackgroundUrl(BG_URL_1, true); speak("เปลี่ยนเป็นพื้นหลังรูปที่ 1"); }
function setBgUrl2() { changeBackgroundUrl(BG_URL_2, true); speak("เปลี่ยนเป็นพื้นหลังรูปที่ 2"); }
function setBgUrl3() { changeBackgroundUrl(BG_URL_3, true); speak("เปลี่ยนเป็นพื้นหลังรูปที่ 3"); }
function setCustomBgUrl() {
    const customUrl = document.getElementById("customBgUrl").value.trim();
    if (customUrl) changeBackgroundUrl(customUrl, true);
    else voiceFeedbackMsg("⚠️ กรุณาใส่ URL รูปภาพ", true);
}

// ===============================
//  MAGNIFIER RADIUS CONTROL
// ===============================
function setMagRadius(newVal) {
    let clamped = Math.min(100, Math.max(30, newVal));
    if (magRadius === clamped) return;
    saveStateFull();
    magRadius = clamped;
    const slider = document.getElementById("radiusSlider");
    const span = document.getElementById("radiusValue");
    if (slider) slider.value = magRadius;
    if (span) span.innerText = magRadius;
    draw();
    speak(`ปรับขนาดวงขยายเป็น ${magRadius} พิกเซล`);
}

// ===============================
//  RESIZE & DRAW
// ===============================
function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = (window.innerHeight - 120) * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = (window.innerHeight - 120) + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
}
window.addEventListener("resize", resizeCanvas);

function normalizeMarkers(arr) {
    return arr.map(m => ({
        ...m,
        zoom: (m.zoom !== undefined && typeof m.zoom === 'number') ? Math.min(12, Math.max(0.1, m.zoom)) : 3
    }));
}

function draw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (!bgEnabled) {
        ctx.fillStyle = canvasBg;
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    }
    if (img && img.src && img.complete) {
        ctx.drawImage(img, imgX, imgY, img.width * imgScale, img.height * imgScale);
    }
    
    // Draw Markers
    markers.forEach((m, idx) => {
        const dx = m.bubbleX - m.x;
        const dy = m.bubbleY - m.y;
        const angle = Math.atan2(dy, dx);
        const isSelected = (selectedMarkerIndex === idx);
        
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.bubbleX, m.bubbleY);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = lineWidth;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "rgba(255,255,255,0.7)";
        ctx.stroke();
        
        const arrowSize = 18 + lineWidth * 0.6;
        ctx.beginPath();
        ctx.moveTo(m.bubbleX, m.bubbleY);
        ctx.lineTo(m.bubbleX - arrowSize * Math.cos(angle - Math.PI/6),
                   m.bubbleY - arrowSize * Math.sin(angle - Math.PI/6));
        ctx.lineTo(m.bubbleX - arrowSize * Math.cos(angle + Math.PI/6),
                   m.bubbleY - arrowSize * Math.sin(angle + Math.PI/6));
        ctx.closePath();
        ctx.fillStyle = "#f0f0f0";
        ctx.fill();
        ctx.restore();
        
        ctx.beginPath();
        ctx.arc(m.x, m.y, pointSize, 0, Math.PI*2);
        ctx.fillStyle = "#00a2ff";
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#00aaff";
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(m.x, m.y, pointSize-3, 0, Math.PI*2);
        ctx.fillStyle = "white";
        ctx.fill();
        
        if (img && img.src && img.complete) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(m.bubbleX, m.bubbleY, magRadius, 0, Math.PI*2);   // ใช้ magRadius
            ctx.clip();
            const imgCoordX = (m.x - imgX) / imgScale;
            const imgCoordY = (m.y - imgY) / imgScale;
            const zoomFactor = Math.min(12, Math.max(0.1, m.zoom));
            const srcWidth = (magRadius * 2) / zoomFactor;
            const srcHeight = (magRadius * 2) / zoomFactor;
            const srcX = imgCoordX - srcWidth/2;
            const srcY = imgCoordY - srcHeight/2;
            ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight,
                m.bubbleX - magRadius, m.bubbleY - magRadius, magRadius*2, magRadius*2);
            ctx.restore();
        } else {
            ctx.beginPath();
            ctx.arc(m.bubbleX, m.bubbleY, magRadius, 0, Math.PI*2);
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fill();
            ctx.strokeStyle = "#aaa";
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(m.bubbleX, m.bubbleY, magRadius, 0, Math.PI*2);
        ctx.lineWidth = isSelected ? 5 : 3.5;
        ctx.strokeStyle = isSelected ? "#FFD966" : "#ffffffee";
        ctx.shadowBlur = isSelected ? 24 : 15;
        ctx.shadowColor = isSelected ? "#FFB347" : "white";
        ctx.stroke();
        ctx.restore();
        
        if (isSelected) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(m.bubbleX, m.bubbleY, magRadius + 5, 0, Math.PI*2);
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = "#ffcc44";
            ctx.setLineDash([6, 8]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(m.x, m.y, pointSize + 3, 0, Math.PI*2);
            ctx.strokeStyle = "#FFD966";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }
    });
    
    // Draw Text Annotations
    for (let i = 0; i < texts.length; i++) {
        const t = texts[i];
        ctx.save();
        ctx.font = `${t.fontSize}px "Sukhumvit Set", "Thonburi", "Noto Sans Thai", system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = t.color;
        ctx.shadowBlur = 4;
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.textBaseline = "top";
        ctx.fillText(t.text, t.x, t.y);
        ctx.shadowBlur = 0;
        ctx.restore();
        if (selectedTextIndex === i) {
            drawTextHighlight(t, true);
        }
    }
    
    updateSelectedInfoUI();
    updateTextSelectionStatus();
}

function updateSelectedInfoUI() {
    const zoomSlider = document.getElementById("zoomSlider");
    const zoomValueSpan = document.getElementById("zoomValue");
    const selectedSpan = document.getElementById("selectedInfo");
    if (selectedMarkerIndex !== null && markers[selectedMarkerIndex]) {
        const currentZoom = markers[selectedMarkerIndex].zoom;
        zoomSlider.disabled = false;
        zoomSlider.value = currentZoom;
        zoomValueSpan.innerText = currentZoom.toFixed(1) + "x";
        selectedSpan.innerHTML = `🎯 เลือกวง #${selectedMarkerIndex+1} | ซูม ${currentZoom.toFixed(1)}x`;
    } else {
        zoomSlider.disabled = true;
        zoomSlider.value = 3;
        zoomValueSpan.innerText = "3x";
        selectedSpan.innerHTML = `✨ ไม่มีวงถูกเลือก | คลิกที่วงหรือจุดนำ`;
    }
}

// ===============================
//  MARKER ACTIONS
// ===============================
function addMarker(x, y) {
    saveStateFull();
    markers.push({
        x: x, y: y,
        bubbleX: x - 140, bubbleY: y - 140,
        zoom: 3.0
    });
    selectedMarkerIndex = markers.length - 1;
    selectedTextIndex = null;
    updateTextControlsVisibility();
    draw();
    updateSelectedInfoUI();
    speak("เพิ่มวงใหม่");
}

function deleteLastMarker() {
    if (markers.length === 0) return;
    saveStateFull();
    markers.pop();
    if (selectedMarkerIndex !== null && selectedMarkerIndex >= markers.length) selectedMarkerIndex = markers.length - 1;
    if (markers.length === 0) selectedMarkerIndex = null;
    draw();
    updateSelectedInfoUI();
    speak("ลบวงล่าสุด");
}

function clearAllMarkers() {
    if (markers.length === 0) return;
    saveStateFull();
    markers = [];
    selectedMarkerIndex = null;
    draw();
    updateSelectedInfoUI();
    speak("ล้างวงทั้งหมดแล้ว");
}

function centerImage() {
    if (!img.src || !img.complete) return;
    imgX = (window.innerWidth - img.width * imgScale) / 2;
    imgY = ((window.innerHeight - 120) - img.height * imgScale) / 2;
    draw();
    speak("จัดกลางรูป");
}

function toggleLockImage() {
    lockImage = !lockImage;
    const btn = document.getElementById("lockBtn");
    if (lockImage) { btn.innerHTML = "🔒 ล็อกรูปแล้ว"; btn.style.background = "#dc2626"; }
    else { btn.innerHTML = "🔓 ปลดล็อกภาพ"; btn.style.background = "#2563eb"; }
    saveStateFull();
    speak(lockImage ? "ล็อกรูป" : "ปลดล็อกรูป");
}

function zoomImage(delta) {
    if (!img.src || !img.complete) return;
    const cx = window.innerWidth / 2;
    const cy = (window.innerHeight - 120) / 2;
    const mouseXimg = (cx - imgX) / imgScale;
    const mouseYimg = (cy - imgY) / imgScale;
    let newScale = imgScale * delta;
    newScale = Math.min(12, Math.max(0.2, newScale));
    imgScale = newScale;
    imgX = cx - mouseXimg * imgScale;
    imgY = cy - mouseYimg * imgScale;
    draw();
}
function zoomImageIn() { zoomImage(1.1); saveStateFull(); speak("ซูมเข้า"); }
function zoomImageOut() { zoomImage(0.9); saveStateFull(); speak("ซูมออก"); }

function setSelectedMarkerZoom(zoomVal) {
    if (selectedMarkerIndex !== null && markers[selectedMarkerIndex]) {
        const clamped = Math.min(12, Math.max(0.5, zoomVal));
        saveStateFull();
        markers[selectedMarkerIndex].zoom = clamped;
        draw();
        updateSelectedInfoUI();
        const msg = `ตั้งกำลังขยายวงเป็น ${clamped}x`;
        voiceFeedbackMsg(msg, false);
        speak(msg);
    } else { voiceFeedbackMsg(`⚠️ ไม่มีวงที่เลือก`, true); speak("ไม่มีวงที่เลือก"); }
}

function selectMarkerByIndex(idx1based) {
    if (idx1based >= 1 && idx1based <= markers.length) {
        selectedMarkerIndex = idx1based - 1;
        selectedTextIndex = null;
        updateTextControlsVisibility();
        draw();
        updateSelectedInfoUI();
        const msg = `เลือกวงที่ ${idx1based}`;
        voiceFeedbackMsg(msg);
        speak(msg);
    } else { voiceFeedbackMsg(`⚠️ ไม่มีวงที่ ${idx1based}`, true); speak(`ไม่มีวงที่ ${idx1based}`); }
}

function selectNextMarker() {
    if (markers.length === 0) { voiceFeedbackMsg(`❌ ไม่มีวง`, true); speak("ไม่มีวง"); return; }
    let next = (selectedMarkerIndex === null) ? 0 : (selectedMarkerIndex + 1) % markers.length;
    selectedMarkerIndex = next;
    selectedTextIndex = null;
    updateTextControlsVisibility();
    draw();
    updateSelectedInfoUI();
    const msg = `เลือกวงที่ ${next+1}`;
    voiceFeedbackMsg(msg);
    speak(msg);
}

function setLineWidthVoice(val) {
    let n = parseInt(val);
    if (isNaN(n)) n = 5;
    n = Math.min(20, Math.max(1, n));
    if (lineWidth !== n) saveStateFull();
    lineWidth = n;
    document.getElementById("lineSlider").value = n;
    document.getElementById("lineValue").innerText = n;
    draw();
    const msg = `เส้นชี้ ${n}`;
    voiceFeedbackMsg(msg);
    speak(msg);
}
function setPointSizeVoice(val) {
    let n = parseInt(val);
    if (isNaN(n)) n = 12;
    n = Math.min(30, Math.max(5, n));
    if (pointSize !== n) saveStateFull();
    pointSize = n;
    document.getElementById("pointSlider").value = n;
    document.getElementById("pointValue").innerText = n;
    draw();
    const msg = `จุดนำ ${n}`;
    voiceFeedbackMsg(msg);
    speak(msg);
}
function setBackgroundColorByName(colStr) {
    const colorMap = {
        "แดง": "#ff0000", "แดงเข้ม": "#b91c1c", "เขียว": "#00ff00", "เขียวเข้ม": "#15803d",
        "น้ำเงิน": "#0000ff", "น้ำเงินเข้ม": "#1e3a8a", "เหลือง": "#ffff00", "ม่วง": "#800080",
        "ส้ม": "#ffa500", "ชมพู": "#ffc0cb", "ดำ": "#000000", "ขาว": "#ffffff",
        "เทา": "#808080", "ฟ้า": "#00ffff", "cyan": "#00ffff", "magenta": "#ff00ff"
    };
    let hex = colorMap[colStr];
    if (!hex && colStr.match(/^#[0-9A-Fa-f]{6}$/)) hex = colStr;
    if (!hex) return false;
    if (canvasBg !== hex) saveStateFull();
    canvasBg = hex;
    document.getElementById("bgColor").value = hex;
    draw();
    const msg = `เปลี่ยนพื้นหลังเป็น ${colStr}`;
    voiceFeedbackMsg(msg);
    speak(msg);
    return true;
}
function toggleBgOverlay() {
    saveStateFull();
    bgEnabled = !bgEnabled;
    applyBackground();
    draw();
    const btn = document.getElementById("bgToggleBtn");
    btn.innerHTML = bgEnabled ? "❌ ปิดพื้นหลัง" : "🖼 เปิดพื้นหลัง";
    const msg = bgEnabled ? "เปิดพื้นหลังรูป" : "ปิดพื้นหลังรูป";
    voiceFeedbackMsg(msg);
    speak(msg);
}
function voiceAddMarkerCenter() {
    let cx = window.innerWidth / 2;
    let cy = (window.innerHeight - 120) / 2;
    addMarker(cx, cy);
    speak("เพิ่มวงตรงกลาง");
}
function downloadImage() {
    const link = document.createElement("a");
    link.download = "trojan_magnifier.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    const msg = "บันทึกภาพแล้ว";
    voiceFeedbackMsg(msg);
    speak(msg);
}

// ===============================
//  VOICE RECOGNITION
// ===============================
let recognition = null;
let listeningActive = false;
const voiceFeedbackSpan = document.getElementById("voiceFeedback");
const micBtn = document.getElementById("voiceMicBtn");

function voiceFeedbackMsg(msg, isError = false) {
    if (voiceFeedbackSpan) {
        voiceFeedbackSpan.innerHTML = `🎙️ ${msg}`;
        voiceFeedbackSpan.style.color = isError ? "#ff8888" : "#ffaa66";
        setTimeout(() => {
            if (voiceFeedbackSpan) voiceFeedbackSpan.style.color = "#ffaa66";
        }, 2500);
    }
}

function stopListening() {
    if (recognition) {
        try { recognition.abort(); } catch(e) {}
        recognition = null;
    }
    listeningActive = false;
    if (micBtn) micBtn.classList.remove("mic-btn-active");
    voiceFeedbackMsg("🎙️ สถานะ: พร้อม (กด 2 หรือปุ่มไมค์)", false);
}

function startVoiceRecognition() {
    if (listeningActive) {
        stopListening();
        setTimeout(() => startVoiceRecognition(), 100);
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceFeedbackMsg("❌ เบราว์เซอร์ไม่รองรับ Speech Recognition", true);
        speak("เบราว์เซอร์ไม่รองรับการฟังเสียง", true);
        return;
    }
    try {
        recognition = new SpeechRecognition();
        recognition.lang = "th-TH";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        
        recognition.onstart = () => {
            listeningActive = true;
            micBtn.classList.add("mic-btn-active");
            voiceFeedbackMsg("🎙️ กำลังฟัง... พูดคำสั่งได้เลย");
            speak("กำลังฟัง", true);
        };
        recognition.onerror = (event) => {
            console.error("Speech error", event.error);
            voiceFeedbackMsg(`⚠️ ข้อผิดพลาด: ${event.error}`, true);
            stopListening();
        };
        recognition.onend = () => {
            stopListening();
        };
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase().trim();
            voiceFeedbackMsg(`🎤 รับรู้: "${transcript}"`);
            processVoiceCommand(transcript);
            stopListening();
        };
        recognition.start();
    } catch(e) {
        voiceFeedbackMsg("ไม่สามารถเริ่มไมค์ได้ กรุณาอนุญาต permission", true);
        speak("กรุณาอนุญาตการใช้ไมค์", true);
    }
}

function processVoiceCommand(cmd) {
    cmd = cmd.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    // ข้อความ
    if (cmd.includes("เพิ่มข้อความ") || cmd.includes("พิมพ์ข้อความ") || cmd.includes("add text")) {
        const txt = prompt("พิมพ์ข้อความภาษาไทยที่ต้องการ:", "สวัสดีไทย");
        if (txt) addTextAtCenter(txt);
        return;
    }
    if (cmd.includes("ลบข้อความ") || cmd === "delete text") { deleteSelectedText(); return; }
    
    if (cmd.includes("เพิ่มวง") || cmd.includes("สร้างวง") || cmd.includes("add marker") || cmd.includes("วงใหม่")) {
        voiceAddMarkerCenter(); return;
    }
    if (cmd.includes("ลบวงล่าสุด") || cmd.includes("ลบวงสุดท้าย") || cmd.includes("delete last") || cmd === "ลบวง") {
        deleteLastMarker(); return;
    }
    if (cmd.includes("ล้างวงทั้งหมด") || cmd.includes("ลบทั้งหมด") || cmd.includes("clear all markers")) {
        clearAllMarkers(); return;
    }
    if (cmd.includes("เลิกทำ") || cmd === "undo") { undo(); return; }
    if (cmd.includes("ทำซ้ำ") || cmd === "redo") { redo(); return; }
    if (cmd.includes("ล็อกรูป")) { if(!lockImage) toggleLockImage(); return; }
    if (cmd.includes("ปลดล็อกรูป")) { if(lockImage) toggleLockImage(); return; }
    if (cmd.includes("สลับล็อกรูป")) { toggleLockImage(); return;}
    if (cmd.includes("จัดกลาง") || cmd.includes("กึ่งกลาง")) { centerImage(); return; }
    if (cmd.includes("บันทึกภาพ") || cmd.includes("export") || cmd.includes("save image")) { downloadImage(); return; }
    if (cmd.includes("ซูมเข้า") || cmd.includes("ขยายภาพเข้า")) { zoomImageIn(); return; }
    if (cmd.includes("ซูมออก") || cmd.includes("ย่อภาพ")) { zoomImageOut(); return; }
    
    let selectMatch = cmd.match(/(เลือกวง|select marker|วงที่)\s*(\d+)/);
    if (selectMatch) { selectMarkerByIndex(parseInt(selectMatch[2])); return; }
    if (cmd.includes("เลือกวงถัดไป") || cmd.includes("next marker")) { selectNextMarker(); return; }
    
    let zoomMatch = cmd.match(/(กำลังขยาย|ซูมวง|set zoom|zoom)\s*(\d+(?:\.\d+)?)/);
    if (zoomMatch) { setSelectedMarkerZoom(parseFloat(zoomMatch[2])); return; }
    
    let lineMatch = cmd.match(/(เส้นชี้|line width)\s*(\d+)/);
    if (lineMatch) { setLineWidthVoice(lineMatch[2]); return; }
    let pointMatch = cmd.match(/(จุดนำ|point size)\s*(\d+)/);
    if (pointMatch) { setPointSizeVoice(pointMatch[2]); return; }
    
    // คำสั่งปรับขนาดรัศมีวงกลมขยาย
    let radiusMatch = cmd.match(/(ขนาดวง|radius|ขยายวง|ตั้งรัศมี)\s*(\d+)/);
    if (radiusMatch) { setMagRadius(parseInt(radiusMatch[2])); return; }
    
    const colorNames = ["แดง", "เขียว", "น้ำเงิน", "เหลือง", "ม่วง", "ส้ม", "ชมพู", "ดำ", "ขาว", "เทา", "ฟ้า", "cyan", "magenta", "แดงเข้ม", "เขียวเข้ม", "น้ำเงินเข้ม"];
    for (let col of colorNames) {
        if (cmd.includes(`พื้นหลัง${col}`) || cmd.includes(`สี${col}`) || (cmd.includes("background") && cmd.includes(col))) {
            setBackgroundColorByName(col);
            return;
        }
    }
    if (cmd.includes("เปิดพื้นหลัง") && !bgEnabled) { toggleBgOverlay(); return; }
    if (cmd.includes("ปิดพื้นหลัง") && bgEnabled) { toggleBgOverlay(); return; }
    if (cmd.includes("สลับพื้นหลัง")) { toggleBgOverlay(); return; }
    if (cmd.includes("พื้นหลังรูปที่1") || cmd.includes("bg 1") || cmd.includes("bg1")) { setBgUrl1(); return; }
    if (cmd.includes("พื้นหลังรูปที่2") || cmd.includes("bg 2") || cmd.includes("bg2")) { setBgUrl2(); return; }
    if (cmd.includes("พื้นหลังรูปที่3") || cmd.includes("bg 3") || cmd.includes("bg3")) { setBgUrl3(); return; }
    
    const unknownMsg = `ไม่รู้จักคำสั่ง: ${cmd}`;
    voiceFeedbackMsg(unknownMsg, true);
    speak(unknownMsg, true);
}

// ===============================
//  EVENT LISTENERS
// ===============================
window.addEventListener("keydown", (e) => {
    if (e.key === "2") { e.preventDefault(); startVoiceRecognition(); }
    if (e.key === "8") { deleteLastMarker(); e.preventDefault(); }
    if (e.ctrlKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    if (e.key === "Escape" && selectedMarkerIndex !== null) { selectedMarkerIndex = null; draw(); updateSelectedInfoUI(); }
    if (e.key === "Delete" && selectedTextIndex !== null) { deleteSelectedText(); e.preventDefault(); }
});
micBtn.addEventListener("click", () => startVoiceRecognition());
document.getElementById("clearAllMarkersBtn").addEventListener("click", () => clearAllMarkers());
document.getElementById("bgUrl1Btn").addEventListener("click", () => setBgUrl1());
document.getElementById("bgUrl2Btn").addEventListener("click", () => setBgUrl2());
const bgUrl3Btn = document.getElementById("bgUrl3Btn");
if (bgUrl3Btn) bgUrl3Btn.addEventListener("click", () => setBgUrl3());
document.getElementById("setCustomBgBtn").addEventListener("click", () => setCustomBgUrl());
document.getElementById("speakToggleBtn").addEventListener("click", () => toggleSpeech());

// ===============================
//  MAGNIFIER RADIUS UI CONTROLS
// ===============================
const radiusSlider = document.getElementById("radiusSlider");
const radiusMinus = document.getElementById("radiusMinusBtn");
const radiusPlus = document.getElementById("radiusPlusBtn");
if (radiusSlider) {
    radiusSlider.addEventListener("input", (e) => setMagRadius(parseInt(e.target.value)));
}
if (radiusMinus) {
    radiusMinus.addEventListener("click", () => setMagRadius(magRadius - 5));
}
if (radiusPlus) {
    radiusPlus.addEventListener("click", () => setMagRadius(magRadius + 5));
}

// ===============================
//  MOUSE/TOUCH (รวมการลากข้อความ)
// ===============================
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX, clientY = e.clientY;
    if (e.touches) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    return { x: clientX - rect.left, y: clientY - rect.top };
}

canvas.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const pos = getMousePos(e);
    let hit = false;
    // Check text first (reverse order)
    for (let i = texts.length - 1; i >= 0; i--) {
        const t = texts[i];
        const box = getTextBoundingBox(t);
        if (pos.x >= box.x && pos.x <= box.x + box.width && pos.y >= box.y && pos.y <= box.y + box.height) {
            draggingTextIndex = i;
            dragTextOffsetX = pos.x - t.x;
            dragTextOffsetY = pos.y - t.y;
            selectedTextIndex = i;
            selectedMarkerIndex = null;
            updateTextControlsVisibility();
            hit = true;
            draw();
            updateSelectedInfoUI();
            break;
        }
    }
    if (!hit) {
        for (let i = 0; i < markers.length; i++) {
            const m = markers[i];
            if (Math.hypot(pos.x - m.x, pos.y - m.y) < 25) { draggingPoint = i; selectedMarkerIndex = i; selectedTextIndex = null; updateTextControlsVisibility(); hit = true; draw(); updateSelectedInfoUI(); break; }
            if (Math.hypot(pos.x - m.bubbleX, pos.y - m.bubbleY) < magRadius) { draggingBubble = i; selectedMarkerIndex = i; selectedTextIndex = null; updateTextControlsVisibility(); hit = true; draw(); updateSelectedInfoUI(); break; }
        }
    }
    if (!hit) {
        if (selectedTextIndex !== null || selectedMarkerIndex !== null) {
            selectedTextIndex = null;
            selectedMarkerIndex = null;
            updateTextControlsVisibility();
            draw();
            updateSelectedInfoUI();
        }
        if (!lockImage && img.src && img.complete && pos.x > imgX && pos.x < imgX+img.width*imgScale && pos.y > imgY && pos.y < imgY+img.height*imgScale) {
            draggingImage = true; offsetX = pos.x - imgX; offsetY = pos.y - imgY;
        }
    }
});

canvas.addEventListener("mousemove", (e) => {
    const pos = getMousePos(e);
    if (draggingTextIndex !== null && texts[draggingTextIndex]) {
        texts[draggingTextIndex].x = pos.x - dragTextOffsetX;
        texts[draggingTextIndex].y = pos.y - dragTextOffsetY;
        draw();
    } else if (draggingPoint !== null && markers[draggingPoint]) {
        markers[draggingPoint].x = pos.x; markers[draggingPoint].y = pos.y; draw();
    } else if (draggingBubble !== null && markers[draggingBubble]) {
        markers[draggingBubble].bubbleX = pos.x; markers[draggingBubble].bubbleY = pos.y; draw();
    } else if (draggingImage) {
        imgX = pos.x - offsetX; imgY = pos.y - offsetY; draw();
    }
});

window.addEventListener("mouseup", () => {
    if (draggingTextIndex !== null) saveStateFull();
    draggingTextIndex = null; draggingPoint = null; draggingBubble = null; draggingImage = false;
});

canvas.addEventListener("touchstart", (e) => { e.preventDefault(); if(e.touches.length===1) canvas.dispatchEvent(new MouseEvent("mousedown", {clientX: e.touches[0].clientX, clientY: e.touches[0].clientY})); });
canvas.addEventListener("touchmove", (e) => { e.preventDefault(); if(e.touches.length===1) canvas.dispatchEvent(new MouseEvent("mousemove", {clientX: e.touches[0].clientX, clientY: e.touches[0].clientY})); });
canvas.addEventListener("touchend", (e) => { e.preventDefault(); canvas.dispatchEvent(new MouseEvent("mouseup")); });
canvas.addEventListener("dblclick", (e) => { const pos = getMousePos(e); addMarker(pos.x, pos.y); });
canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (!img.src || !img.complete) return;
    const pos = getMousePos(e);
    const mouseXimg = (pos.x - imgX) / imgScale;
    const mouseYimg = (pos.y - imgY) / imgScale;
    let delta = e.deltaY < 0 ? 1.08 : 0.93;
    let newScale = imgScale * delta;
    newScale = Math.min(12, Math.max(0.2, newScale));
    imgScale = newScale;
    imgX = pos.x - mouseXimg * imgScale;
    imgY = pos.y - mouseYimg * imgScale;
    draw();
}, { passive: false });

// UI sliders
document.getElementById("zoomSlider").addEventListener("input", (e) => {
    if (selectedMarkerIndex !== null && markers[selectedMarkerIndex]) {
        const val = parseFloat(e.target.value);
        saveStateFull();
        markers[selectedMarkerIndex].zoom = Math.min(12, Math.max(0.5, val));
        draw(); updateSelectedInfoUI();
    }
});
document.getElementById("lineSlider").oninput = () => { 
    const newVal = parseInt(document.getElementById("lineSlider").value);
    if (lineWidth !== newVal) saveStateFull();
    lineWidth = newVal; 
    document.getElementById("lineValue").innerText = lineWidth; 
    draw(); 
};
document.getElementById("pointSlider").oninput = () => { 
    const newVal = parseInt(document.getElementById("pointSlider").value);
    if (pointSize !== newVal) saveStateFull();
    pointSize = newVal; 
    document.getElementById("pointValue").innerText = pointSize; 
    draw(); 
};
document.getElementById("bgColor").addEventListener("input", (e) => { 
    if (canvasBg !== e.target.value) saveStateFull();
    canvasBg = e.target.value; 
    draw(); 
});
document.getElementById("bgToggleBtn").onclick = () => toggleBgOverlay();
document.getElementById("upload").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { img.onload = () => { centerImage(); draw(); }; img.src = ev.target.result; };
    reader.readAsDataURL(file);
});

// Text control event listeners
const textSizeSlider = document.getElementById("textSizeSlider");
const textColorPicker = document.getElementById("textColorPicker");
const editTextBtn = document.getElementById("editTextBtn");
const deleteTextBtn = document.getElementById("deleteTextBtn");

if (textSizeSlider) {
    textSizeSlider.addEventListener("input", (e) => {
        if (selectedTextIndex !== null && texts[selectedTextIndex]) {
            saveStateFull();
            texts[selectedTextIndex].fontSize = parseInt(e.target.value);
            document.getElementById("textSizeValue").innerText = texts[selectedTextIndex].fontSize;
            draw();
            updateTextControlsVisibility();
        }
    });
}
if (textColorPicker) {
    textColorPicker.addEventListener("input", (e) => {
        if (selectedTextIndex !== null && texts[selectedTextIndex]) {
            saveStateFull();
            texts[selectedTextIndex].color = e.target.value;
            draw();
        }
    });
}
if (editTextBtn) editTextBtn.onclick = () => editSelectedText();
if (deleteTextBtn) deleteTextBtn.onclick = () => deleteSelectedText();

function initEmpty() { 
    markers = []; 
    texts = [];
    selectedMarkerIndex = null; 
    selectedTextIndex = null;
    bgEnabled = false;
    applyBackground();
    draw(); 
    updateSelectedInfoUI();
    updateTextControlsVisibility();
    updateTextSelectionStatus();
}
initEmpty();

window.addEventListener("load", () => {
    resizeCanvas();
    setTimeout(() => {
        voiceFeedbackMsg("🔊 ระบบพร้อมใช้งาน: สามารถเพิ่มข้อความไทยได้", false);
    }, 1000);
});

// Expose global functions for inline onclick and external scripts
window.centerImage = centerImage;
window.toggleLockImage = toggleLockImage;
window.downloadImage = downloadImage;
window.addTextAtCenter = addTextAtCenter;
window.draw = draw;
window.saveStateFull = saveStateFull;
window.undo = undo;
window.redo = redo;
window.speak = speak;
window.setBgUrl3 = setBgUrl3;
window.setMagRadius = setMagRadius;   // expose สำหรับปุ่ม HTML

resizeCanvas();