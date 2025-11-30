# 🚀 התחלה מהירה עם Firebase

## שלב 1: עדכון פרטי Firebase

1. **פתח את `src/firebase/config.js`**
2. **החלף את `YOUR_*` בפרטי הפרויקט שלך:**
   - לך ל-Firebase Console > Project Settings > General > Your apps
   - העתק את פרטי התצורה

## שלב 2: הרצת סקריפט הכנסת נתונים

לאחר שעדכנת את פרטי Firebase, הרץ:

```bash
npm run seed
```

זה ייצור:
- ✅ 2 משתמשים (בעל עסק, מוכר)
- ✅ 5 סוגי כרטיסים
- ✅ 2 מכירות לדוגמה
- ✅ יומן פעולות

## שלב 3: התחברות לאפליקציה

השתמש בפרטי ההתחברות הבאים:

**בעל עסק:**
- Email: `owner@example.com`
- Password: `owner123456`

**מוכר:**
- Email: `seller@example.com`
- Password: `seller123456`

## שלב 4: הפעלת האפליקציה

```bash
npm run dev
```

---

## ⚠️ חשוב!

לפני הרצת הסקריפט, ודא ש:
1. ✅ עדכנת את `src/firebase/config.js` עם פרטי Firebase
2. ✅ יצרת Firestore Database
3. ✅ הפעלת Email/Password Authentication
4. ✅ יצרת את ה-Collections: `sales`, `ticketTypes`, `users`, `auditLogs`, `notifications`

---

## 🆘 בעיות?

אם יש שגיאה:
- ודא שפרטי Firebase נכונים
- ודא ש-Firestore Database מוגדר
- ודא ש-Authentication מופעל
- בדוק את הקונסול של Firebase לראות שגיאות

