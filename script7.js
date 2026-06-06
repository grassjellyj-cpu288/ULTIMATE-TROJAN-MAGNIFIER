// script7.js - SMART SHARPEN PRO ULTRA (หน้า 2)
// รองรับการอัปโหลดผ่านปุ่ม + input ซ่อน, ปรับแต่งภาพด้วย LAB sharpen, บันทึกพร้อมตั้งชื่อไฟล์

(function() {
    // รอให้ DOM โหลดเสร็จก่อน
    document.addEventListener('DOMContentLoaded', () => {
        // ========== รับ Elements ==========
        const canvas = document.getElementById('canvas');
        if (!canvas) {
            console.error('ไม่พบ canvas element');
            return;
        }
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const zoomCanvas = document.getElementById('zoomCanvas');
        const zoomCtx = zoomCanvas ? zoomCanvas.getContext('2d') : null;
        
        const uploadInput = document.getElementById('upload');   // input type file ที่ซ่อนอยู่
        const uploadBtn = document.getElementById('uploadBtn');
        const modeSelect = document.getElementById('mode');
        const saveBtn = document.getElementById('saveBtn');
        const applyBtn = document.getElementById('applyBtn');
        const resetBtn = document.getElementById('resetBtn');
        
        const amountSlider = document.getElementById('amount');
        const radiusSlider = document.getElementById('radius');
        const thresholdSlider = document.getElementById('threshold');
        const preblurSlider = document.getElementById('preblur');
        const amountVal = document.getElementById('amountVal');
        const radiusVal = document.getElementById('radiusVal');
        const thresholdVal = document.getElementById('thresholdVal');
        const preblurVal = document.getElementById('preblurVal');
        
        const progressBar = document.getElementById('progressBar');
        const progressFill = document.getElementById('progressFill');
        
        // ตัวแปรเก็บสถานะ
        let originalImageData = null;   // ImageData ต้นฉบับ
        let originalImageElement = null;
        let isProcessing = false;
        
        // ค่าคงที่
        const TILE_SIZE = 256;           // ขนาด tile สำหรับประมวลผล
        const HALO_PROTECTION_FACTOR = 120;
        
        // ค่า LAB reference
        const LAB_X_REF = 0.95047;
        const LAB_Y_REF = 1.00000;
        const LAB_Z_REF = 1.08883;
        const LAB_EPSILON = 0.008856;
        
        // ========== อัปเดตค่าแสดงผล ==========
        if (amountSlider && amountVal) {
            amountSlider.addEventListener('input', () => {
                amountVal.innerText = amountSlider.value;
            });
        }
        if (radiusSlider && radiusVal) {
            radiusSlider.addEventListener('input', () => {
                radiusVal.innerText = radiusSlider.value;
            });
        }
        if (thresholdSlider && thresholdVal) {
            thresholdSlider.addEventListener('input', () => {
                thresholdVal.innerText = thresholdSlider.value;
            });
        }
        if (preblurSlider && preblurVal) {
            preblurSlider.addEventListener('input', () => {
                preblurVal.innerText = preblurSlider.value;
            });
        }
        
        // ========== Progress bar ==========
        function updateProgress(percent) {
            if (!progressBar || !progressFill) return;
            if (percent >= 0 && percent <= 100) {
                progressFill.style.width = percent + '%';
                if (percent >= 100) {
                    setTimeout(() => {
                        progressBar.style.display = 'none';
                        isProcessing = false;
                    }, 400);
                } else {
                    if (progressBar.style.display !== 'block') {
                        progressBar.style.display = 'block';
                    }
                }
            }
        }
        
        // ========== ฟังก์ชันอัปโหลดภาพ ==========
        function loadImageFromFile(file) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    originalImageElement = img;
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    // เคลียร์ซูม
                    if (zoomCtx) zoomCtx.clearRect(0, 0, 220, 220);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
        
        // ปุ่มอัปโหลด: เปิด dialog เลือกไฟล์
        if (uploadBtn && uploadInput) {
            uploadBtn.addEventListener('click', () => {
                uploadInput.click();
            });
            uploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    loadImageFromFile(file);
                }
                // เคลียร์ค่า input เพื่อให้เลือกไฟล์เดิมอีกครั้งได้
                uploadInput.value = '';
            });
        } else {
            console.warn('ไม่พบปุ่มอัปโหลดหรือ input');
        }
        
        // ========== รีเซ็ตภาพ ==========
        function resetImage() {
            if (!originalImageData) {
                alert('ยังไม่มีภาพที่อัปโหลด');
                return;
            }
            if (isProcessing) {
                alert('กำลังประมวลผล กรุณารอสักครู่');
                return;
            }
            ctx.putImageData(originalImageData, 0, 0);
        }
        
        // ========== บันทึกภาพพร้อมตั้งชื่อ ==========
        function saveImageWithName() {
            if (!originalImageData) {
                alert('ไม่มีภาพที่จะบันทึก กรุณาอัปโหลดรูปก่อน');
                return;
            }
            if (isProcessing) {
                alert('กำลังประมวลผล โปรดรอ');
                return;
            }
            let customName = prompt('✨ ตั้งชื่อไฟล์ก่อนเซฟ ✨', 'sharpened_pro');
            if (customName === null) return;
            let fileName = customName.trim();
            if (fileName === '') fileName = 'sharpened_image';
            if (!fileName.toLowerCase().endsWith('.png')) fileName += '.png';
            const link = document.createElement('a');
            link.download = fileName;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
        }
        
        // ========== ฟังก์ชัน LAB Conversions ==========
        function rgbToLab(r, g, b) {
            r = r / 255; g = g / 255; b = b / 255;
            r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
            g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
            b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
            
            let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / LAB_X_REF;
            let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) / LAB_Y_REF;
            let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / LAB_Z_REF;
            
            x = x > LAB_EPSILON ? Math.cbrt(x) : (7.787 * x) + (16 / 116);
            y = y > LAB_EPSILON ? Math.cbrt(y) : (7.787 * y) + (16 / 116);
            z = z > LAB_EPSILON ? Math.cbrt(z) : (7.787 * z) + (16 / 116);
            
            return { l: (116 * y) - 16, a: 500 * (x - y), b: 200 * (y - z) };
        }
        
        function labToRgb(l, a, b) {
            let y = (l + 16) / 116;
            let x = a / 500 + y;
            let z = y - b / 200;
            
            x = Math.pow(x, 3) > LAB_EPSILON ? Math.pow(x, 3) : (x - 16 / 116) / 7.787;
            y = Math.pow(y, 3) > LAB_EPSILON ? Math.pow(y, 3) : (y - 16 / 116) / 7.787;
            z = Math.pow(z, 3) > LAB_EPSILON ? Math.pow(z, 3) : (z - 16 / 116) / 7.787;
            
            x *= LAB_X_REF; y *= LAB_Y_REF; z *= LAB_Z_REF;
            
            let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
            let g = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
            let bb = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;
            
            r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : r * 12.92;
            g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : g * 12.92;
            bb = bb > 0.0031308 ? 1.055 * Math.pow(bb, 1 / 2.4) - 0.055 : bb * 12.92;
            
            return { r: Math.min(255, Math.max(0, r * 255)), g: Math.min(255, Math.max(0, g * 255)), b: Math.min(255, Math.max(0, bb * 255)) };
        }
        
        // ========== Gaussian Blur (Separable) ==========
        function fastBlur(imageData, radius) {
            if (radius < 0.5) return imageData;
            const w = imageData.width, h = imageData.height;
            const src = imageData.data;
            const temp = new ImageData(w, h);
            const tempData = temp.data;
            const size = Math.ceil(radius * 3);
            const kernel = [];
            let sum = 0;
            for (let i = -size; i <= size; i++) {
                const val = Math.exp(-(i * i) / (2 * radius * radius));
                kernel.push(val);
                sum += val;
            }
            for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
            
            // horizontal pass
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let rr = 0, gg = 0, bb = 0, aa = 0;
                    for (let k = 0; k < kernel.length; k++) {
                        const kx = Math.min(w-1, Math.max(0, x + (k - size)));
                        const idx = (y * w + kx) * 4;
                        const weight = kernel[k];
                        rr += src[idx] * weight;
                        gg += src[idx+1] * weight;
                        bb += src[idx+2] * weight;
                        aa += src[idx+3] * weight;
                    }
                    const idx = (y * w + x) * 4;
                    tempData[idx] = rr; tempData[idx+1] = gg; tempData[idx+2] = bb; tempData[idx+3] = aa;
                }
            }
            // vertical pass
            const output = new ImageData(w, h);
            const dst = output.data;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let rr = 0, gg = 0, bb = 0, aa = 0;
                    for (let k = 0; k < kernel.length; k++) {
                        const ky = Math.min(h-1, Math.max(0, y + (k - size)));
                        const idx = (ky * w + x) * 4;
                        const weight = kernel[k];
                        rr += tempData[idx] * weight;
                        gg += tempData[idx+1] * weight;
                        bb += tempData[idx+2] * weight;
                        aa += tempData[idx+3] * weight;
                    }
                    const idx = (y * w + x) * 4;
                    dst[idx] = rr; dst[idx+1] = gg; dst[idx+2] = bb; dst[idx+3] = aa;
                }
            }
            return output;
        }
        
        // ========== Main Sharpen Function ==========
        async function applySharpen() {
            if (!originalImageData) {
                alert('กรุณาอัปโหลดรูปภาพก่อน');
                return;
            }
            if (isProcessing) {
                alert('กำลังประมวลผลอยู่ โปรดรอ');
                return;
            }
            isProcessing = true;
            resetImage();  // กลับไปภาพต้นฉบับ
            
            const amt = parseFloat(amountSlider.value) / 100;
            const rad = parseFloat(radiusSlider.value);
            const thresh = parseFloat(thresholdSlider.value);
            const preBlurVal = parseFloat(preblurSlider.value);
            const mode = modeSelect ? modeSelect.value : 'standard';
            
            // ทำ pre-blur ถ้าต้องการ
            if (preBlurVal > 0) {
                ctx.filter = `blur(${preBlurVal}px)`;
                ctx.drawImage(canvas, 0, 0);
                ctx.filter = 'none';
            }
            
            const srcImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            updateProgress(5);
            await sleep(20);
            
            const blurred = fastBlur(srcImageData, rad);
            updateProgress(15);
            await sleep(10);
            
            const srcData = srcImageData.data;
            const blurData = blurred.data;
            const output = ctx.createImageData(canvas.width, canvas.height);
            const outData = output.data;
            
            const w = canvas.width, h = canvas.height;
            const totalTiles = Math.ceil(h / TILE_SIZE) * Math.ceil(w / TILE_SIZE);
            let processedTiles = 0;
            
            for (let ty = 0; ty < h; ty += TILE_SIZE) {
                await sleep(0);  // ให้ event loop ทำงาน
                const endY = Math.min(ty + TILE_SIZE, h);
                for (let tx = 0; tx < w; tx += TILE_SIZE) {
                    const endX = Math.min(tx + TILE_SIZE, w);
                    for (let y = ty; y < endY; y++) {
                        for (let x = tx; x < endX; x++) {
                            const idx = (y * w + x) * 4;
                            let r = srcData[idx], g = srcData[idx+1], b = srcData[idx+2];
                            const br = blurData[idx], bg = blurData[idx+1], bb = blurData[idx+2];
                            
                            let lab = rgbToLab(r, g, b);
                            let blurLab = rgbToLab(br, bg, bb);
                            let mask = lab.l - blurLab.l;
                            const edge = Math.abs(mask);
                            
                            if (edge > thresh) {
                                let strength = amt;
                                if (mode === 'detail') strength *= 1.4;
                                else if (mode === 'soft') strength *= 0.7;
                                const protect = 1 - Math.min(edge / HALO_PROTECTION_FACTOR, 1);
                                const adaptive = strength * protect;
                                lab.l += mask * adaptive;
                            }
                            const rgb = labToRgb(lab.l, lab.a, lab.b);
                            outData[idx] = rgb.r;
                            outData[idx+1] = rgb.g;
                            outData[idx+2] = rgb.b;
                            outData[idx+3] = srcData[idx+3];
                        }
                    }
                    processedTiles++;
                    const progress = 15 + (processedTiles / totalTiles) * 85;
                    updateProgress(progress);
                    await sleep(0);
                }
            }
            ctx.putImageData(output, 0, 0);
            updateProgress(100);
            isProcessing = false;
        }
        
        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        // ========== ZOOM PREVIEW (mouse & touch) ==========
        if (canvas && zoomCtx) {
            let zoomFrame = null;
            const updateZoom = (clientX, clientY) => {
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                let x = (clientX - rect.left) * scaleX;
                let y = (clientY - rect.top) * scaleY;
                if (isNaN(x) || isNaN(y)) return;
                x = Math.min(Math.max(x, 30), canvas.width - 30);
                y = Math.min(Math.max(y, 30), canvas.height - 30);
                zoomCtx.imageSmoothingEnabled = false;
                zoomCtx.clearRect(0, 0, 220, 220);
                zoomCtx.drawImage(canvas, x-30, y-30, 60, 60, 0, 0, 220, 220);
                // วาดกากบาท
                zoomCtx.strokeStyle = '#00d4ff';
                zoomCtx.lineWidth = 2;
                zoomCtx.beginPath();
                zoomCtx.moveTo(110, 0); zoomCtx.lineTo(110, 220); zoomCtx.stroke();
                zoomCtx.beginPath();
                zoomCtx.moveTo(0, 110); zoomCtx.lineTo(220, 110); zoomCtx.stroke();
                zoomCtx.fillStyle = '#ff6b6b';
                zoomCtx.beginPath();
                zoomCtx.arc(110, 110, 4, 0, 2*Math.PI);
                zoomCtx.fill();
            };
            
            canvas.addEventListener('mousemove', (e) => {
                if (zoomFrame) cancelAnimationFrame(zoomFrame);
                zoomFrame = requestAnimationFrame(() => {
                    updateZoom(e.clientX, e.clientY);
                });
            });
            canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                if (touch) {
                    updateZoom(touch.clientX, touch.clientY);
                }
            }, { passive: false });
        }
        
        // ========== Keyboard Shortcuts ==========
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                resetImage();
            } else if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                applySharpen();
            } else if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                saveImageWithName();
            }
        });
        
        // ========== ผูกปุ่ม ==========
        if (applyBtn) applyBtn.addEventListener('click', applySharpen);
        if (resetBtn) resetBtn.addEventListener('click', resetImage);
        if (saveBtn) saveBtn.addEventListener('click', saveImageWithName);
        
        console.log('✅ script7.js โหลดสำเร็จ | อัปโหลดภาพได้ผ่านปุ่ม และบันทึกพร้อมตั้งชื่อ');
    }); // end DOMContentLoaded
})();