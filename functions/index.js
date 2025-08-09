const functions = require("firebase-functions");
const admin = require("firebase-admin");

// تهيئة التطبيق للوصول إلى خدمات Firebase
admin.initializeApp();

// الحصول على مرجع لقاعدة بيانات Firestore
const firestoreDb = admin.firestore();

/**
 * دالة سحابية يتم تشغيلها عند أي تحديث في مسار 'locks/{roomName}' في Realtime Database.
 * تقوم بمزامنة حقل 'status' من Realtime Database إلى المستند المطابق في Firestore.
 */
exports.syncStatusToFirestore = functions.database.ref("/locks/{roomName}")
    .onUpdate(async (change, context) => {
      // الحصول على البيانات الجديدة بعد التغيير
      const newData = change.after.val();
      const roomName = context.params.roomName;

      // التأكد من وجود حقل 'status'
      if (!newData || typeof newData.status === "undefined") {
        console.log(`No status found for room: ${roomName}. Aborting.`);
        return null;
      }

      const newStatus = newData.status;
      console.log(`Syncing status for ${roomName}. New status: ${newStatus}`);

      try {
        // البحث عن مستند القاعة في Firestore الذي له نفس الاسم
        const roomsRef = firestoreDb.collection("Rooms");
        // ملاحظة: في قاعدة بياناتك، اسم القاعة في Realtime DB هو "Room100" بينما في Firestore هو "100"
        // سنقوم بإزالة "Room" من الاسم للبحث بشكل صحيح
        const firestoreRoomName = roomName.replace('Room', '');
        const q = roomsRef.where("name", "==", firestoreRoomName).limit(1);
        const querySnapshot = await q.get();

        if (querySnapshot.empty) {
          console.error(`Error: Room with name '${firestoreRoomName}' not found in Firestore.`);
          return null;
        }

        // الحصول على معرّف المستند وتحديثه
        const roomDoc = querySnapshot.docs[0];
        await roomDoc.ref.update({ status: newStatus });

        console.log(`Successfully synced status for ${firestoreRoomName} to Firestore.`);
        return null;
      } catch (error) {
        console.error(`Error syncing status for ${firestoreRoomName} to Firestore:`, error);
        return null;
      }
    });
