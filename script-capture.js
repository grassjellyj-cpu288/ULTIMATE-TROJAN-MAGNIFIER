// script-capture.js - สแคปเฉพาะพื้นที่ (ทำงานร่วมกับ onclick="captureScreen()")
(function() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;

    let isCapturing = false;
    let startX = 0, startY = 0, endX = 0, endY = 0;
    let selecting = false;
    let overlayDiv = null, selectBox = null;

    function createOverlay() {
        if (overlayDiv) overlayDiv.remove();
        overlayDiv = document.createElement('div');
        overlayDiv.id = 'capture-area-overlay';
        overlayDiv.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 10000; cursor: crosshair;
            display: none;
        `;
        document.body.appendChild(overlayDiv);
        selectBox = document.createElement('div');
        selectBox.style.cssText = `
            position: absolute; border: 3px solid #0ff;
            background: rgba(0, 255, 255, 0.2);
            pointer-events: none; display: none;
        `;
        overlayDiv.appendChild(selectBox);
    }

    function getCanvasCoords(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let clientX, clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        let canvasX = (clientX - rect.left) * scaleX;
        let canvasY = (clientY - rect.top) * scaleY;
        canvasX = Math.min(Math.max(0, canvasX), canvas.width);
        canvasY = Math.min(Math.max(0, canvasY), canvas.height);
        return { canvasX, canvasY, clientX, clientY };
    }

    function updateSelection(clientX1, clientY1, clientX2, clientY2) {
        const left = Math.min(clientX1, clientX2);
        const top = Math.min(clientY1, clientY2);
        const w = Math.abs(clientX2 - clientX1);
        const h = Math.abs(clientY2 - clientY1);
        selectBox.style.left = left + 'px';
        selectBox.style.top = top + 'px';
        selectBox.style.width = w + 'px';
        selectBox.style.height = h + 'px';
    }

    function startCapture(e) {
        if (!isCapturing) return;
        e.preventDefault();
        const { canvasX, canvasY, clientX, clientY } = getCanvasCoords(e);
        startX = canvasX;
        startY = canvasY;
        endX = canvasX;
        endY = canvasY;
        selecting = true;
        selectBox.style.display = 'block';
        updateSelection(clientX, clientY, clientX, clientY);
    }

    function moveCapture(e) {
        if (!selecting || !isCapturing) return;
        e.preventDefault();
        const { canvasX, canvasY, clientX, clientY } = getCanvasCoords(e);
        endX = canvasX;
        endY = canvasY;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const startClientX = rect.left + startX / scaleX;
        const startClientY = rect.top + startY / scaleY;
        updateSelection(startClientX, startClientY, clientX, clientY);
    }

    function endCapture(e) {
        if (!selecting || !isCapturing) return;
        selecting = false;
        const { canvasX, canvasY } = getCanvasCoords(e);
        endX = canvasX;
        endY = canvasY;
        const w = Math.abs(endX - startX);
        const h = Math.abs(endY - startY);
        if (w < 5 || h < 5) {
            alert("❌ เลือกพื้นที่เล็กเกินไป (ต้องมากกว่า 5px)");
            cancelCapture();
            return;
        }
        showConfirmDialog();
    }

    function showConfirmDialog() {
        const oldPanel = document.getElementById('captureConfirmPanel');
        if (oldPanel) oldPanel.remove();
        const panel = document.createElement('div');
        panel.id = 'captureConfirmPanel';
        panel.style.cssText = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: #1e1e2e; border: 2px solid #0ff; border-radius: 40px;
            padding: 12px 24px; display: flex; gap: 20px; z-index: 10001;
            backdrop-filter: blur(12px);
        `;
        panel.innerHTML = `
            <button id="confirmCrop" style="background:#00d4ff;">✅ บันทึกพื้นที่นี้</button>
            <button id="cancelCrop" style="background:#6c757d;">❌ ยกเลิก</button>
        `;
        document.body.appendChild(panel);
        document.getElementById('confirmCrop').onclick = () => cropAndSave();
        document.getElementById('cancelCrop').onclick = () => cancelCapture();
    }

    function cropAndSave() {
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const w = Math.abs(endX - startX);
        const h = Math.abs(endY - startY);
        if (w <= 0 || h <= 0) return;

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = w;
        cropCanvas.height = h;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

        let fileName = prompt("✨ ตั้งชื่อไฟล์ก่อนเซฟ", "capture_area");
        if (fileName === null) {
            cancelCapture();
            return;
        }
        let name = fileName.trim();
        if (name === "") name = "capture_area";
        if (!name.toLowerCase().endsWith(".png")) name += ".png";

        const link = document.createElement('a');
        link.download = name;
        link.href = cropCanvas.toDataURL('image/png');
        link.click();
        cancelCapture();
        alert(`✅ บันทึกพื้นที่ขนาด ${Math.round(w)}x${Math.round(h)}px แล้ว`);
    }

    function cancelCapture() {
        isCapturing = false;
        selecting = false;
        if (overlayDiv) overlayDiv.style.display = 'none';
        if (selectBox) selectBox.style.display = 'none';
        const panel = document.getElementById('captureConfirmPanel');
        if (panel) panel.remove();
        
        // เปลี่ยนสีปุ่มกลับ (ถ้าหาเจอ)
        const btn = document.querySelector('button[onclick="captureScreen()"]');
        if (btn) btn.style.background = "#10b981";
        document.body.style.cursor = 'default';
    }

    function startCaptureMode() {
        if (isCapturing) {
            cancelCapture();
            return;
        }
        if (!canvas.width || !canvas.height) {
            alert("กรุณาอัปโหลดรูปภาพก่อน");
            return;
        }
        isCapturing = true;
        createOverlay();
        overlayDiv.style.display = 'block';
        selectBox.style.display = 'none';
        
        const btn = document.querySelector('button[onclick="captureScreen()"]');
        if (btn) btn.style.background = "#ef4444";
        
        overlayDiv.addEventListener('mousedown', startCapture);
        overlayDiv.addEventListener('mousemove', moveCapture);
        overlayDiv.addEventListener('mouseup', endCapture);
        overlayDiv.addEventListener('touchstart', startCapture, { passive: false });
        overlayDiv.addEventListener('touchmove', moveCapture, { passive: false });
        overlayDiv.addEventListener('touchend', endCapture);
    }

    // ทำให้ captureScreen เป็นฟังก์ชัน global สำหรับ onclick
    window.captureScreen = startCaptureMode;

    console.log("✅ สแคปเฉพาะพื้นที่พร้อมใช้งานแล้ว (กดปุ่มเขียว)");
})();