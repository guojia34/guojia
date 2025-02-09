let video = document.getElementById('video');
let canvas = document.getElementById('canvas');
let captureBtn = document.getElementById('captureBtn');
let toggleCamera = document.getElementById('toggleCamera');
let imageUpload = document.getElementById('imageUpload');
let uploadBtn = document.getElementById('uploadBtn');
let imagePreview = document.getElementById('imagePreview');
let previewContainer = document.getElementById('previewContainer');
let storyContent = document.getElementById('storyContent');
let storyHistory = document.getElementById('storyHistory');
let status = document.getElementById('status');
let synth = window.speechSynthesis;  // 语音合成对象
let speaking = false;  // 是否正在朗读
let voices = [];  // 存储可用的声音列表

let currentStoryMode = 'continue';  // 'continue' 或 'new_story'
let stream = null;  // 存储视频流
let isCameraOn = false;
let storyEntries = [];  // 存储故事历史

// 等待声音列表加载
function loadVoices() {
    voices = synth.getVoices();
}

// 监听声音列表变化
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}

// 获取最合适的中文女声
function getBestChineseVoice() {
    loadVoices();
    // 优先选择 Microsoft Xiaoxiao - Chinese (Mainland)
    let voice = voices.find(v => v.name.includes('Xiaoxiao') && v.lang.includes('zh'));
    // 其次选择任何中文女声
    if (!voice) {
        voice = voices.find(v => v.lang.includes('zh') && v.name.includes('Female'));
    }
    // 最后选择任何中文声音
    if (!voice) {
        voice = voices.find(v => v.lang.includes('zh'));
    }
    return voice;
}

// 初始化摄像头
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: 640,
                height: 480
            } 
        });
        video.srcObject = stream;
        captureBtn.disabled = false;
        toggleCamera.textContent = "关闭摄像头";
        isCameraOn = true;
    } catch (err) {
        console.error("摄像头访问失败:", err);
        status.textContent = "无法访问摄像头，请尝试使用图片上传方式";
    }
}

// 停止摄像头
function stopCamera() {
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
        captureBtn.disabled = true;
        toggleCamera.textContent = "开启摄像头";
        isCameraOn = false;
    }
}

// 切换摄像头
toggleCamera.addEventListener('click', async function() {
    if (isCameraOn) {
        stopCamera();
    } else {
        await initCamera();
    }
});

// 处理图片上传预览
imageUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            previewContainer.style.display = 'block';
        }
        reader.readAsDataURL(file);
    }
});

// 处理图片上传
async function handleImageUpload() {
    if (!imageUpload.files[0]) {
        status.textContent = "请先选择一张图片";
        return;
    }
    
    status.textContent = "正在分析画作...";
    
    // 获取上传的图片数据
    const imageData = imagePreview.src;
    await processImage(imageData);
}

// 捕获摄像头画面
async function captureDrawing() {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    await processImage(imageData);
}

// 添加新故事按钮事件处理
document.getElementById('newStoryBtn').addEventListener('click', async function() {
    // 清空历史记录
    storyEntries = [];
    storyHistory.innerHTML = '';
    storyContent.innerHTML = '';
    status.textContent = "请开始绘画吧！";
});

// 添加故事条目
function addStoryEntry(imageData, storyText) {
    const entry = {
        image: imageData,
        text: storyText,
        timestamp: new Date()
    };
    storyEntries.push(entry);
    updateStoryHistory();
}

// 语音朗读函数
function speak(text, autoSpeak = false) {
    // 如果正在朗读，先停止
    if (speaking) {
        synth.cancel();
        speaking = false;
        if (!autoSpeak) {
            return;
        }
    }
    
    // 预处理文本，添加标点符号和语气
    text = text.trim()
        .replace(/([^。！？；\s])(\s+)/g, '$1。') // 在句子末尾添加句号
        .replace(/([^。！？；])(问题|吗|呢)([^。！？；]|$)/g, '$1？$3') // 添加问号
        .replace(/([^。！？；])(真棒|太好了|真厉害)([^。！？；]|$)/g, '$1！$3'); // 添加感叹号
    
    // 创建语音对象
    const utterance = new SpeechSynthesisUtterance(text);
    
    // 设置语音参数
    utterance.lang = 'zh-CN';
    utterance.voice = getBestChineseVoice();  // 设置声音
    utterance.rate = 1.1;      // 稍快的语速
    utterance.pitch = 1.2;     // 提高音高，使声音更年轻
    utterance.volume = 1.0;    // 音量
    
    // 开始/结束事件处理
    utterance.onstart = () => {
        speaking = true;
        // 更新按钮状态
        const speakBtns = document.querySelectorAll('.speak-btn');
        speakBtns.forEach(btn => {
            btn.querySelector('.speak-icon').textContent = '🔈';
        });
    };
    
    // 处理标点符号的停顿
    utterance.onboundary = function(event) {
        if (event.name === 'sentence') {
            // 在句子边界添加适当的停顿
            const pause = new SpeechSynthesisUtterance('');
            pause.pause = 500; // 500ms 的停顿
            synth.speak(pause);
        }
    };
    
    utterance.onend = () => {
        speaking = false;
        // 更新按钮状态
        const speakBtns = document.querySelectorAll('.speak-btn');
        speakBtns.forEach(btn => {
            btn.querySelector('.speak-icon').textContent = '🔊';
        });
    };
    
    // 开始朗读
    synth.speak(utterance);
}

// 更新故事历史显示
function updateStoryHistory() {
    storyHistory.innerHTML = storyEntries.map((entry, index) => `
        <div class="story-entry">
            <h3>第 ${index + 1} 幕</h3>
            <img class="story-image" src="${entry.image}" alt="画作 ${index + 1}">
            <div class="story-text">
                ${entry.text}
                <button class="speak-btn" onclick="speak(this.parentElement.textContent.replace('🔊', '').replace('🔈', ''))">
                    <span class="speak-icon">🔊</span>
                </button>
            </div>
        </div>
    `).join('');
    
    // 自动朗读最新添加的故事
    if (storyEntries.length > 0) {
        const latestEntry = storyEntries[storyEntries.length - 1];
        speak(latestEntry.text, true);
    }
}

// 修改统一的图片处理函数
async function processImage(imageData, action = 'continue') {
    status.textContent = action === 'new_story' ? "准备开始新故事..." : "正在分析画作...";
    
    let retries = 3;
    while (retries > 0) {
        try {
            const requestData = {
                action: action
            };
            
            if (imageData) {
                requestData.image = imageData;
            }

            const response = await fetch('http://localhost:5000/process_drawing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                // 添加到历史记录
                if (imageData) {
                    addStoryEntry(imageData, data.story);
                }

                let storyHtml = '';
                if (data.ending_prompt) {
                    storyHtml += `
                        <div class="story-ending-options">
                            <p>${data.ending_prompt}</p>
                            <button onclick="continueStory()">继续故事</button>
                            <button onclick="endStory()">结束故事</button>
                            <button onclick="startNewStory()">开始新故事</button>
                        </div>
                    `;
                }

                storyContent.innerHTML = storyHtml;
                status.textContent = `${data.storyteller}正在和你说话！`;
                return data;
            } else {
                throw new Error(data.message);
            }
        } catch (err) {
            retries--;
            if (retries > 0) {
                status.textContent = `请求失败，正在重试... (还剩 ${retries} 次尝试)`;
                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                console.error("请求失败:", err);
                status.textContent = "网络请求失败，请检查网络连接后重试";
            }
        }
    }
}

// 故事控制函数
function continueStory() {
    status.textContent = "请继续画下一幅画吧！";
}

function endStory() {
    storyContent.innerHTML += "<p><strong>童话精灵说：</strong>这是一个完美的结局！你真是一个优秀的故事创作者！</p>";
}

function startNewStory() {
    currentStoryMode = 'new_story';
    processImage(null, 'new_story');
}

// 事件监听
captureBtn.addEventListener('click', captureDrawing);
uploadBtn.addEventListener('click', handleImageUpload);

// 初始化
initCamera(); 