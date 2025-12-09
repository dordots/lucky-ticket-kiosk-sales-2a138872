# Firebase Indexes Required

## Indexes שצריך ליצור ב-Firebase Console

לך ל-[Firebase Console](https://console.firebase.google.com/) > Firestore Database > Indexes

### 1. Notifications Index (Composite)

**Collection:** `notifications`

**Fields:**
- `user_id` (Ascending)
- `is_read` (Ascending)  
- `created_date` (Descending)

**Query Scope:** Collection

**Status:** Create

---

**או** לחץ על הקישור מהשגיאה:
```
https://console.firebase.google.com/v1/r/project/lucky-ticket-kiosk/firestore/indexes?create_composite=Clhwcm9qZWN0cy9sdWNreS10aWNrZXQta2lvc2svZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL25vdGlmaWNhdGlvbnMvaW5kZXhlcy9fEAEaCwoHaXNfcmVhZBABGgsKB3VzZXJfaWQQARoQCgxjcmVhdGVkX2RhdGUQAhoMCghfX25hbWVfXxAC
```

זה ייצור את ה-index אוטומטית.

---

## הערות

- Indexes יכולים לקחת כמה דקות להיווצר
- עד שה-index מוכן, השאילתות עלולות להיכשל
- בדוק את הסטטוס ב-Firestore > Indexes





