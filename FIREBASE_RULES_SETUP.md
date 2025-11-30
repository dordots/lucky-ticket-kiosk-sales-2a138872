# 🔒 הגדרת כללי Firestore Rules

## ⚠️ חשוב: לא ניתן לערוך את הכללים מכאן

כללי Firestore Rules **חייבים** להיערך דרך Firebase Console. זה לא אפשרי לערוך אותם דרך קוד.

---

## 🚀 איך לערוך את הכללים (לפיתוח):

### שלב 1: לך ל-Firestore Rules

1. **פתח Firebase Console:**
   - https://console.firebase.google.com/
   - בחר את הפרויקט שלך

2. **פתח Firestore Database:**
   - בתפריט השמאלי, לחץ על **"Firestore Database"**

3. **פתח את הטאב Rules:**
   - לחץ על הטאב **"Rules"** (בחלק העליון)

### שלב 2: החלף את הכללים

**החלף את הקוד הקיים ב:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### שלב 3: שמור

1. לחץ על **"Publish"** (כפתור כחול בחלק העליון)
2. המתן כמה שניות עד שהכללים מתעדכנים

---

## ✅ אחרי זה:

הרץ שוב:
```bash
npm run seed
```

זה אמור לעבוד! 🎉

---

## 🔐 כללים לפרודקשן (אחרי הפיתוח):

לאחר שתסיים את הפיתוח, החלף את הכללים ב:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated users can read/write
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

זה מאפשר רק למשתמשים מחוברים לקרוא ולכתוב.

---

## 📝 הערות:

- **לא ניתן לערוך Rules דרך קוד** - רק דרך Console
- **הכללים מתעדכנים מיידית** אחרי שמירה
- **בדוק את הכללים** לפני פרודקשן

---

## 🆘 בעיות?

אם עדיין יש שגיאות:
1. ודא ששמרת את הכללים (לחצת "Publish")
2. המתן כמה שניות
3. נסה שוב

