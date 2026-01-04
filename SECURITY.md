# 🔒 תיעוד אבטחה - מערכת ניהול מכירות כרטיסי מזל

## סקירה כללית

מסמך זה מתעד את רמת האבטחה הקיימת במערכת, כולל כללי Firebase Security Rules, אימות משתמשים, הרשאות, והגנות מפני איומים נפוצים.

---

## 1. Firebase Security Rules

### מצב נוכחי

כללי Firestore Rules **חייבים** להיערך דרך Firebase Console ולא דרך קוד. 

**⚠️ חשוב:** יש לבדוק את הכללים הנוכחיים ב-Firebase Console ולעדכן אותם בהתאם.

### המלצות לכללי אבטחה

#### כללים מומלצים לפרודקשן:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to check if user is owner
    function isOwner() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.position == 'owner';
    }
    
    // Users collection
    match /users/{userId} {
      // Users can read their own data
      allow read: if isAuthenticated() && request.auth.uid == userId;
      // Only owners can create/update users
      allow create, update: if isOwner();
      // Only owners can delete users
      allow delete: if isOwner();
    }
    
    // Sales collection
    match /sales/{saleId} {
      // Authenticated users can read all sales
      allow read: if isAuthenticated();
      // Authenticated users can create sales
      allow create: if isAuthenticated();
      // Only owners can update/delete sales
      allow update, delete: if isOwner();
    }
    
    // TicketTypes collection
    match /ticketTypes/{ticketId} {
      // Authenticated users can read ticket types
      allow read: if isAuthenticated();
      // Only owners can create/update/delete ticket types
      allow create, update, delete: if isOwner();
    }
    
    // AuditLogs collection
    match /auditLogs/{logId} {
      // Only owners can read audit logs
      allow read: if isOwner();
      // System can create audit logs (authenticated users)
      allow create: if isAuthenticated();
      // No one can update/delete audit logs
      allow update, delete: if false;
    }
    
    // Notifications collection
    match /notifications/{notificationId} {
      // Users can read their own notifications
      allow read: if isAuthenticated() && 
                     resource.data.user_id == request.auth.uid;
      // System can create notifications
      allow create: if isAuthenticated();
      // Users can update their own notifications
      allow update: if isAuthenticated() && 
                       resource.data.user_id == request.auth.uid;
      // Only owners can delete notifications
      allow delete: if isOwner();
    }
  }
}
```

### רמת גישה לכל Collection

| Collection | קריאה | כתיבה | הערות |
|------------|-------|-------|-------|
| `users` | משתמש עצמו | רק זכיינים | משתמשים יכולים לראות רק את הנתונים שלהם |
| `sales` | כל המשתמשים המחוברים | כל המשתמשים המחוברים | עדכון/מחיקה רק לזכיינים |
| `ticketTypes` | כל המשתמשים המחוברים | רק זכיינים | ניהול מלאי - רק לזכיינים |
| `auditLogs` | רק זכיינים | כל המשתמשים המחוברים | יומן פעולות - קריאה רק לזכיינים |
| `notifications` | משתמש עצמו | משתמש עצמו + מערכת | משתמשים רואים רק את ההתראות שלהם |

---

## 2. אימות משתמשים (Authentication)

### שיטות אימות נתמכות

1. **Email/Password** ✅
   - אימות בסיסי עם Firebase Authentication
   - סיסמאות מאוחסנות בצורה מוצפנת ב-Firebase
   - אימות דרך `signInWithEmailAndPassword`

2. **Google Sign-In** ✅ (מומלץ להפעיל)
   - OAuth 2.0 דרך Google
   - אימות דרך `signInWithPopup` או `signInWithRedirect`
   - יצירת משתמש אוטומטית בכניסה ראשונה

### בדיקות אימות

- ✅ כל פעולה דורשת משתמש מחובר (`request.auth != null`)
- ✅ משתמשים יכולים לראות רק את הנתונים שלהם (בחלק מה-Collections)
- ✅ יצירת משתמשים חדשים דורשת הרשאות זכיין

### קבצים רלוונטיים

- `src/firebase/services/auth.js` - לוגיקת אימות
- `src/firebase/config.js` - תצורת Firebase
- `src/pages/Login.jsx` - דף התחברות

---

## 3. הרשאות (Authorization)

### רמות הרשאה

1. **זכיין (Owner)**
   - גישה מלאה לכל הפונקציות
   - יכול ליצור/לערוך/למחוק משתמשים
   - יכול לערוך/למחוק מכירות
   - יכול לנהל מלאי (TicketTypes)
   - יכול לראות יומן פעולות (AuditLogs)

2. **עוזר זכיין (Seller)**
   - יכול ליצור מכירות
   - יכול לראות מכירות
   - יכול לראות מלאי
   - **לא יכול** לנהל משתמשים
   - **לא יכול** לערוך/למחוק מכירות קיימות
   - **לא יכול** לנהל מלאי

### בדיקות הרשאה בקוד

```javascript
// דוגמה לבדיקת הרשאות
const isOwner = user?.position === 'owner' || user?.role === 'admin';

if (!isOwner) {
  // הגבל גישה
  return;
}
```

### קבצים רלוונטיים

- `src/pages/UsersManagement.jsx` - ניהול משתמשים (רק לזכיינים)
- `src/pages/Inventory.jsx` - ניהול מלאי (רק לזכיינים)
- `src/pages/Dashboard.jsx` - לוח בקרה (גישה שונה לפי תפקיד)

---

## 4. HTTPS/SSL

### מצב נוכחי

- ✅ Firebase Hosting מספק HTTPS אוטומטית
- ✅ כל התקשורת עם Firebase נעשית דרך HTTPS
- ✅ אין תקשורת HTTP לא מוצפנת

### המלצות

- ודא שהאפליקציה מוגשת דרך HTTPS בפרודקשן
- בדוק שהתצורה ב-`firebase.json` כוללת redirect מ-HTTP ל-HTTPS

---

## 5. הגנה מפני XSS (Cross-Site Scripting)

### הגנות קיימות

1. **React Escaping** ✅
   - React מספק escaping אוטומטי של תוכן
   - תוכן מוצג דרך JSX מוגן מפני XSS

2. **Input Validation** ⚠️
   - יש לבדוק ולאמת קלט משתמשים לפני שמירה
   - מומלץ להוסיף validation נוסף

### המלצות לשיפור

```javascript
// דוגמה ל-validation
const sanitizeInput = (input) => {
  // הסרת תגי HTML
  return input.replace(/<[^>]*>/g, '');
};

// בדיקת אורך
const validateLength = (input, maxLength) => {
  return input.length <= maxLength;
};
```

### קבצים לבדיקה

- `src/firebase/services/*.js` - בדיקת validation בקלט
- `src/pages/*.jsx` - בדיקת validation בטופסים

---

## 6. הגנה מפני CSRF (Cross-Site Request Forgery)

### מצב נוכחי

- ✅ Firebase Authentication מספק הגנה מובנית מפני CSRF
- ✅ כל בקשות Firebase דורשות token אימות
- ✅ Tokens מוגנים מפני CSRF attacks

### הערות

Firebase Authentication משתמש ב-tokens מאובטחים שמונעים CSRF attacks. אין צורך בהגנה נוספת.

---

## 7. הגבלת מספר משתמשים

### פונקציונליות

- ✅ הגבלה של עד 4 משתמשים פעילים לכל זכיין
- ✅ התראה כאשר מגיעים למגבלה
- ✅ Dialog עם הודעה על תשלום להסרת המגבלה

### יישום

- `src/firebase/services/users.js` - פונקציה `getActiveUsersCount()`
- `src/pages/UsersManagement.jsx` - בדיקה לפני יצירת משתמש חדש

---

## 8. אבטחת נתונים

### הצפנה

- ✅ כל התקשורת עם Firebase מוצפנת (HTTPS/TLS)
- ✅ סיסמאות מאוחסנות בצורה מוצפנת ב-Firebase Authentication
- ✅ אין אחסון סיסמאות בקוד או ב-localStorage

### אחסון מקומי

- ⚠️ `localStorage` משמש לאחסון `currentUserId` בלבד
- ⚠️ אין אחסון של נתונים רגישים ב-localStorage
- ✅ מומלץ לעבור ל-sessionStorage או cookies מאובטחים

---

## 9. המלצות לשיפור

### עדיפות גבוהה

1. **עדכון Firebase Security Rules**
   - החלף את הכללים הנוכחיים בכללים המומלצים לעיל
   - בדוק את הכללים לפני פרודקשן

2. **הוספת Input Validation**
   - הוסף validation לכל שדות הקלט
   - בדוק אורך, פורמט, ותוכן מסוכן

3. **Rate Limiting**
   - הגבל מספר הבקשות לכל משתמש
   - הגבל יצירת משתמשים חדשים

### עדיפות בינונית

4. **Audit Logging**
   - שמור יומן של כל הפעולות החשובות
   - עקוב אחר שינויים בנתונים רגישים

5. **Session Management**
   - הוסף timeout לסשנים
   - הוסף אפשרות להתנתק מכל המכשירים

6. **Two-Factor Authentication (2FA)**
   - הוסף אימות דו-שלבי לזכיינים
   - שימוש ב-Firebase Phone Authentication

### עדיפות נמוכה

7. **Content Security Policy (CSP)**
   - הוסף CSP headers
   - הגבל מקורות מורשים

8. **Security Headers**
   - הוסף security headers נוספים
   - X-Frame-Options, X-Content-Type-Options, וכו'

---

## 10. בדיקות אבטחה מומלצות

### בדיקות ידניות

- [ ] נסה לגשת ל-collections ללא אימות
- [ ] נסה לערוך נתונים של משתמש אחר
- [ ] נסה ליצור משתמשים מעבר למגבלה
- [ ] נסה להזין קוד JavaScript בשדות קלט

### בדיקות אוטומטיות

- [ ] הרץ Firebase Security Rules Emulator
- [ ] בדוק validation של כל הטופסים
- [ ] בדוק שהסיסמאות עומדות בדרישות מינימום

---

## 11. תגובה לאירועי אבטחה

### פרוטוקול תגובה

1. **זיהוי אירוע**
   - זיהוי פעילות חשודה
   - תיעוד האירוע

2. **בידוד**
   - חסימת גישה למשתמש חשוד
   - הגבלת פעולות

3. **תיקון**
   - תיקון הפגיעות
   - עדכון כללי אבטחה

4. **תיעוד**
   - תיעוד האירוע
   - עדכון מסמך זה

---

## 12. עדכונים

- **תאריך יצירה:** 2024
- **תאריך עדכון אחרון:** 2024
- **גרסה:** 1.0

---

## 13. קישורים שימושיים

- [Firebase Security Rules Documentation](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase Authentication Security](https://firebase.google.com/docs/auth/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React Security Best Practices](https://reactjs.org/docs/dom-elements.html#security)

---

**⚠️ הערה חשובה:** מסמך זה מתעד את המצב הנוכחי. יש לעדכן אותו באופן קבוע עם כל שינוי באבטחה.







