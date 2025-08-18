// استيراد الأدوات اللازمة من Firebase
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get } = require("firebase/database");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

// إعدادات الاتصال بقاعدة البيانات
const firebaseConfig = {
    apiKey: "AIzaSyBvBj7uYIM7m0WiZonfVGyS3CJjh8RaZOA",
    authDomain: "gggg-dc7d0.firebaseapp.com",
    databaseURL: "https://gggg-dc7d0-default-rtdb.firebaseio.com",
    projectId: "gggg-dc7d0",
    storageBucket: "gggg-dc7d0.appspot.com",
    messagingSenderId: "151376454562",
    appId: "1:151376454562:web:1dc3064431b5c7e35388fb"
};

// تهيئة الاتصال
const app = initializeApp(firebaseConfig);
const rtdb = getDatabase(app);
const db = getFirestore(app);

// الدالة الرئيسية
exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { rfid, roomId } = JSON.parse(event.body);
        if (!rfid || !roomId) {
            return { statusCode: 400, body: JSON.stringify({ error: "Missing rfid or roomId" }) };
        }

        // 1. البحث عن المستخدم
        const userRef = ref(rtdb, `allowed_rfids/${rfid}`);
        const userSnapshot = await get(userRef);
        if (!userSnapshot.exists()) {
            return { statusCode: 200, body: JSON.stringify({ action: "deny", reason: "user_not_found" }) };
        }
        const userData = userSnapshot.val();

        // 2. البحث عن المحاضرة الحالية
        const schedulesRef = ref(rtdb, `schedules_by_room/${roomId}`);
        const schedulesSnapshot = await get(schedulesRef);
        if (!schedulesSnapshot.exists()) {
             return { statusCode: 200, body: JSON.stringify({ action: "deny", reason: "no_schedule_for_room" }) };
        }
            
        const schedules = schedulesSnapshot.val();
        const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Africa/Tripoli"}));
        const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
        const today = days[now.getDay()];
        const currentTime = now.getHours() * 60 + now.getMinutes();
        let currentLecture = null;

        for (const key in schedules) {
            const s = schedules[key];
            if (s.day === today) {
                const timeParts = s.time.split('-');
                const startTime = parseInt(timeParts[0].split(':')[0]) * 60 + parseInt(timeParts[0].split(':')[1]);
                const endTime = parseInt(timeParts[1].split(':')[0]) * 60 + parseInt(timeParts[1].split(':')[1]);
                if (currentTime >= startTime && currentTime < endTime) {
                    currentLecture = s;
                    break;
                }
            }
        }

        if (!currentLecture) {
            return { statusCode: 200, body: JSON.stringify({ action: "deny", reason: "no_active_lecture" }) };
        }

        // 3. التحقق من صلاحية الطالب
        if (userData.role === "طالب") {
            const studentSchedulesRef = ref(rtdb, 'StudentSchedules');
            const studentSchedulesSnapshot = await get(studentSchedulesRef);
            const studentSchedules = studentSchedulesSnapshot.val();
            let isRegistered = false;

            if (studentSchedules) {
                for (const key in studentSchedules) {
                    const reg = studentSchedules[key];
                    if (reg.studentId === userData.id && reg.courseCode === currentLecture.courseCode && currentLecture.groups.includes(reg.group)) {
                        isRegistered = true;
                        break;
                    }
                }
            }

            if (isRegistered) {
                // لا نسجل الحضور هنا، فقط نرسل إشارة نجاح
                return { statusCode: 200, body: JSON.stringify({ action: "log_success" }) };
            } else {
                return { statusCode: 200, body: JSON.stringify({ action: "deny", reason: "not_registered" }) };
            }
        }

        // إذا لم يكن طالبًا، أرسل إشارة سماح
        return { statusCode: 200, body: JSON.stringify({ action: "allow_control" }) };

    } catch (error) {
        console.error("Function Error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
    }
};
