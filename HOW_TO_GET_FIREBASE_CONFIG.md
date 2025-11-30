# 🔍 איך להשיג את פרטי Firebase

## שלב 1: כניסה ל-Firebase Console

1. **לך ל-Firebase Console:**
   - פתח דפדפן ולך ל: https://console.firebase.google.com/
   - התחבר עם חשבון Google שלך

2. **בחר את הפרויקט שלך:**
   - אם יש לך כמה פרויקטים, לחץ על הפרויקט שיצרת

---

## שלב 2: מציאת פרטי התצורה

### דרך 1: Project Settings (הדרך הקלה ביותר)

1. **לחץ על אייקון ההגדרות:**
   - בפינה השמאלית העליונה, לחץ על אייקון **⚙️ Settings** (הגלגל)
   - בחר **"Project settings"**

2. **גלול למטה:**
   - גלול למטה עד שתראה את הכותרת **"Your apps"**
   - אם יש לך כבר אפליקציית Web, תראה אותה שם
   - אם אין, לחץ על אייקון **`</>`** (Web) כדי להוסיף

3. **העתק את פרטי התצורה:**
   - תראה קוד JavaScript שנראה כך:
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
   - **העתק את כל הערכים!**

### דרך 2: מה-Console ישירות

1. **לך ל-Project Settings:**
   - לחץ על ⚙️ Settings > Project settings

2. **בחר את הטאב "General":**
   - אם לא נפתח אוטומטית, לחץ על "General"

3. **גלול למטה ל-"Your apps":**
   - תראה רשימה של אפליקציות
   - אם אין אפליקציית Web, לחץ על **"Add app"** > **"Web"** (`</>`)

4. **העתק את הערכים:**
   - תראה טבלה עם כל הפרטים
   - או קוד JavaScript מלא

---

## שלב 3: הוספת אפליקציית Web (אם עדיין לא)

אם אין לך אפליקציית Web:

1. **לך ל-Project Settings:**
   - ⚙️ Settings > Project settings

2. **גלול למטה ל-"Your apps":**
   - לחץ על **"Add app"** או על אייקון **`</>`** (Web)

3. **הזן שם לאפליקציה:**
   - לדוגמה: "lucky-ticket-app"
   - **אל תסמן** את "Also set up Firebase Hosting" (לעת עתה)

4. **לחץ "Register app"**

5. **העתק את פרטי התצורה:**
   - תראה את הקוד JavaScript
   - העתק את כל הערכים

---

## שלב 4: עדכון הקובץ

1. **פתח את הקובץ:**
   - `src/firebase/config.js`

2. **החלף את הערכים:**
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...", // העתק מה-Console
     authDomain: "your-project.firebaseapp.com", // העתק מה-Console
     projectId: "your-project-id", // העתק מה-Console
     storageBucket: "your-project.appspot.com", // העתק מה-Console
     messagingSenderId: "123456789", // העתק מה-Console
     appId: "1:123456789:web:abcdef" // העתק מה-Console
   };
   ```

3. **שמור את הקובץ**

---

## 📸 איפה בדיוק?

### בתפריט:
```
Firebase Console
  └─ [הפרויקט שלך]
      └─ ⚙️ Settings (בפינה השמאלית העליונה)
          └─ Project settings
              └─ General (טאב)
                  └─ Your apps (גלול למטה)
                      └─ Web app (</>)
                          └─ Config (קוד JavaScript)
```

---

## ⚠️ חשוב!

- **אל תשתף** את פרטי התצורה בפומבי
- **שמור** אותם במקום בטוח
- **העתק בדיוק** - כל תו חשוב!

---

## 🆘 לא מוצא?

אם אתה לא מוצא את הפרטים:

1. **ודא שאתה בפרויקט הנכון:**
   - בדוק את שם הפרויקט בפינה השמאלית העליונה

2. **ודא שיצרת אפליקציית Web:**
   - אם אין, הוסף אחת (ראה "שלב 3" למעלה)

3. **נסה לרענן את הדף:**
   - לפעמים צריך לרענן כדי לראות את השינויים

---

## ✅ סיכום

1. לך ל-Firebase Console
2. בחר את הפרויקט
3. ⚙️ Settings > Project settings
4. גלול למטה ל-"Your apps"
5. העתק את פרטי התצורה
6. עדכן את `src/firebase/config.js`

**זה הכל!** 🎉

