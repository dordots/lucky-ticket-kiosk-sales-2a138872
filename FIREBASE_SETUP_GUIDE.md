# מדריך מפורט להגדרת Firebase

## שלב 1: יצירת פרויקט Firebase

1. **לך ל-Firebase Console:**
   - פתח דפדפן ולך ל: https://console.firebase.google.com/
   - התחבר עם חשבון Google שלך

2. **יצירת פרויקט חדש:**
   - לחץ על הכפתור **"Add project"** או **"Create a project"**
   - הזן שם לפרויקט (לדוגמה: "lucky-ticket-kiosk")
   - לחץ **"Continue"**

3. **הגדרת Google Analytics (אופציונלי):**
   - תוכל לבחור אם להפעיל Google Analytics
   - אם לא, בחר **"Not now"** או **"Disable"**
   - לחץ **"Create project"**

4. **המתן לסיום היצירה:**
   - Firebase יוצר את הפרויקט (זה יכול לקחת כמה שניות)
   - לחץ **"Continue"** כשזה מסתיים

---

## שלב 2: הוספת אפליקציית Web

1. **בחר את הפרויקט שיצרת:**
   - במסך הראשי, לחץ על הפרויקט שלך

2. **הוסף אפליקציית Web:**
   - לחץ על האייקון של **Web** (`</>`) או **"Add app"** > **"Web"**
   - הזן שם לאפליקציה (לדוגמה: "lucky-ticket-app")
   - **אין צורך** לסמן את "Also set up Firebase Hosting" (לעת עתה)
   - לחץ **"Register app"**

3. **העתק את פרטי התצורה:**
   - תראה קוד JavaScript עם פרטי התצורה שלך
   - זה יראה כך:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
   - **העתק את כל הפרטים האלה!** תצטרך אותם בשלב הבא

4. **לחץ "Continue to console"**

---

## שלב 3: הגדרת Firestore Database

1. **פתח את Firestore:**
   - בתפריט השמאלי, לחץ על **"Firestore Database"**
   - לחץ על **"Create database"**

2. **בחר מצב אבטחה:**
   - **לפיתוח:** בחר **"Start in test mode"**
     - ⚠️ **אזהרה:** מצב זה מאפשר גישה לכל הנתונים. השתמש בו רק בפיתוח!
   - **לפרודקשן:** בחר **"Start in production mode"** (נדרש להגדיר כללי אבטחה)
   - לחץ **"Next"**

3. **בחר מיקום לשרת:**
   - בחר מיקום קרוב אליך (לדוגמה: `europe-west` או `us-central`)
   - לחץ **"Enable"**
   - המתן כמה שניות עד שהמסד נתונים נוצר

---

## שלב 4: הגדרת Authentication

1. **פתח את Authentication:**
   - בתפריט השמאלי, לחץ על **"Authentication"**
   - לחץ על **"Get started"**

2. **הפעל Email/Password:**
   - לחץ על הטאב **"Sign-in method"**
   - לחץ על **"Email/Password"**
   - הפעל את המתג **"Enable"**
   - לחץ **"Save"**

---

## שלב 5: עדכון קובץ התצורה באפליקציה

1. **פתח את הקובץ:**
   - פתח את הקובץ: `src/firebase/config.js`

2. **החלף את הפרטים:**
   - החלף את כל הערכים `YOUR_*` בפרטים שהעתקת בשלב 2
   - הקובץ צריך להיראות כך:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...", // העתק מה-console
     authDomain: "your-project.firebaseapp.com", // העתק מה-console
     projectId: "your-project-id", // העתק מה-console
     storageBucket: "your-project.appspot.com", // העתק מה-console
     messagingSenderId: "123456789", // העתק מה-console
     appId: "1:123456789:web:abcdef" // העתק מה-console
   };
   ```

3. **שמור את הקובץ**

---

## שלב 6: יצירת Collections ב-Firestore

Collections הם כמו "טבלאות" במסד נתונים. צריך ליצור 5 Collections:

### איך ליצור Collection:

1. **לך ל-Firestore Database:**
   - בתפריט השמאלי, לחץ על **"Firestore Database"**

2. **צור Collection:**
   - לחץ על **"Start collection"** (אם זו הפעם הראשונה)
   - או לחץ על **"Add collection"** (אם כבר יש לך Collections)

3. **צור את ה-Collections הבאים:**

   #### Collection 1: `sales`
   - Collection ID: `sales`
   - לחץ **"Next"**
   - **אין צורך** להוסיף מסמך עכשיו - לחץ **"Save"**

   #### Collection 2: `ticketTypes`
   - Collection ID: `ticketTypes`
   - לחץ **"Next"** > **"Save"**

   #### Collection 3: `users`
   - Collection ID: `users`
   - לחץ **"Next"** > **"Save"**

   #### Collection 4: `auditLogs`
   - Collection ID: `auditLogs`
   - לחץ **"Next"** > **"Save"**

   #### Collection 5: `notifications`
   - Collection ID: `notifications`
   - לחץ **"Next"** > **"Save"**

---

## שלב 7: יצירת משתמש ראשון

### חלק א': יצירת משתמש ב-Authentication

1. **לך ל-Authentication:**
   - בתפריט השמאלי, לחץ על **"Authentication"**
   - לחץ על הטאב **"Users"**

2. **הוסף משתמש:**
   - לחץ על **"Add user"**
   - הזן **Email** (לדוגמה: `admin@example.com`)
   - הזן **Password** (לפחות 6 תווים)
   - לחץ **"Add user"**
   - **העתק את ה-UID** של המשתמש (זה המזהה הייחודי שלו)

### חלק ב': יצירת מסמך משתמש ב-Firestore

1. **לך ל-Firestore Database:**
   - בתפריט השמאלי, לחץ על **"Firestore Database"**

2. **פתח את Collection `users`:**
   - לחץ על `users`

3. **צור מסמך חדש:**
   - לחץ על **"Add document"**
   - **Document ID:** הדבק את ה-UID שהעתקת (זה חשוב מאוד!)
   - לחץ **"Next"**

4. **הוסף שדות:**
   - לחץ **"Add field"** והוסף את השדות הבאים:

   | Field | Type | Value |
   |-------|------|-------|
   | `email` | string | האימייל של המשתמש |
   | `full_name` | string | השם המלא |
   | `position` | string | `owner` |
   | `is_active` | boolean | `true` |
   | `created_date` | timestamp | לחץ על "Set" ובחר תאריך נוכחי |

5. **שמור:**
   - לחץ **"Save"**

---

## שלב 8: הגדרת כללי אבטחה (Security Rules) - חשוב!

1. **לך ל-Firestore Database:**
   - לחץ על הטאב **"Rules"**

2. **לפיתוח (Test Mode):**
   - אם בחרת "test mode", הכללים כבר מוגדרים:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.time < timestamp.date(2024, 12, 31);
       }
     }
   }
   ```
   - ⚠️ **זה מאפשר גישה חופשית!** השתמש רק בפיתוח.

3. **לפרודקשן (מומלץ):**
   - החלף את הכללים ב:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // רק משתמשים מחוברים יכולים לקרוא ולכתוב
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   - לחץ **"Publish"**

---

## בדיקה שהכל עובד

1. **הפעל את האפליקציה:**
   ```bash
   npm run dev
   ```

2. **נסה להתחבר:**
   - השתמש באימייל והסיסמה שיצרת
   - אם הכל עובד, תראה את הממשק!

---

## טיפים חשובים

- **שמור את פרטי התצורה במקום בטוח** - תצטרך אותם בעתיד
- **אל תשתף את פרטי התצורה** - הם מאפשרים גישה למסד הנתונים שלך
- **בדוק את כללי האבטחה** לפני פרודקשן
- **גבה את הנתונים** באופן קבוע

---

## בעיות נפוצות

### "Firebase: Error (auth/network-request-failed)"
- בדוק את חיבור האינטרנט
- ודא שפרטי התצורה נכונים

### "Firebase: Error (auth/user-not-found)"
- ודא שיצרת את המשתמש ב-Authentication
- ודא שיצרת מסמך ב-Firestore עם אותו UID

### "Permission denied"
- בדוק את כללי האבטחה ב-Firestore Rules
- ודא שהמשתמש מחובר

---

## סיכום

עכשיו יש לך:
✅ פרויקט Firebase פעיל
✅ Firestore Database מוגדר
✅ Authentication מוגדר
✅ Collections נוצרו
✅ משתמש ראשון נוצר
✅ האפליקציה מחוברת ל-Firebase

**הכל מוכן לשימוש!** 🎉

