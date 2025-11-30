# הגדרת Firebase

## שלב 1: יצירת פרויקט Firebase

1. לך ל-[Firebase Console](https://console.firebase.google.com/)
2. לחץ על "Add project" או בחר פרויקט קיים
3. מלא את פרטי הפרויקט

## שלב 2: הוספת אפליקציית Web

1. בחר את הפרויקט שיצרת
2. לחץ על האייקון של Web (`</>`)
3. רשום שם לאפליקציה
4. העתק את פרטי התצורה (config)

## שלב 3: הגדרת Firestore Database

1. בחר "Firestore Database" מהתפריט
2. לחץ על "Create database"
3. בחר "Start in test mode" (לפיתוח) או "Start in production mode" (לפרודקשן)
4. בחר מיקום (location) לשרת

## שלב 4: הגדרת Authentication

1. בחר "Authentication" מהתפריט
2. לחץ על "Get started"
3. הפעל "Email/Password" sign-in method
4. שמור את השינויים

## שלב 5: עדכון קובץ התצורה

עדכן את הקובץ `src/firebase/config.js` עם הפרטים מהשלב 2:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## שלב 6: יצירת Collections ב-Firestore

צור את ה-Collections הבאים ב-Firestore:

1. **sales** - מכירות
2. **ticketTypes** - סוגי כרטיסים
3. **users** - משתמשים
4. **auditLogs** - יומן פעולות
5. **notifications** - התראות

## שלב 7: יצירת משתמש ראשון

1. לך ל-Authentication > Users
2. לחץ על "Add user"
3. הזן email וסיסמה
4. שמור את ה-UID של המשתמש
5. לך ל-Firestore > users
6. צור מסמך חדש עם ה-UID כ-ID
7. הוסף את השדות הבאים:
   - `email`: האימייל של המשתמש
   - `full_name`: שם מלא
   - `position`: "owner" (בעל עסק)
   - `is_active`: true
   - `created_date`: תאריך נוכחי

## הערות חשובות

- כל הנתונים נשמרים ב-Firestore
- האימות מתבצע דרך Firebase Authentication
- הקבצים מוכנים לשימוש - רק צריך למלא את פרטי התצורה

