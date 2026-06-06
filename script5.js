// ===============================
//  script5.js - Paste Image & Text from Clipboard
// ===============================

(function() {
    // ตัวแจ้งตำแหน่งเมาส์ล่าสุดบน Canvas
    let lastMouseX = window.innerWidth / 2;
    let lastMouseY = (window.innerHeight - 120) / 2;
    
    const canvas = document.getElementById("canvas");
    if (!canvas) return;
    
    // อัปเดตตำแหน่งเมาส์เมื่อเลื่อนบน Canvas
    function updateMousePosition(e) {
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
        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
            lastMouseX = x;
            lastMouseY = y;
        }
    }
    
    canvas.addEventListener("mousemove", updateMousePosition);
    canvas.addEventListener("touchmove", updateMousePosition);
    canvas.addEventListener("mouseenter", (e) => updateMousePosition(e));
    
    // ฟังก์ชันหลักเมื่อวาง (Paste)
    async function handlePaste(e) {
        e.preventDefault();
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;
        
        const items = clipboardData.items;
        let hasImage = false;
        let imageBlob = null;
        let plainText = null;
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf("image") !== -1) {
                hasImage = true;
                imageBlob = item.getAsFile();
                break;
            }
            if (item.type === "text/plain") {
                plainText = await new Promise((resolve) => {
                    item.getAsString(resolve);
                });
            }
        }
        
        if (hasImage && imageBlob) {
            // วางรูป: แทนที่รูปหลัก
            const url = URL.createObjectURL(imageBlob);
            const newImg = new Image();
            newImg.onload = () => {
                // บันทึกสถานะก่อนเปลี่ยนรูป (เพื่อ Undo)
                if (window.saveStateFull) window.saveStateFull();
                
                // แทนที่รูปหลัก
                window.img = newImg;
                window.img.src = url;
                // จัดกึ่งกลางรูปใหม่โดยใช้ฟังก์ชัน centerImage (ถ้ามี)
                if (window.centerImage) window.centerImage();
                else {
                    // fallback
                    window.imgX = (window.innerWidth - window.img.width * window.imgScale) / 2;
                    window.imgY = ((window.innerHeight - 120) - window.img.height * window.imgScale) / 2;
                }
                if (window.draw) window.draw();
                
                const msg = "วางรูปเรียบร้อยแล้ว";
                if (window.voiceFeedbackMsg) window.voiceFeedbackMsg(msg);
                if (window.speak) window.speak(msg);
                
                // ล้าง object URL ภายหลัง
                setTimeout(() => URL.revokeObjectURL(url), 100);
            };
            newImg.onerror = () => {
                const errMsg = "วางรูปไม่สำเร็จ";
                if (window.voiceFeedbackMsg) window.voiceFeedbackMsg(errMsg, true);
                if (window.speak) window.speak(errMsg);
            };
            newImg.src = url;
        }
        else if (plainText && plainText.trim() !== "") {
            // วางข้อความ: สร้าง Annotation ที่ตำแหน่งเมาส์ล่าสุด
            const textContent = plainText.trim();
            // ตรวจสอบว่าตำแหน่งเมาส์อยู่ใน Canvas จริงหรือไม่ (ใช้ lastMouseX/Y)
            let posX = lastMouseX;
            let posY = lastMouseY;
            
            // จำกัดขอบให้ไม่ตกนอก Canvas
            const canvasRect = canvas.getBoundingClientRect();
            posX = Math.min(Math.max(posX, 10), canvasRect.width - 10);
            posY = Math.min(Math.max(posY, 10), canvasRect.height - 10);
            
            // ใช้ฟังก์ชันสร้างข้อความจากโค้ดเดิม (ถ้ามี addTextAtPosition)
            if (window.addTextAtPosition) {
                window.addTextAtPosition(textContent, posX, posY);
            } else {
                // สร้างข้อความด้วยตัวเอง (เลียนแบบ addTextAtCenter แต่กำหนดตำแหน่ง)
                if (window.saveStateFull) window.saveStateFull();
                const defaultFontSize = 28;
                if (!window.texts) window.texts = [];
                if (window.nextTextId === undefined) window.nextTextId = 1;
                
                // วัดความกว้างเพื่อไม่ให้ข้อความล้น
                const ctx = canvas.getContext("2d");
                ctx.font = `${defaultFontSize}px "Sukhumvit Set", "Thonburi", "Noto Sans Thai", system-ui, sans-serif`;
                const metrics = ctx.measureText(textContent);
                const textWidth = metrics.width;
                let anchorX = posX;
                let anchorY = posY - defaultFontSize * 0.6;
                // ปรับหากข้อความเลยขอบขวา
                if (anchorX + textWidth > canvasRect.width - 10) {
                    anchorX = canvasRect.width - textWidth - 10;
                }
                if (anchorX < 10) anchorX = 10;
                
                window.texts.push({
                    id: window.nextTextId++,
                    text: textContent,
                    x: anchorX,
                    y: anchorY,
                    fontSize: defaultFontSize,
                    color: "#ffffff"
                });
                window.selectedTextIndex = window.texts.length - 1;
                window.selectedMarkerIndex = null;
                if (window.updateTextControlsVisibility) window.updateTextControlsVisibility();
                if (window.draw) window.draw();
                if (window.updateTextSelectionStatus) window.updateTextSelectionStatus();
            }
            const msg = `วางข้อความ: ${textContent.substring(0, 30)}${textContent.length > 30 ? "..." : ""}`;
            if (window.voiceFeedbackMsg) window.voiceFeedbackMsg(msg);
            if (window.speak) window.speak("วางข้อความแล้ว");
        }
        else {
            const msg = "ไม่มีรูปหรือข้อความในคลิปบอร์ด";
            if (window.voiceFeedbackMsg) window.voiceFeedbackMsg(msg, true);
            if (window.speak) window.speak(msg);
        }
    }
    
    // ฟังก์ชันเพิ่มข้อความตามตำแหน่ง (เผื่อโค้ดหลักยังไม่มี)
    if (!window.addTextAtPosition) {
        window.addTextAtPosition = function(text, x, y) {
            if (window.saveStateFull) window.saveStateFull();
            const defaultFontSize = 28;
            if (!window.texts) window.texts = [];
            if (window.nextTextId === undefined) window.nextTextId = 1;
            const canvasRect = canvas.getBoundingClientRect();
            const ctx = canvas.getContext("2d");
            ctx.font = `${defaultFontSize}px "Sukhumvit Set", "Thonburi", "Noto Sans Thai", system-ui, sans-serif`;
            const metrics = ctx.measureText(text);
            const textWidth = metrics.width;
            let anchorX = x;
            let anchorY = y - defaultFontSize * 0.6;
            if (anchorX + textWidth > canvasRect.width - 10) {
                anchorX = canvasRect.width - textWidth - 10;
            }
            if (anchorX < 10) anchorX = 10;
            if (anchorY < 10) anchorY = 10;
            window.texts.push({
                id: window.nextTextId++,
                text: text,
                x: anchorX,
                y: anchorY,
                fontSize: defaultFontSize,
                color: "#ffffff"
            });
            window.selectedTextIndex = window.texts.length - 1;
            window.selectedMarkerIndex = null;
            if (window.updateTextControlsVisibility) window.updateTextControlsVisibility();
            if (window.draw) window.draw();
            if (window.updateTextSelectionStatus) window.updateTextSelectionStatus();
        };
    }
    
    // ผูก event paste กับ document
    document.addEventListener("paste", handlePaste);
    
    // แจ้งเตือนเปิดใช้งาน (ไม่บังคับ)
    setTimeout(() => {
        if (window.voiceFeedbackMsg) {
            window.voiceFeedbackMsg("🎉 เปิดใช้งาน วางรูป/ข้อความ (Ctrl+V) แล้ว", false);
        }
    }, 1000);
})();