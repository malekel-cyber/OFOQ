
const camera = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const muteBtn = document.getElementById("muteBtn");

const placeholder = document.getElementById("placeholder");

const systemStatus = document.getElementById("systemStatus");
const systemDescription = document.getElementById("systemDescription");

const headerStatus = document.getElementById("headerStatus");
const cameraStatus = document.getElementById("cameraStatus");
const analysisStatus = document.getElementById("analysisStatus");

const lastSpeech = document.getElementById("lastSpeech");
const objectCount = document.getElementById("objectCount");
const objectsList = document.getElementById("objectsList");

const speechSpeed = document.getElementById("speechSpeed");
const confidence = document.getElementById("confidence");

let stream = null;
let model = null;
let running = false;
let muted = false;
let analyzing = false;
let timer = null;

let previousSpeech = "";
let previousSpeechTime = 0;

const arabicNames = {
    person: "شخص",
    bicycle: "دراجة",
    car: "سيارة",
    motorcycle: "دراجة نارية",
    bus: "أتوبيس",
    train: "قطار",
    truck: "شاحنة",
    traffic_light: "إشارة مرور",
    bench: "مقعد",
    dog: "كلب",
    cat: "قطة",
    bird: "طائر",
    backpack: "حقيبة",
    umbrella: "شمسية",
    bottle: "زجاجة",
    cup: "كوب",
    chair: "كرسي",
    couch: "أريكة",
    bed: "سرير",
    dining_table: "طاولة",
    toilet: "مرحاض",
    tv: "شاشة",
    laptop: "لابتوب",
    mouse: "فأرة",
    keyboard: "لوحة مفاتيح",
    cell_phone: "هاتف",
    book: "كتاب",
    clock: "ساعة",
    refrigerator: "ثلاجة",
    vase: "مزهرية"
};

// ==========================
// تشغيل الكاميرا
// ==========================

async function startCamera() {

    if (running) return;

    try {

        systemStatus.textContent = "جارٍ التجهيز";
        systemDescription.textContent = "تحميل نموذج الرؤية وطلب إذن الكاميرا...";
        startBtn.disabled = true;

        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("الكاميرا تحتاج HTTPS أو localhost.");
        }

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        camera.srcObject = stream;

        await camera.play();

        placeholder.style.display = "none";

        cameraStatus.textContent = "تعمل";
        headerStatus.textContent = "الكاميرا تعمل";

        if (!model) {

            systemStatus.textContent = "تحميل الذكاء الاصطناعي";

            model = await cocoSsd.load({
                base: "lite_mobilenet_v2"
            });

        }

        running = true;
        muted = false;

        startBtn.textContent = "✓ المساعدة تعمل";
        stopBtn.disabled = false;
        muteBtn.disabled = false;

        muteBtn.textContent = "🔊 كتم الصوت";

        systemStatus.textContent = "المساعدة تعمل";
        systemDescription.textContent = "يتم تحليل المشهد باستمرار.";

        analysisStatus.textContent = "التحليل مباشر";

        analyzeScene();

    } catch (error) {

        console.error(error);

        stopCamera();

        systemStatus.textContent = "تعذر التشغيل";
        systemDescription.textContent =
            "راجع إذن الكاميرا واتصال الإنترنت.";

        alert(error.message || "حدث خطأ أثناء التشغيل.");

    } finally {

        startBtn.disabled = false;

    }

}

// ==========================
// تحليل المشهد
// ==========================

async function analyzeScene() {

    if (!running || analyzing || !model) return;

    if (camera.readyState < 2) return;

    analyzing = true;

    try {

        const predictions = await model.detect(
            camera,
            10,
            Number(confidence.value)
        );

        drawObjects(predictions);
        showObjects(predictions);
        speakObjects(predictions);

    } catch (error) {

        console.error("Analysis error:", error);

    } finally {

        analyzing = false;

        if (running) {

            timer = setTimeout(analyzeScene, 350);

        }

    }

}

// ==========================
// رسم مربعات الاكتشاف
// ==========================

function drawObjects(predictions) {

    if (!camera.videoWidth) return;

    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 3;
    ctx.font = "bold 18px sans-serif";

    predictions.forEach(object => {

        const [x, y, width, height] = object.bbox;

        ctx.strokeStyle = "#35E6A5";

        ctx.strokeRect(
            x,
            y,
            width,
            height
        );

        const name =
            arabicNames[object.class] || object.class;

        const label =
            name + " " +
            Math.round(object.score * 100) + "%";

        const textWidth = ctx.measureText(label).width;

        ctx.fillStyle = "#35E6A5";

        ctx.fillRect(
            x,
            Math.max(0, y - 28),
            textWidth + 14,
            28
        );

        ctx.fillStyle = "#062117";

        ctx.fillText(
            label,
            x + 7,
            Math.max(20, y - 8)
        );

    });

}

// ==========================
// عرض الأشياء
// ==========================

function showObjects(predictions) {

    objectCount.textContent = predictions.length;

    objectsList.innerHTML = "";

    if (predictions.length === 0) {

        objectsList.innerHTML =
            '<p class="empty">لم يتم اكتشاف شيء واضح</p>';

        return;

    }

    predictions.slice(0, 10).forEach(object => {

        const name =
            arabicNames[object.class] || object.class;

        const tag = document.createElement("span");

        tag.className = "object-tag";

        tag.textContent =
            name + " · " +
            Math.round(object.score * 100) + "%";

        objectsList.appendChild(tag);

    });

}

// ==========================
// وصف المشهد صوتيًا
// ==========================

function speakObjects(predictions) {

    if (muted || !("speechSynthesis" in window)) return;

    if (predictions.length === 0) return;

    const names = [
        ...new Set(
            predictions
                .slice(0, 4)
                .map(object =>
                    arabicNames[object.class] || object.class
                )
        )
    ];

    let message;

    if (names.length === 1) {

        message = "أرى " + names[0];

    } else {

        message = "أرى " + names.slice(0, 3).join("، ");

    }

    const now = Date.now();

    // منع تكرار نفس الكلام بسرعة

    if (
        message === previousSpeech &&
        now - previousSpeechTime < 8000
    ) {
        return;
    }

    // فاصل زمني بين الجمل

    if (now - previousSpeechTime < 3500) {
        return;
    }

    previousSpeech = message;
    previousSpeechTime = now;

    const speech = new SpeechSynthesisUtterance(message);

    speech.lang = "ar-EG";
    speech.rate = Number(speechSpeed.value);

    speechSynthesis.cancel();
    speechSynthesis.speak(speech);

    lastSpeech.textContent = message;

}

// ==========================
// كتم الصوت
// ==========================

muteBtn.addEventListener("click", () => {

    muted = !muted;

    if (muted) {

        speechSynthesis.cancel();

        muteBtn.textContent = "🔇 تشغيل الصوت";

    } else {

        muteBtn.textContent = "🔊 كتم الصوت";

    }

});

// ==========================
// إيقاف الكاميرا
// ==========================

function stopCamera() {

    running = false;

    clearTimeout(timer);

    if (stream) {

        stream.getTracks().forEach(track => {
            track.stop();
        });

        stream = null;

    }

    camera.srcObject = null;

    if ("speechSynthesis" in window) {
        speechSynthesis.cancel();
    }

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    placeholder.style.display = "grid";

    cameraStatus.textContent = "متوقفة";
    headerStatus.textContent = "جاهز للبدء";

    analysisStatus.textContent = "التحليل متوقف";

    systemStatus.textContent = "المساعدة متوقفة";

    systemDescription.textContent =
        "ابدأ تشغيل الكاميرا للبدء.";

    startBtn.textContent = "▶ ابدأ المساعدة";

    stopBtn.disabled = true;
    muteBtn.disabled = true;

    objectCount.textContent = "0";

    objectsList.innerHTML =
        '<p class="empty">لم يتم اكتشاف شيء</p>';

}

startBtn.addEventListener("click", startCamera);

stopBtn.addEventListener("click", stopCamera);

window.addEventListener("pagehide", stopCamera);
