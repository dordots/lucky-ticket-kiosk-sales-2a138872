# 🔧 תיקון בעיות Firebase

## בעיה 1: Authentication לא מוגדר

### פתרון:

1. **לך ל-Firebase Console:**
   - https://console.firebase.google.com/
   - בחר את הפרויקט שלך

2. **פתח Authentication:**
   - בתפריט השמאלי, לחץ על **"Authentication"**
   - לחץ על **"Get started"** (אם זו הפעם הראשונה)

3. **הפעל Email/Password:**
   - לחץ על הטאב **"Sign-in method"**
   - לחץ על **"Email/Password"**
   - הפעל את המתג **"Enable"**
   - לחץ **"Save"**

---

## בעיה 2: כללי אבטחה של Firestore

### פתרון זמני (לפיתוח):

1. **לך ל-Firestore Database:**
   - בתפריט השמאלי, לחץ על **"Firestore Database"**

2. **פתח את כללי האבטחה:**
   - לחץ על הטאב **"Rules"**

3. **החלף את הכללים:**
   - החלף את הקוד הקיים ב:
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
   - ⚠️ **זה פותח את כל הגישה!** השתמש רק בפיתוח!

4. **שמור:**
   - לחץ **"Publish"**

### פתרון לפרודקשן (מומלץ):

לאחר שתסיים את הפיתוח, החלף ב:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

זה מאפשר רק למשתמשים מחוברים לקרוא ולכתוב.

---

## אחרי התיקון:

1. **הרץ שוב את הסקריפט:**
   ```bash
   npm run seed
   ```

2. **אמור לעבוד!** ✅

---

## סיכום מהיר:

1. ✅ הפעל Email/Password ב-Authentication
2. ✅ שנה את כללי Firestore Rules ל-`allow read, write: if true;` (לפיתוח)
3. ✅ הרץ `npm run seed` שוב

