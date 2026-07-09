// ====== CẤU HÌNH HỆ THỐNG ======
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyUAjJXEwESqUpHDFuZVneloSfcv4-QX3g56VlZU1iAFgjhlJv6W-XV15ftM1S2-2nQ/exec"; 

const SYSTEM_PROMPT = `- Gọi người nói là “thí sinh”.
- BỎ QUA hiện tượng nuốt âm /t/ và /d/ tự nhiên trong Connected Speech. BỎ QUA việc thí sinh đọc to câu hỏi trước khi trả lời. 
- TUYỆT ĐỐI KHÔNG viết những thứ rườm rà, irrelevant như chào hỏi. THEO SÁT FORMAT ĐÃ ĐƯỢC QUY ĐỊNH.
- CẤM dùng các ký tự toán học, CẤM dùng $\\rightarrow$, chỉ dùng mũi tên thường "->".
- Điểm của 4 tiêu chí thành phần (Pronunciation, Fluency, Lexical, Grammar) PHẢI LÀ ĐIỂM TRÒN (Ví dụ: 4.0, 5.0, 6.0, 7.0). Tuyệt đối không dùng điểm lẻ 0.5.
- KHÔNG TÍNH ĐIỂM OVERALL. HỆ THỐNG SẼ TỰ TÍNH.

PHẦN 1: ĐÁNH GIÁ CHI TIẾT THEO 4 TIÊU CHÍ
Viết đánh giá khách quan, VIẾT CHI TIẾT DÀI HƠN về:
- Pronunciation: ending sounds, intonation, stress, đưa ví dụ.
- Fluency and Coherence: tốc độ, ngập ngừng, tự sửa lỗi, từ nối, đưa ví dụ.
- Lexical Resource: độ rộng của từ vựng, collocation, word choice, đưa ví dụ.
- Grammatical Range and Accuracy: ngữ pháp, subject-verb agreement, thì, câu đơn/phức, đưa ví dụ.

PHẦN 2: HƯỚNG DẪN CHỈNH SỬA CHI TIẾT TỪNG CÂU HỎI
Trích xuất và sửa lỗi chi tiết từng câu hỏi:
- CÂU HỎI: Ghi lại câu hỏi.
- CÂU TRẢ LỜI GỐC: Ghi lại câu trả lời gốc. TUYỆT ĐỐI BẮT BUỘC đặt từ sai trong ~~ ~~ và từ sửa lại trong ** ** NGAY CẠNH NHAU (Ví dụ: "I ~~goes~~ **go** to school"). Nếu thừa từ thì chỉ gạch bỏ.
- GIẢI THÍCH: BẮT BUỘC ghi kèm mốc thời gian (phút:giây) xảy ra lỗi đó ở ngay đầu. Sau đó giải thích chi tiết bằng tiếng Việt lý do tại sao sai. Mỗi ý giải thích phải xuống dòng rõ ràng, KHÔNG dùng ký tự liệt kê ở đầu.
- CÂU GỢI Ý (UPGRADED): Viết lại một phiên bản câu trả lời hoàn chỉnh. Tôn trọng ý tưởng gốc. Sử dụng từ vựng đơn giản, tự nhiên. TUYỆT ĐỐI KHÔNG sử dụng từ vựng quá học thuật. (LƯU Ý QUAN TRỌNG: KHÔNG Bọc câu trong dấu ngoặc kép. BẮT BUỘC trả về JSON chuẩn, không tự ý xuống dòng).

PHẦN 3: LỘ TRÌNH/KẾ HOẠCH HỌC TẬP CÁ NHÂN HÓA
Viết ngắn gọn. BẮT BUỘC XUỐNG DÒNG cho mỗi tiêu chí (bắt đầu bằng dấu gạch ngang "-"). Mỗi tiêu chí bao gồm vấn đề và giải pháp khắc phục.`;

const COMBINED_SCHEMA = {
    type: "OBJECT",
    properties: {
        pronunciation_score: { type: "NUMBER" }, pronunciation_feedback: { type: "STRING" },
        fluency_score: { type: "NUMBER" }, fluency_feedback: { type: "STRING" },
        lexical_score: { type: "NUMBER" }, lexical_feedback: { type: "STRING" },
        grammar_score: { type: "NUMBER" }, grammar_feedback: { type: "STRING" },
        qa_corrections: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: { question: { type: "STRING" }, original_answer: { type: "STRING" }, explanation: { type: "STRING" }, upgraded_answer: { type: "STRING" } },
                required: ["question", "original_answer", "explanation", "upgraded_answer"]
            }
        },
        study_plan: { type: "STRING" }
    }, required: ["pronunciation_score", "pronunciation_feedback", "fluency_score", "fluency_feedback", "lexical_score", "lexical_feedback", "grammar_score", "grammar_feedback", "qa_corrections", "study_plan"]
};

// ====== KẾT NỐI GIAO DIỆN ======
const loginScreen = document.getElementById('loginScreen');
const mainApp = document.getElementById('mainApp');
const loginName = document.getElementById('loginName');
const loginEmailInput = document.getElementById('loginEmail');
const btnLogin = document.getElementById('btnLogin');
const headerTitle = document.getElementById('headerTitle');
const btnLogout = document.getElementById('btnLogout');
const gmInput = document.getElementById('geminiKey');
const dgInput = document.getElementById('deepgramKey');
const adminModelContainer = document.getElementById('adminModelContainer');
const adminModelSelect = document.getElementById('adminModelSelect');
const forcePaidCheck = document.getElementById('forcePaidCheck');
const btnResetLimit = document.getElementById('btnResetLimit');
const studentName = document.getElementById('studentName');
const studentId = document.getElementById('studentId');
const btnDelStudent = document.getElementById('btnDelStudent');
const audioFile = document.getElementById('audioFile');
let studentsDB = {};
const includeAudioChk = document.getElementById('includeAudio');
const btnGrade = document.getElementById('btnGrade');
const logBox = document.getElementById('logBox');
const quotaDisplay = document.getElementById('quotaDisplay');
const budgetDisplay = document.getElementById('budgetDisplay');
const allDoneMsg = document.getElementById('allDoneMsg');

let currentName = "";
let currentEmail = "";
let deviceId = "";
let activeTasksCount = 0; // Đếm số bài đang chạy ngầm

// Khiên bảo vệ: Cảnh báo nếu đang có bài chạy ngầm (activeTasksCount > 0)
window.addEventListener('beforeunload', function (e) {
    if (activeTasksCount > 0) {
        e.preventDefault();
        e.returnValue = ''; 
    }
});

function getDeviceId() {
    let id = localStorage.getItem('deviceId');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('deviceId', id); }
    return id;
}

function addLog(msg, type="info") {
    let span = document.createElement('span');
    if(type === "error") span.className = "log-err";
    if(type === "warn") span.className = "log-warn";
    let time = new Date().toLocaleTimeString('en-US', {hour12: false});
    span.innerText = `[${time}] ${msg}\n`;
    logBox.appendChild(span);
    logBox.scrollTop = logBox.scrollHeight;
}
document.getElementById('btnClearLog').addEventListener('click', () => { logBox.innerHTML = ""; });

// KHỞI ĐỘNG
document.addEventListener('DOMContentLoaded', () => {
    deviceId = getDeviceId();
    if (localStorage.getItem('geminiKey')) gmInput.value = localStorage.getItem('geminiKey');
    if (localStorage.getItem('deepgramKey')) dgInput.value = localStorage.getItem('deepgramKey');
    if (localStorage.getItem('savedAdminModel')) adminModelSelect.value = localStorage.getItem('savedAdminModel');
    if (localStorage.getItem('audioChecked') !== null) includeAudioChk.checked = localStorage.getItem('audioChecked') === 'true';

    if (localStorage.getItem('studentsDB')) {
        studentsDB = JSON.parse(localStorage.getItem('studentsDB'));
        updateStudentDropdown();
    }

    let savedName = localStorage.getItem('instructorName');
    let savedEmail = localStorage.getItem('instructorEmail');

    if (savedName && savedEmail) {
        currentName = savedName;
        currentEmail = savedEmail;
        loginScreen.style.display = "none";
        mainApp.style.display = "block";
        fetchQuota();
    }
});

// LƯU TỰ ĐỘNG
gmInput.addEventListener('input', () => localStorage.setItem('geminiKey', gmInput.value));
dgInput.addEventListener('input', () => localStorage.setItem('deepgramKey', dgInput.value));
adminModelSelect.addEventListener('change', () => localStorage.setItem('savedAdminModel', adminModelSelect.value));
includeAudioChk.addEventListener('change', () => localStorage.setItem('audioChecked', includeAudioChk.checked));

btnLogin.addEventListener('click', () => {
    let n = loginName.value.trim();
    let e = loginEmailInput.value.trim();
    if(!n || !e) { alert("Vui lòng nhập đủ Tên và Email!"); return; }
    localStorage.setItem('instructorName', n); localStorage.setItem('instructorEmail', e);
    currentName = n; currentEmail = e;
    loginScreen.style.display = "none";
    mainApp.style.display = "block";
    fetchQuota();
});

headerTitle.addEventListener('click', () => {
    loginName.value = currentName; loginEmailInput.value = currentEmail;
    mainApp.style.display = "none"; loginScreen.style.display = "block";
});

// Sự kiện bấm nút Sign out
btnLogout.addEventListener('click', () => {
    loginName.value = currentName; loginEmailInput.value = currentEmail;
    mainApp.style.display = "none"; loginScreen.style.display = "block";
});

function fetchQuota() {
    quotaDisplay.style.display = "block"; quotaDisplay.innerHTML = "⏳ Đang đồng bộ máy chủ..."; quotaDisplay.style.backgroundColor = "#f1f3f4";
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: "CHECK_STATUS", deviceId: deviceId, instructor: currentName }),
        signal: controller.signal
    }).then(res => { clearTimeout(timeoutId); return res.json(); })
    .then(data => {
        if (data.status === "success") {
            // MÁY CHỦ BÁO LÀ VIP THÌ MỚI ĐƯỢC MỞ GIAO DIỆN VIP
            if (data.isVIP) {
                headerTitle.innerHTML = "Welcome back, Sirr 👑"; headerTitle.style.color = "#d84315";
                adminModelContainer.style.display = "block";
                
                quotaDisplay.innerHTML = `👑 Quota PAID hôm nay: ${data.gradedToday} / ∞ bài`; quotaDisplay.style.backgroundColor = "#fff9c4";
                budgetDisplay.innerHTML = `💰 Ngân sách tháng: ${data.monthSpent.toLocaleString()} / ${data.monthBudget.toLocaleString()} VNĐ`; budgetDisplay.style.display = "block";
            } else {
                let nameParts = currentName.split(/\s+/);
                headerTitle.innerHTML = `👋 Welcome back, ${nameParts[nameParts.length - 1]}`;
                headerTitle.style.color = "#1a73e8"; 
                adminModelContainer.style.display = "none"; forcePaidCheck.checked = false;
                
                quotaDisplay.innerHTML = `📊 Quota PAID hôm nay: ${data.gradedToday} / ${data.limit} bài`; quotaDisplay.style.backgroundColor = "#e8f0fe"; budgetDisplay.style.display = "none";
            }
        } else { quotaDisplay.innerHTML = `⚠️ Lỗi: ${data.message}`; quotaDisplay.style.backgroundColor = "#f8d7da"; }
    }).catch(err => { 
        if (err.name === 'AbortError') {
            quotaDisplay.innerHTML = "⏳ Hệ thống đang phản hồi, vui lòng chờ...";
            setTimeout(fetchQuota, 3000);
        } else {
            quotaDisplay.innerHTML = `⚠️ Mất kết nối máy chủ!`; 
        }
    });
}

// BỘ ĐÁNH THỨC: Khi giáo viên click quay lại Tab này, nếu thấy chữ "Đang đồng bộ..." bị kẹt, web lập tức gọi lệnh mới!
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === 'visible' && quotaDisplay.innerHTML.includes("⏳")) {
        fetchQuota(); 
    }
});

btnResetLimit.addEventListener('click', () => {
    btnResetLimit.innerText = "⏳...";
    fetch(GOOGLE_SCRIPT_URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: "RESET_LIMIT", deviceId: deviceId, instructor: currentName })
    }).then(res => res.json()).then(data => {
        btnResetLimit.innerText = "🔄 Reset";
        if(data.status === "success") { addLog(data.message, "info"); fetchQuota(); } else addLog("Lỗi: " + data.message, "error");
    }).catch(err => { btnResetLimit.innerText = "🔄 Reset"; addLog("Mất kết nối", "error"); });
});

// 1. Giao tiếp Server: Nếu kẹt báo lỗi ngay, không giam lỏng
async function safeFetchWithRetry(payload, maxRetries = 5) {
    let res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    });
    let text = await res.text();
    try {
        return JSON.parse(text); 
    } catch (err) {
        throw new Error("Máy chủ hiện đang có quá nhiều người truy cập cùng lúc. Vui lòng bấm thử lại!");
    }
}

// 2. Máy Ép Audio: Tự động hạ tần số lấy mẫu xuống 16kHz Mono (Giọng nét, dung lượng siêu nhẹ)
async function compressAudio(file) {
    addLog(`⏳ Đang nén tự động để tối ưu đường truyền...`, "info");
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const offlineContext = new OfflineAudioContext(1, audioBuffer.duration * 16000, 16000);
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);
    const renderedBuffer = await offlineContext.startRendering();
    
    const length = renderedBuffer.length * 2;
    const view = new DataView(new ArrayBuffer(44 + length));
    const writeString = (v, o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    
    writeString(view, 0, 'RIFF'); view.setUint32(4, 36 + length, true); writeString(view, 8, 'WAVE'); writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true);
    view.setUint32(28, 16000 * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeString(view, 36, 'data'); view.setUint32(40, length, true);
    
    const channelData = renderedBuffer.getChannelData(0);
    let offset = 44;
    for (let i = 0; i < renderedBuffer.length; i++) {
        let s = Math.max(-1, Math.min(1, channelData[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
}

function forceParseJSON(rawText) {
    let cleaned = rawText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    cleaned = cleaned.replace(/[\u0000-\u001F]+/g, " "); cleaned = cleaned.replace(/[“”]/g, '"');
    if (!cleaned.endsWith('}')) cleaned += '"}';
    try { return JSON.parse(cleaned); } catch(e1) {
        let fixedQuotes = cleaned.replace(/(?<!^)(?<![:{\[\,]\s*)"(?!\s*[:}\]\,])/g, "'");
        try { return JSON.parse(fixedQuotes); } catch(e2) {
            return {
                pronunciation_score: 0, pronunciation_feedback: "⚠️ LỖI FORMAT AI:\n" + rawText,
                fluency_score: 0, fluency_feedback: "", lexical_score: 0, lexical_feedback: "", grammar_score: 0, grammar_feedback: "",
                qa_corrections: [], study_plan: "Lỗi định dạng AI."
            };
        }
    }
}

async function callGeminiAPI(apiKey, model, audioBase64, mimeType, systemPromptConfig, responseSchemaConfig, stepName, sName) {
    addLog(`[${sName}] 🧠 Đang gọi AI [${model}]...`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
        system_instruction: { parts: [{ text: systemPromptConfig }] },
        contents: [{ role: "user", parts: [ { text: `Học viên vừa trả lời IELTS Speaking trong file audio đính kèm.` }, { inlineData: { mimeType: mimeType, data: audioBase64 } } ] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json", responseSchema: responseSchemaConfig }
    };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { let err = new Error(`Lỗi HTTP ${res.status}`); err.status = res.status; throw err; }
    const data = await res.json();
    if (!data.candidates || data.candidates.length === 0) throw new Error("AI trả về rỗng.");
    return forceParseJSON(data.candidates[0].content.parts[0].text);
}

async function gradeWithFallback(apiKey, audioBase64, mimeType, systemPromptConfig, responseSchemaConfig, stepName, targetModel, sName) {
    let backupModel = (targetModel === "gemini-3.5-flash") ? "gemini-3-flash-preview" : "gemini-3.5-flash";
    async function tryModelWithRetries(modelName, maxRetries) {
        for (let i = 1; i <= maxRetries; i++) {
            try { return await callGeminiAPI(apiKey, modelName, audioBase64, mimeType, systemPromptConfig, responseSchemaConfig, stepName, sName); }
            catch (err) {
                if (err.status === 429) { addLog(`[${sName}] ⚠️ Lỗi 429: Hết lượt Free. Kích hoạt PAID API...`, "warn"); throw new Error("PAID_API_TRIGGER"); }
                else if ([503, 529, 500].includes(err.status)) {
                    if (i < maxRetries) { addLog(`[${sName}] ⚠️ AI ${modelName} quá tải. Đợi 10s...`, "warn"); await new Promise(r => setTimeout(r, 10000)); }
                    else throw err;
                } else throw err;
            }
        }
    }
    try { return await tryModelWithRetries(targetModel, 3); } 
    catch (e1) {
        if (e1.message === "PAID_API_TRIGGER") throw e1;
        addLog(`[${sName}] 🔄 CHUYỂN SANG AI DỰ PHÒNG: ${backupModel}...`, "warn");
        try { return await tryModelWithRetries(backupModel, 3); } 
        catch (e2) { 
            addLog(`[${sName}] 🚨 Tất cả Free thất bại. Gọi viện trợ PAID API!`, "warn"); throw new Error("PAID_API_TRIGGER"); 
        }
    }
}

async function synthesizeAnswersWithSilence(apiKey, qaPairs, did, sName) {
    let proxyData = null;
    for (let i = 1; i <= 3; i++) {
        try {
            addLog(`[${sName}] 🎵 [Lần ${i}/3] Đang gửi qua Server tạo Audio...`);
            proxyData = await safeFetchWithRetry({ action: "PROXY_DEEPGRAM", deviceId: did, deepgramKey: apiKey, textArray: qaPairs }, 3);
            if (proxyData.status === "error") throw new Error(proxyData.message);
            break; 
        } catch(err) {
            if (i < 3) {
                addLog(`[${sName}] ⚠️ Lỗi Audio: ${err.message}. Đợi 5s thử lại...`, "warn");
                await new Promise(r => setTimeout(r, 5000));
            } else {
                throw new Error(err.message); 
            }
        }
    }

    addLog(`[${sName}] 🎵 Đang ghép nối âm thanh...`);
    let pcmBuffers = [];
    for (let b64 of proxyData.base64Array) {
        let binStr = atob(b64); let bytes = new Uint8Array(binStr.length);
        for(let j=0; j<binStr.length; j++) bytes[j] = binStr.charCodeAt(j);
        let view = new DataView(bytes.buffer); let pcm = null;
        if(bytes.byteLength > 12 && view.getUint32(0,false)===0x52494646) {
            let offset=12; while(offset+8 <= bytes.byteLength) {
                let chunkId = view.getUint32(offset,false); let chunkSize = view.getUint32(offset+4,true);
                if(chunkId===0x64617461) { pcm = new Uint8Array(bytes.buffer, offset+8, Math.min(chunkSize, bytes.byteLength - offset - 8)); break; }
                offset += 8 + chunkSize + (chunkSize%2);
            }
        }
        if(!pcm && bytes.byteLength>44) pcm = new Uint8Array(bytes.buffer, 44);
        if(pcm) pcmBuffers.push(pcm);
    }
    let sampleRate=24000; let silenceArray=new Uint8Array(sampleRate*2*2); 
    let totalLen=0; pcmBuffers.forEach(p=>totalLen+=p.length);
    if(pcmBuffers.length>1) totalLen += silenceArray.length * (pcmBuffers.length-1);
    
    let outBuf = new ArrayBuffer(44 + totalLen); let view = new DataView(outBuf); let outU8 = new Uint8Array(outBuf);
    let offset = 44;
    pcmBuffers.forEach((pcm, i) => {
        outU8.set(pcm, offset); offset += pcm.length;
        if(i < pcmBuffers.length-1) { outU8.set(silenceArray, offset); offset += silenceArray.length; }
    });
    
    let writeStr = (v, o, s) => { for(let i=0;i<s.length;i++) v.setUint8(o+i, s.charCodeAt(i)); };
    writeStr(view,0,'RIFF'); view.setUint32(4, 36+totalLen, true); writeStr(view,8,'WAVE'); writeStr(view,12,'fmt ');
    view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,sampleRate,true);
    view.setUint32(28,sampleRate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true);
    writeStr(view,36,'data'); view.setUint32(40,totalLen,true);
    return new Blob([outBuf], { type: 'audio/wav' });
}

function blobToBase64(blob) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
    });
}

function triggerDownloadDocx(base64Data, fileName) {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName + ".docx";
    link.click();
}

// BẤM NÚT START (Chạy Đa Luồng Ngầm)
btnGrade.addEventListener('click', async () => {
    let gKey = gmInput.value.trim(); let dKey = dgInput.value.trim();
    let sName = studentName.value.trim(); let sId = studentId.value.trim();
    let file = audioFile.files[0];
    
    if(!gKey || !sName || !sId || !file) { alert("Vui lòng điền đủ Tên, ID, File Audio và Gemini Key!"); return; }
    if(includeAudioChk.checked && !dKey) { alert("Vui lòng nhập Deepgram Key để tạo Audio!"); return; }

    studentsDB[sName] = sId; localStorage.setItem('studentsDB', JSON.stringify(studentsDB));
    updateStudentDropdown(); btnDelStudent.style.display = "none"; 

    // NẾU BẮT ĐẦU 1 LƯỢT CHẤM MỚI TINH, DỌN SẠCH CÁI HỘP XANH THÔNG BÁO CŨ
    if (activeTasksCount === 0) {
        allDoneMsg.style.display = "none";
        allDoneMsg.innerHTML = ""; 
    }

    // KHÓA NÚT 1 GIÂY ĐỂ TRÁNH BẤM ĐÚP, RỒI MỞ LẠI NGAY LẬP TỨC
    btnGrade.disabled = true; 
    btnGrade.innerText = "ĐANG ĐƯA VÀO HÀNG ĐỢI...";
    activeTasksCount++; 
    addLog(`\n--- BẮT ĐẦU CHẤM BÀI: ${sName} ---`);

    let targetModel = (adminModelContainer.style.display === "block") ? adminModelSelect.value : "gemini-3.5-flash";
    let isForceAdmin = (adminModelContainer.style.display === "block") ? forcePaidCheck.checked : false;

    // Gói ghém dữ liệu riêng rẽ cho Tiến trình này
    let taskFile = file;
    let taskIncludeAudio = includeAudioChk.checked;
    
    // Mở khóa Form cho giáo viên làm bài tiếp theo (1 giây)
    setTimeout(() => {
        studentName.value = ""; studentId.value = ""; audioFile.value = "";
        btnGrade.disabled = false;
        btnGrade.innerText = "START GRADING & EXPORT";
    }, 1000);

    // BẮT ĐẦU CHẠY NGẦM ĐA LUỒNG (Fire & Forget)
    (async () => {
        try {
            let finalFileBlob = taskFile;
            if (taskFile.size > 10 * 1024 * 1024) {
                try { 
                    finalFileBlob = await compressAudio(taskFile); 
                    addLog(`[${sName}] ✅ Đã nén Audio (Dung lượng > 10MB) để truyền đi nhanh hơn.`, "info");
                } catch(err) { addLog(`[${sName}] ⚠️ Nén Audio thất bại, sử dụng file gốc...`, "warn"); }
            }
            
            let mimeType = 'audio/wav'; 
            let b64 = await blobToBase64(finalFileBlob);
            
            let aiData;
            if (isForceAdmin) {
                addLog(`[${sName}] 👑 VIP: Đang gọi trực tiếp PAID API qua Server...`);
                let proxyData = await safeFetchWithRetry({ action: "CALL_PAID_GEMINI", deviceId: deviceId, instructor: currentName, audioBase64: b64, mimeType: mimeType, systemPrompt: SYSTEM_PROMPT, schema: COMBINED_SCHEMA, targetModel: targetModel, isForceAdmin: true });
                aiData = forceParseJSON(proxyData.aiResultText);
                if (currentName === "MinhIELTS@2026") addLog(`[${sName}] 💸 TIÊU HAO: ${proxyData.costReport.vnd.toLocaleString()} VNĐ`, "warn");
            } else {
                try { aiData = await gradeWithFallback(gKey, b64, mimeType, SYSTEM_PROMPT, COMBINED_SCHEMA, "Phân tích 4 tiêu chí", targetModel, sName); } 
                catch (err) {
                    if (err.message === "PAID_API_TRIGGER") {
                        addLog(`[${sName}] 🚨 Đang gọi viện trợ PAID API qua Server...`);
                        let proxyData = await safeFetchWithRetry({ action: "CALL_PAID_GEMINI", deviceId: deviceId, instructor: currentName, audioBase64: b64, mimeType: mimeType, systemPrompt: SYSTEM_PROMPT, schema: COMBINED_SCHEMA });
                        aiData = forceParseJSON(proxyData.aiResultText);
                        if (currentName === "MinhIELTS@2026") addLog(`[${sName}] 💸 TIÊU HAO: ${proxyData.costReport.vnd.toLocaleString()} VNĐ`, "warn");
                    } else throw err;
                }
            }
            
            addLog(`[${sName}] ✅ Chấm AI hoàn tất. Đang soạn nội dung...`);
            let formatS = s => Number.isInteger(s) ? s+'.0' : s.toFixed(1);
            let textPart1 = `Pronunciation - ${formatS(aiData.pronunciation_score||0)}:\n${aiData.pronunciation_feedback||""}\n\nFluency and Coherence - ${formatS(aiData.fluency_score||0)}:\n${aiData.fluency_feedback||""}\n\nLexical Resource - ${formatS(aiData.lexical_score||0)}:\n${aiData.lexical_feedback||""}\n\nGrammatical Range and Accuracy - ${formatS(aiData.grammar_score||0)}:\n${aiData.grammar_feedback||""}`;
            
            let validScores = [aiData.pronunciation_score, aiData.fluency_score, aiData.lexical_score, aiData.grammar_score].filter(s=>s>0);
            let over = validScores.length > 0 ? Math.floor((validScores.reduce((a,b)=>a+b,0)/validScores.length)*2)/2 : 0;
            let textOver = `\nOverall: ${over.toFixed(1)}\n\n`;
            
            let textPart2 = ""; let qaPairs = [];
            if(Array.isArray(aiData.qa_corrections)) {
                textPart2 = aiData.qa_corrections.map((item, i) => {
                    let q = (item.question || `Question ${i+1}`).replace(/[*_#]/g, '').replace(/^(Question|Câu\shỏi)\s*\d*\s*[:\-]?\s*/i, '').trim();
                    let o = (item.original_answer || "").replace(/^["'“”]+|["'“”]+$/g, '').trim();
                    let e = (item.explanation || "").trim();
                    let u = (item.upgraded_answer || "").replace(/^["'“”]+|["'“”]+$/g, '').trim();
                    if(q && u) qaPairs.push(`${q}. Answer: ${u}`);
                    return `**Question ${i+1}: ${q}**\nOriginal Answer: “${o}”\nGiải thích:\n${e}\nGợi ý mở rộng/Cải thiện (Upgraded Simple English): “${u}”`;
                }).join('\n\n');
            }
            let textPart3 = `\n\nPHẦN 3:\n${(aiData.study_plan||"").replace(/(?:\s*->\s*|\s+)-\s*(Pronunciation|Fluency|Lexical|Grammar)/gi, '\n- $1')}`;
            let finalText = textPart1 + textOver + textPart2 + textPart3;

            let finalAudioB64 = null;
            if(taskIncludeAudio && qaPairs.length > 0) {
                try {
                    let audBlob = await synthesizeAnswersWithSilence(dKey, qaPairs, deviceId, sName);
                    finalAudioB64 = await blobToBase64(audBlob);
                } catch(e) { addLog(`[${sName}] ⚠️ Bỏ qua Audio: ${e.message}. Vẫn gửi Word!`, "warn"); }
            }

            addLog(`[${sName}] 📧 Đang tạo File và gửi Email cho giáo viên...`);
            let emailData = await safeFetchWithRetry({ action: "EXPORT_AND_EMAIL", name: sName, id: sId, text: finalText, deviceId: deviceId, instructor: currentName, email: currentEmail, audioBase64_final: finalAudioB64 }, 3);
            
            addLog(`[${sName}] 🎉 HOÀN THÀNH: Đã gửi file vào ${currentEmail} !`);
            
            // XỬ LÝ KHUNG THÔNG BÁO VÀ NÚT TẢI VỀ CỘNG DỒN
            allDoneMsg.style.display = "block";
            if (!allDoneMsg.innerHTML.includes("ĐÃ GỬI XONG")) {
                allDoneMsg.innerHTML = `✅ ĐÃ GỬI XONG! KIỂM TRA EMAIL CỦA BẠN.<br>`;
            }
            
            let btnId = "btnDL_" + Date.now() + "_" + Math.floor(Math.random() * 100);
            allDoneMsg.innerHTML += `<button id="${btnId}" style="margin-top: 8px; width: 100%; background-color: #28a745; border-radius: 6px; padding: 8px; font-size: 14px;">📥 Tải Báo Cáo Của: ${sName}</button>`;
            
            setTimeout(() => {
                let newBtn = document.getElementById(btnId);
                if(newBtn) {
                    newBtn.addEventListener('click', () => {
                        const dateStr = new Date().toLocaleDateString('en-GB', {day: '2-digit', month: '2-digit'}).replace('/', '.');
                        triggerDownloadDocx(emailData.fileBase64, `${sName} ${dateStr} IELTS Speaking Assessment`);
                        newBtn.style.display = "none"; // Bấm xong nút tự bốc hơi
                    });
                }
            }, 100);

            fetchQuota(); 
        } catch(err) {
            addLog(`[${sName}] ❌ LỖI: ${err.message}`, "error");
        } finally {
            activeTasksCount--; // Chạy xong giảm biến đếm
            if (activeTasksCount === 0) {
                addLog(`\n🎉 TẤT CẢ CÁC BÀI ĐÃ CHẤM XONG!`);
            }
        }
    })(); // Kết thúc khối chạy ngầm
});
    

// ====== XỬ LÝ LƯU & XÓA HỌC VIÊN ======
function updateStudentDropdown() {
    const dataList = document.getElementById('studentList');
    dataList.innerHTML = "";
    for (let name in studentsDB) {
        let option = document.createElement('option');
        option.value = name; dataList.appendChild(option);
    }
}

studentName.addEventListener('input', () => {
    let name = studentName.value.trim();
    if (studentsDB[name]) {
        studentId.value = studentsDB[name];
        btnDelStudent.style.display = "block";
    } else {
        studentId.value = "";
        btnDelStudent.style.display = "none";
    }
});

btnDelStudent.addEventListener('click', () => {
    let name = studentName.value.trim();
    if (confirm(`Bạn có chắc muốn xóa học viên "${name}" khỏi lịch sử?`)) {
        delete studentsDB[name];
        localStorage.setItem('studentsDB', JSON.stringify(studentsDB));
        updateStudentDropdown();
        studentName.value = ""; studentId.value = "";
        btnDelStudent.style.display = "none";
    }
});
// BẬT/TẮT HỘP HƯỚNG DẪN
document.querySelectorAll('.btn-help').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const helpBox = document.getElementById('helpBox');
        helpBox.style.display = helpBox.style.display === 'none' ? 'block' : 'none';
    });
});
