// ============================================================
// script4.js - ระบบข้อความภาษาไทยอิสระ (ไม่พึ่งพา script.js)
// ทำงานร่วมกับ Marker เดิมโดยไม่ชนกัน
// ============================================================
(function() {
    // ========== ตัวแปรส่วนตัวของระบบข้อความ ==========
    let texts = [];              // เก็บข้อความ { id, text, x, y, fontSize, color }
    let selectedTextIndex = null;
    let draggingTextIndex = null;
    let dragOffsetX = 0, dragOffsetY = 0;
    let nextId = 1;
    
    // ========== Helper Functions ==========
    function getCanvas() {
        return document.getElementById('canvas');
    }
    
    function getCtx() {
        const canvas = getCanvas();
        return canvas ? canvas.getContext('2d') : null;
    }
    
    // วัดขนาดข้อความ
    function measureText(text, fontSize) {
        const ctx = getCtx();
        if (!ctx) return { width: 0, height: fontSize * 1.2 };
        ctx.save();
        ctx.font = `${fontSize}px "Sukhumvit Set", "Thonburi", "Noto Sans Thai", system-ui, sans-serif`;
        const metrics = ctx.measureText(text);
        const width = metrics.width;
        ctx.restore();
        return { width, height: fontSize * 1.2 };
    }
    
    // วาดข้อความทั้งหมด (เรียกหลังจาก script.js วาดเสร็จ)
    function drawAllTexts() {
        const ctx = getCtx();
        const canvas = getCanvas();
        if (!ctx || !canvas) return;
        
        for (let i = 0; i < texts.length; i++) {
            const t = texts[i];
            ctx.save();
            ctx.font = `${t.fontSize}px "Sukhumvit Set", "Thonburi", "Noto Sans Thai", system-ui, sans-serif`;
            ctx.fillStyle = t.color;
            ctx.shadowBlur = 4;
            ctx.shadowColor = "rgba(0,0,0,0.6)";
            ctx.textBaseline = "top";
            ctx.fillText(t.text, t.x, t.y);
            ctx.shadowBlur = 0;
            ctx.restore();
            
            // Highlight ถ้าถูกเลือก
            if (selectedTextIndex === i) {
                const box = measureText(t.text, t.fontSize);
                ctx.save();
                ctx.beginPath();
                ctx.rect(t.x, t.y, box.width, box.height);
                ctx.strokeStyle = "#FFD966";
                ctx.lineWidth = 2.5;
                ctx.setLineDash([6, 8]);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            }
        }
    }
    
    // ตรวจสอบว่าคลิกถูกข้อความใด
    function hitTestText(x, y) {
        for (let i = texts.length - 1; i >= 0; i--) {
            const t = texts[i];
            const box = measureText(t.text, t.fontSize);
            if (x >= t.x && x <= t.x + box.width && y >= t.y && y <= t.y + box.height) {
                return i;
            }
        }
        return null;
    }
    
    // เพิ่มข้อความใหม่ (ตำแหน่งกึ่งกลาง canvas)
    function addText(text) {
        if (!text || text.trim() === "") return;
        const canvas = getCanvas();
        if (!canvas) return;
        const centerX = canvas.clientWidth / 2;
        const centerY = canvas.clientHeight / 2;
        const defaultFontSize = 28;
        const measure = measureText(text, defaultFontSize);
        const anchorX = centerX - measure.width / 2;
        const anchorY = centerY - defaultFontSize * 0.6;
        
        texts.push({
            id: nextId++,
            text: text,
            x: anchorX,
            y: anchorY,
            fontSize: defaultFontSize,
            color: "#ffffff"
        });
        selectedTextIndex = texts.length - 1;
        updateTextControlsVisibility();
        refreshCanvas();
    }
    
    // ลบข้อความที่เลือก
    function deleteSelectedText() {
        if (selectedTextIndex !== null && texts[selectedTextIndex]) {
            texts.splice(selectedTextIndex, 1);
            if (texts.length === 0) selectedTextIndex = null;
            else if (selectedTextIndex >= texts.length) selectedTextIndex = texts.length - 1;
            updateTextControlsVisibility();
            refreshCanvas();
        }
    }
    
    // แก้ไขข้อความที่เลือก
    function editSelectedText() {
        if (selectedTextIndex !== null && texts[selectedTextIndex]) {
            const newText = prompt("แก้ไขข้อความ:", texts[selectedTextIndex].text);
            if (newText && newText.trim()) {
                texts[selectedTextIndex].text = newText.trim();
                refreshCanvas();
            }
        }
    }
    
    // อัปเดตแผงควบคุมข้อความ (ขนาด, สี) และปุ่ม Delete
    function updateTextControlsVisibility() {
        const panel = document.getElementById('textControls');
        const sizeSlider = document.getElementById('textSizeSlider');
        const sizeValue = document.getElementById('textSizeValue');
        const colorPicker = document.getElementById('textColorPicker');
        
        if (selectedTextIndex !== null && texts[selectedTextIndex]) {
            if (panel) panel.style.display = "inline-flex";
            const t = texts[selectedTextIndex];
            if (sizeSlider) {
                sizeSlider.value = t.fontSize;
                sizeValue.innerText = t.fontSize;
                sizeSlider.oninput = (e) => {
                    t.fontSize = parseInt(e.target.value);
                    sizeValue.innerText = t.fontSize;
                    refreshCanvas();
                };
            }
            if (colorPicker) {
                colorPicker.value = t.color;
                colorPicker.oninput = (e) => {
                    t.color = e.target.value;
                    refreshCanvas();
                };
            }
        } else {
            if (panel) panel.style.display = "none";
        }
        
        // อัปเดตสถานะปุ่ม Delete
        updateDeleteButtonState();
    }
    
    // อัปเดตสถานะปุ่ม Delete (เปิด/ปิด)
    let deleteBtn = null; // จะถูกกำหนดใน createTextButtons
    function updateDeleteButtonState() {
        if (deleteBtn) {
            deleteBtn.disabled = (selectedTextIndex === null || texts.length === 0);
        }
    }
    
    // รีเฟรช canvas: เรียก draw() ของ script.js (ถ้ามี) แล้วตามด้วยข้อความของเรา
    function refreshCanvas() {
        // เรียก draw() ของระบบหลัก (Marker, รูปภาพ ฯลฯ)
        if (typeof window.draw === 'function') {
            window.draw();
        } else {
            // ถ้าไม่มี draw() ให้หันไปใช้ resize event แทน
            window.dispatchEvent(new Event('resize'));
        }
        // วาดข้อความซ้อนทับ
        drawAllTexts();
    }
    
    // ========== Event Handlers (Mouse/Touch) ==========
    function onMouseDown(e) {
        const canvas = getCanvas();
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        const hit = hitTestText(x, y);
        if (hit !== null) {
            draggingTextIndex = hit;
            const t = texts[hit];
            dragOffsetX = x - t.x;
            dragOffsetY = y - t.y;
            selectedTextIndex = hit;
            updateTextControlsVisibility();
            refreshCanvas();
            e.preventDefault();
        } else {
            // คลิกนอกข้อความ -> ยกเลิกการเลือก
            if (selectedTextIndex !== null) {
                selectedTextIndex = null;
                updateTextControlsVisibility();
                refreshCanvas();
            }
        }
    }
    
    function onMouseMove(e) {
        if (draggingTextIndex === null) return;
        const canvas = getCanvas();
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        const t = texts[draggingTextIndex];
        if (t) {
            t.x = x - dragOffsetX;
            t.y = y - dragOffsetY;
            refreshCanvas();
        }
        e.preventDefault();
    }
    
    function onMouseUp() {
        draggingTextIndex = null;
    }
    
    // ========== สร้างปุ่มทั้งหมด ==========
    function createTextButtons() {
        const topbar = document.querySelector('.topbar');
        if (!topbar) return;
        
        // ========== ปุ่ม Delete (สร้างก่อนเพื่อให้ตัวแปร deleteBtn ถูกตั้งค่า) ==========
        deleteBtn = document.createElement('button');
        deleteBtn.id = 'standaloneDeleteBtn';
        deleteBtn.textContent = '🗑️ ลบข้อความ';
        deleteBtn.style.cssText = 'background:#dc2626; margin-left:8px;';
        deleteBtn.disabled = true;  // เริ่มต้นไม่มีข้อความเลือก
        deleteBtn.onclick = () => deleteSelectedText();
        topbar.appendChild(deleteBtn);
        
        // ========== ปุ่มเพิ่มข้อความด้วย prompt ==========
        const addBtn = document.createElement('button');
        addBtn.id = 'standaloneAddTextBtn';
        addBtn.textContent = '📝 เพิ่มข้อความไทย';
        addBtn.style.cssText = 'background:#8b5cf6; margin-left:8px;';
        addBtn.onclick = () => {
            const txt = prompt("พิมพ์ข้อความภาษาไทย:", "สวัสดี");
            if (txt) addText(txt);
        };
        topbar.appendChild(addBtn);
        
        // ========== ปุ่มพิมพ์ด้วยเสียง ==========
        const voiceBtn = document.createElement('button');
        voiceBtn.id = 'standaloneVoiceBtn';
        voiceBtn.textContent = '🎤 พิมพ์ด้วยเสียง';
        voiceBtn.style.cssText = 'background:#ea580c; margin-left:8px;';
        topbar.appendChild(voiceBtn);
        
        let recognition = null;
        voiceBtn.onclick = () => {
            if (recognition) {
                recognition.abort();
                recognition = null;
                voiceBtn.textContent = '🎤 พิมพ์ด้วยเสียง';
                voiceBtn.style.background = '#ea580c';
                return;
            }
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert('เบราว์เซอร์ไม่รองรับ');
                return;
            }
            recognition = new SpeechRecognition();
            recognition.lang = 'th-TH';
            recognition.continuous = false;
            recognition.onstart = () => {
                voiceBtn.textContent = '🎙️ กำลังฟัง...';
                voiceBtn.style.background = '#f97316';
            };
            recognition.onend = () => {
                voiceBtn.textContent = '🎤 พิมพ์ด้วยเสียง';
                voiceBtn.style.background = '#ea580c';
                recognition = null;
            };
            recognition.onresult = (e) => {
                const text = e.results[0][0].transcript;
                addText(text);
            };
            recognition.start();
        };
        
        // ========== ปุ่มพิมพ์ด้วย Modal ==========
        const modalBtn = document.createElement('button');
        modalBtn.id = 'standaloneModalBtn';
        modalBtn.textContent = '⌨️ พิมพ์ข้อความ';
        modalBtn.style.cssText = 'background:#0d9488; margin-left:8px;';
        topbar.appendChild(modalBtn);
        
        const modal = document.createElement('div');
        modal.id = 'textModalStandalone';
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #1e1e2fcc; backdrop-filter: blur(20px); border-radius: 24px;
            padding: 24px; z-index: 20000; width: 340px; display: none;
            flex-direction: column; gap: 16px; border: 1px solid white;
        `;
        modal.innerHTML = `
            <div style="font-size:20px; font-weight:bold; color:white;">✏️ พิมพ์ข้อความ</div>
            <textarea id="modalText" rows="4" style="padding:12px; border-radius:16px; background:#2d2d3a; color:white;"></textarea>
            <div style="display:flex; gap:12px;">
                <button id="modalCancel" style="background:#6c757d;">ยกเลิก</button>
                <button id="modalAdd" style="background:#0d9488;">เพิ่ม</button>
            </div>
        `;
        document.body.appendChild(modal);
        
        modalBtn.onclick = () => { modal.style.display = 'flex'; };
        document.getElementById('modalCancel')?.addEventListener('click', () => { modal.style.display = 'none'; });
        document.getElementById('modalAdd')?.addEventListener('click', () => {
            const txt = document.getElementById('modalText')?.value.trim();
            if (txt) addText(txt);
            modal.style.display = 'none';
        });
        
        // อัปเดตสถานะปุ่ม Delete ครั้งแรก
        updateDeleteButtonState();
    }
    
    // ========== เริ่มต้นระบบ ==========
    function init() {
        // รอให้ canvas พร้อม
        const canvas = getCanvas();
        if (!canvas) {
            setTimeout(init, 100);
            return;
        }
        
        // ผูก event (ต่อท้าย event เดิม ใช้ addEventListener แบบไม่ลบของเดิม)
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('touchstart', onMouseDown);
        canvas.addEventListener('touchmove', onMouseMove);
        canvas.addEventListener('touchend', onMouseUp);
        
        // สร้างปุ่มทั้งหมด
        createTextButtons();
        
        // Patch draw() ของระบบหลักให้วาดข้อความของเราด้วย (ถ้า draw มีอยู่)
        const originalDraw = window.draw;
        if (typeof originalDraw === 'function') {
            window.draw = function() {
                originalDraw();
                drawAllTexts();
            };
        }
        
        // เรียก refresh ครั้งแรกเพื่อให้ข้อความแสดง (ถ้ามี)
        refreshCanvas();
        console.log('✅ ระบบข้อความอิสระทำงานแล้ว (รวมปุ่ม Delete)');
    }
    
    init();
})();