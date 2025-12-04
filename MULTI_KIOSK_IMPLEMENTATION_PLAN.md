# תוכנית יישום - מערכת מרובת קיוסקים עם ניהול זכיינים

## סקירה כללית

מעבר ממערכת חד-קיוסקית למערכת מרובת קיוסקים עם הפרדת נתונים מלאה לכל קיוסק, כולל מערכת הרשאות היררכית.

---

## 1. מבנה הרשאות חדש

### רמות הרשאה:

1. **מנהל מערכת (System Manager / Admin)**
   - הרשאות מלאות על כל הקיוסקים
   - יכול ליצור זכיינים חדשים
   - יכול ליצור קיוסקים חדשים
   - יכול לראות נתונים מכל הקיוסקים
   - יכול לנהל את כל המשתמשים במערכת

2. **זכיין (Franchisee / Owner)**
   - מנהל קיוסק אחד או יותר (שייך לו)
   - יכול ליצור עוזרי זכיין לקיוסק שלו
   - יכול לנהל את הנתונים של הקיוסק שלו בלבד
   - יכול לראות מכירות, מלאי, דוחות של הקיוסק שלו

3. **עוזר זכיין (Assistant / Seller)**
   - שייך לקיוסק ספציפי
   - יכול ליצור מכירות בקיוסק שלו
   - יכול לראות מכירות ומלאי של הקיוסק שלו בלבד
   - לא יכול לנהל משתמשים או לערוך/למחוק מכירות

---

## 2. מבנה נתונים חדש

### Collection: `kiosks`
```javascript
{
  id: "kiosk_id",
  name: "שם הקיוסק",
  location: "מיקום",
  franchisee_id: "user_id של הזכיין",
  is_active: true,
  created_date: Timestamp,
  updated_date: Timestamp,
  settings: {
    // הגדרות ספציפיות לקיוסק
  }
}
```

### עדכון Collection: `users`
```javascript
{
  id: "user_id",
  email: "user@example.com",
  full_name: "שם מלא",
  role: "system_manager" | "franchisee" | "assistant", // חדש
  position: "owner" | "seller", // נשאר לתאימות לאחור
  kiosk_id: "kiosk_id" | null, // null למנהל מערכת, קיוסק לזכיין/עוזר
  kiosk_ids: ["kiosk_id1", "kiosk_id2"], // למנהל מערכת - כל הקיוסקים, לזכיין - הקיוסקים שלו
  phone: "050-1234567",
  is_active: true,
  created_date: Timestamp,
  updated_date: Timestamp
}
```

### עדכון Collection: `sales`
```javascript
{
    
  id: "sale_id",
  kiosk_id: "kiosk_id", // חדש - חובה
  user_id: "user_id",
  // ... שאר השדות הקיימים
}
```

### עדכון Collection: `ticketTypes`
```javascript
{
  id: "ticket_id",
  kiosk_id: "kiosk_id", // חדש - חובה
  // ... שאר השדות הקיימים
}
```

### עדכון Collection: `auditLogs`
```javascript
{
  id: "log_id",
  kiosk_id: "kiosk_id", // חדש - אופציונלי (לפעולות כלליות)
  user_id: "user_id",
  // ... שאר השדות הקיימים
}
```

---

## 3. שלבי יישום

### שלב 1: יצירת Service לקיוסקים
- [ ] `src/firebase/services/kiosks.js`
  - `getAllKiosks()` - רק למנהל מערכת
  - `getKioskById(kioskId)`
  - `getKiosksByFranchisee(franchiseeId)`
  - `createKiosk(kioskData)`
  - `updateKiosk(kioskId, updateData)`
  - `deleteKiosk(kioskId)`
  - `getKioskForUser(userId)` - מחזיר את הקיוסק של המשתמש

### שלב 2: עדכון User Service
- [ ] עדכון `src/firebase/services/users.js`
  - הוספת שדה `role` (system_manager, franchisee, assistant)
  - הוספת שדה `kiosk_id` או `kiosk_ids`
  - עדכון `createUser()` לתמוך ב-role ו-kiosk
  - פונקציה `getUsersByKiosk(kioskId)`
  - פונקציה `getUsersByRole(role)`

### שלב 3: עדכון Sales Service
- [ ] עדכון `src/firebase/services/sales.js`
  - הוספת `kiosk_id` לכל מכירה
  - עדכון כל השאילתות לסנן לפי `kiosk_id`
  - `getSalesByKiosk(kioskId)`
  - עדכון `createSale()` להוסיף `kiosk_id` אוטומטית

### שלב 4: עדכון TicketTypes Service
- [ ] עדכון `src/firebase/services/ticketTypes.js`
  - הוספת `kiosk_id` לכל סוג כרטיס
  - עדכון כל השאילתות לסנן לפי `kiosk_id`
  - `getTicketTypesByKiosk(kioskId)`
  - עדכון `createTicketType()` להוסיף `kiosk_id` אוטומטית

### שלב 5: עדכון Auth Service
- [ ] עדכון `src/firebase/services/auth.js`
  - `getCurrentUser()` - להוסיף מידע על הקיוסק
  - בדיקת הרשאות לפי role ו-kiosk
  - Helper functions:
    - `isSystemManager(user)`
    - `isFranchisee(user)`
    - `isAssistant(user)`
    - `canAccessKiosk(user, kioskId)`

### שלב 6: יצירת Kiosk Context
- [ ] `src/contexts/KioskContext.jsx`
  - Context לניהול הקיוסק הנוכחי
  - Hook `useKiosk()` לגישה לקיוסק הנוכחי
  - אוטומטית טוען את הקיוסק של המשתמש

### שלב 7: עדכון Layout
- [ ] עדכון `src/pages/Layout.jsx`
  - הצגת שם הקיוסק הנוכחי
  - למנהל מערכת: אפשרות לבחור קיוסק
  - לזכיין: הצגת הקיוסק שלו
  - לעוזר: הצגת הקיוסק שלו

### שלב 8: יצירת דף ניהול קיוסקים
- [ ] `src/pages/KiosksManagement.jsx`
  - רק למנהל מערכת
  - רשימת כל הקיוסקים
  - יצירת קיוסק חדש
  - עריכת קיוסק
  - מחיקת קיוסק
  - הצגת הזכיין של כל קיוסק

### שלב 9: עדכון ניהול משתמשים
- [ ] עדכון `src/pages/UsersManagement.jsx`
  - למנהל מערכת:
    - יצירת זכיינים (עם אפשרות להקצות קיוסק)
    - יצירת עוזרים (עם בחירת קיוסק)
  - לזכיין:
    - יצירת עוזרים לקיוסק שלו בלבד
    - רשימת המשתמשים של הקיוסק שלו בלבד

### שלב 10: עדכון כל הדפים
- [ ] `src/pages/Dashboard.jsx` - סנן לפי kiosk_id
- [ ] `src/pages/SellerPOS.jsx` - הוסף kiosk_id למכירות
- [ ] `src/pages/Inventory.jsx` - סנן לפי kiosk_id
- [ ] `src/pages/SalesHistory.jsx` - סנן לפי kiosk_id
- [ ] `src/pages/Reports.jsx` - סנן לפי kiosk_id
- [ ] `src/pages/AuditLog.jsx` - סנן לפי kiosk_id

### שלב 11: עדכון Firebase Security Rules
- [ ] עדכון כללי Firestore
  - בדיקת role ו-kiosk_id
  - מנהל מערכת: גישה לכל הנתונים
  - זכיין: גישה רק לנתונים של הקיוסק שלו
  - עוזר: גישה רק לנתונים של הקיוסק שלו

### שלב 12: Migration Script
- [ ] `scripts/migrate-to-multi-kiosk.js`
  - יצירת קיוסק ברירת מחדל
  - הוספת kiosk_id לכל המכירות הקיימות
  - הוספת kiosk_id לכל סוגי הכרטיסים הקיימים
  - עדכון משתמשים קיימים עם role ו-kiosk_id

---

## 4. שינויים ב-UI/UX

### Navigation Bar
- הצגת שם הקיוסק הנוכחי
- למנהל מערכת: Dropdown לבחירת קיוסק

### Dashboard
- סטטיסטיקות לפי קיוסק
- למנהל מערכת: אפשרות לבחור קיוסק לצפייה

### Forms
- הוספת kiosk_id אוטומטית (לא נדרש מהמשתמש)
- עוזר זכיין לא רואה אפשרות לבחור קיוסק

---

## 5. כללי אבטחה (Firebase Rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    function isSystemManager() {
      return isAuthenticated() && getUserData().role == 'system_manager';
    }
    
    function isFranchisee() {
      return isAuthenticated() && getUserData().role == 'franchisee';
    }
    
    function isAssistant() {
      return isAuthenticated() && getUserData().role == 'assistant';
    }
    
    function getUserKioskId() {
      return getUserData().kiosk_id;
    }
    
    function canAccessKiosk(kioskId) {
      let userData = getUserData();
      return isSystemManager() || 
             userData.kiosk_id == kioskId ||
             kioskId in userData.kiosk_ids;
    }
    
    // Kiosks collection
    match /kiosks/{kioskId} {
      allow read: if isSystemManager() || canAccessKiosk(kioskId);
      allow create: if isSystemManager();
      allow update, delete: if isSystemManager();
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated() && (
        request.auth.uid == userId || 
        isSystemManager() ||
        (isFranchisee() && get(/databases/$(database)/documents/users/$(userId)).data.kiosk_id == getUserKioskId())
      );
      allow create: if isSystemManager() || isFranchisee();
      allow update: if isSystemManager() || 
                       (isFranchisee() && resource.data.kiosk_id == getUserKioskId());
      allow delete: if isSystemManager();
    }
    
    // Sales collection
    match /sales/{saleId} {
      allow read: if isAuthenticated() && (
        isSystemManager() || 
        canAccessKiosk(resource.data.kiosk_id)
      );
      allow create: if isAuthenticated() && (
        isSystemManager() || 
        canAccessKiosk(request.resource.data.kiosk_id)
      );
      allow update, delete: if isSystemManager() || 
                               (isFranchisee() && canAccessKiosk(resource.data.kiosk_id));
    }
    
    // TicketTypes collection
    match /ticketTypes/{ticketId} {
      allow read: if isAuthenticated() && (
        isSystemManager() || 
        canAccessKiosk(resource.data.kiosk_id)
      );
      allow create: if isAuthenticated() && (
        isSystemManager() || 
        canAccessKiosk(request.resource.data.kiosk_id)
      );
      allow update, delete: if isSystemManager() || 
                               (isFranchisee() && canAccessKiosk(resource.data.kiosk_id));
    }
    
    // AuditLogs collection
    match /auditLogs/{logId} {
      allow read: if isSystemManager() || 
                     (isFranchisee() && (!resource.data.kiosk_id || canAccessKiosk(resource.data.kiosk_id)));
      allow create: if isAuthenticated();
      allow update, delete: if false;
    }
  }
}
```

---

## 6. סדר ביצוע מומלץ

1. **שלב 1-2**: יצירת Kiosk Service ועדכון User Service
2. **שלב 3-4**: עדכון Sales ו-TicketTypes Services
3. **שלב 5**: עדכון Auth Service
4. **שלב 6**: יצירת Kiosk Context
5. **שלב 7**: עדכון Layout
6. **שלב 8**: יצירת דף ניהול קיוסקים
7. **שלב 9**: עדכון ניהול משתמשים
8. **שלב 10**: עדכון כל הדפים
9. **שלב 11**: עדכון Firebase Rules
10. **שלב 12**: Migration Script

---

## 7. הערות חשובות

1. **תאימות לאחור**: יש לשמור על תאימות עם הנתונים הקיימים
2. **Migration**: חובה להריץ את ה-Migration Script לפני העברת המערכת לפרודקשן
3. **בדיקות**: לבדוק כל שלב לפני מעבר לשלב הבא
4. **תיעוד**: לעדכן את SECURITY.md עם הכללים החדשים

---

## 8. החלטות

1. ✅ **זכיין יכול לנהל יותר מקיוסק אחד** - כן
2. ✅ **עוזר יכול לעבוד בכמה קיוסקים** - לא, רק קיוסק אחד
3. ✅ **נתונים קיימים** - לשלב אותם או ליצור מחדש (Migration Script)
4. ✅ **מנהל מערכת** - ניצור משתמש חדש
5. ✅ **עוזר זכיין** - אותן הרשאות כמו קודם (רק למכור) + יכול לשנות עיצוב באפליקציה שלו

---

## 9. הערכת זמן

- שלבים 1-5: ~4-6 שעות
- שלבים 6-9: ~6-8 שעות
- שלב 10: ~4-6 שעות
- שלב 11: ~1-2 שעות
- שלב 12: ~2-3 שעות

**סה"כ: ~17-25 שעות עבודה**

