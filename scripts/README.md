# סקריפטים להכנסת נתונים ל-Firebase

## הכנת הסקריפט

לפני הרצת הסקריפט, צריך לעדכן את פרטי Firebase:

1. **עדכן את `src/firebase/config.js`** עם פרטי הפרויקט שלך
2. **העתק את הפרטים** לסקריפט `scripts/seed-firebase.js`

או עדכן ישירות ב-`scripts/seed-firebase.js` את ה-`firebaseConfig`.

## הרצת הסקריפט

```bash
npm run seed
```

או:

```bash
node scripts/seed-firebase.js
```

## מה הסקריפט עושה?

הסקריפט יוצר:

1. **2 משתמשים:**
   - בעל עסק (owner@example.com / owner123456)
   - מוכר (seller@example.com / seller123456)

2. **5 סוגי כרטיסים:**
   - כרטיס רגיל (50₪)
   - כרטיס VIP (100₪)
   - כרטיס ילדים (30₪)
   - כרטיס משפחתי (150₪)
   - כרטיס זהב (200₪)

3. **2 מכירות לדוגמה** (אופציונלי)

4. **יומן פעולות** (אופציונלי)

## הערות

- אם משתמש כבר קיים, הסקריפט ידלג עליו
- הסקריפט יוצר נתונים חדשים בכל פעם שהוא רץ
- אפשר להריץ את הסקריפט כמה פעמים - הוא לא ימחק נתונים קיימים

## בעיות?

אם יש שגיאה, ודא ש:
- פרטי Firebase נכונים
- Firestore Database מוגדר
- Authentication מופעל
- Collections נוצרו (sales, ticketTypes, users, auditLogs, notifications)

