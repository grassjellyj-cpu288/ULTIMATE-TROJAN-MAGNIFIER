// ============================================
// TROJAN SCREENSHOT TOOL
// script6.js
// ============================================

let captureMode = false;
let startX = 0;
let startY = 0;

const overlay = document.createElement("div");
overlay.id = "captureOverlay";

overlay.style.position = "fixed";
overlay.style.left = "0";
overlay.style.top = "0";
overlay.style.width = "100vw";
overlay.style.height = "100vh";
overlay.style.background = "rgba(0,0,0,0.15)";
overlay.style.display = "none";
overlay.style.cursor = "crosshair";
overlay.style.zIndex = "99998";

document.body.appendChild(overlay);

const selectionBox = document.createElement("div");
selectionBox.id = "selectionBox";

selectionBox.style.position = "fixed";
selectionBox.style.border = "3px dashed #ff0000";
selectionBox.style.background = "rgba(255,0,0,0.1)";
selectionBox.style.display = "none";
selectionBox.style.pointerEvents = "none";
selectionBox.style.zIndex = "99999";

document.body.appendChild(selectionBox);

// ============================================
// เริ่มเลือกพื้นที่
// ============================================

function startCaptureArea() {

    if (typeof html2canvas === "undefined") {

        alert("ไม่พบ html2canvas");

        return;
    }

    captureMode = true;

    overlay.style.display = "block";

    selectionBox.style.display = "none";

    document.body.style.userSelect = "none";
}

// ============================================
// ยกเลิก
// ============================================

function cancelCapture() {

    captureMode = false;

    overlay.style.display = "none";

    selectionBox.style.display = "none";

    document.body.style.userSelect = "";
}

// ============================================
// Mouse Down
// ============================================

overlay.addEventListener("mousedown", (e) => {

    if (!captureMode) return;

    startX = e.clientX;
    startY = e.clientY;

    selectionBox.style.display = "block";

    selectionBox.style.left = startX + "px";
    selectionBox.style.top = startY + "px";
    selectionBox.style.width = "0px";
    selectionBox.style.height = "0px";
});

// ============================================
// Mouse Move
// ============================================

overlay.addEventListener("mousemove", (e) => {

    if (
        !captureMode ||
        selectionBox.style.display === "none"
    ) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selectionBox.style.left = x + "px";
    selectionBox.style.top = y + "px";
    selectionBox.style.width = width + "px";
    selectionBox.style.height = height + "px";
});

// ============================================
// Mouse Up
// ============================================

overlay.addEventListener("mouseup", async () => {

    if (!captureMode) return;

    const x = parseInt(selectionBox.style.left);
    const y = parseInt(selectionBox.style.top);

    const width = parseInt(selectionBox.style.width);
    const height = parseInt(selectionBox.style.height);

    if (width < 10 || height < 10) {

        cancelCapture();

        return;
    }

    try {

        overlay.style.display = "none";

        const screenshot = await html2canvas(
            document.body,
            {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: null,
                logging: false
            }
        );

        const cropCanvas =
            document.createElement("canvas");

        cropCanvas.width = width * 2;
        cropCanvas.height = height * 2;

        const ctx =
            cropCanvas.getContext("2d");

        ctx.drawImage(
            screenshot,
            x * 2,
            y * 2,
            width * 2,
            height * 2,
            0,
            0,
            width * 2,
            height * 2
        );

        const link =
            document.createElement("a");

        link.download =
            `trojan_capture_${Date.now()}.png`;

        link.href =
            cropCanvas.toDataURL(
                "image/png",
                1.0
            );

        document.body.appendChild(link);

        link.click();

        link.remove();

    } catch (err) {

        console.error(err);

        alert("เกิดข้อผิดพลาด");
    }

    cancelCapture();
});

// ============================================
// ESC ยกเลิก
// ============================================

document.addEventListener("keydown", (e) => {

    if (e.key === "Escape") {

        cancelCapture();
    }
});

// ============================================
// Ctrl + Shift + S
// ============================================

document.addEventListener("keydown", (e) => {

    if (
        e.ctrlKey &&
        e.shiftKey &&
        e.key.toLowerCase() === "s"
    ) {

        e.preventDefault();

        startCaptureArea();
    }
});