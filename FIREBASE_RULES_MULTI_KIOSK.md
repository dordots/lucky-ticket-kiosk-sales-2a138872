# Firebase Security Rules - Multi-Kiosk System

## כללי אבטחה מעודכנים למערכת מרובת קיוסקים

העתק את הכללים הבאים ל-Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserData() {
      return exists(/databases/$(database)/documents/users/$(request.auth.uid)) ?
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data :
             null;
    }
    
    function isSystemManager() {
      return isAuthenticated() && 
             getUserData() != null && 
             getUserData().role == 'system_manager';
    }
    
    function isFranchisee() {
      return isAuthenticated() && 
             getUserData() != null && 
             getUserData().role == 'franchisee';
    }
    
    function isAssistant() {
      return isAuthenticated() && 
             getUserData() != null && 
             getUserData().role == 'assistant';
    }
    
    function getUserKioskId() {
      let userData = getUserData();
      return userData != null ? userData.kiosk_id : null;
    }
    
    function getUserKioskIds() {
      let userData = getUserData();
      return userData != null ? userData.kiosk_ids : null;
    }
    
    function canAccessKiosk(kioskId) {
      let userData = getUserData();
      if (userData == null) return false;
      // System managers can access all kiosks
      // For franchisees and assistants: check if kiosk_id matches
      return userData.role == 'system_manager' ||
             userData.kiosk_id == kioskId;
    }
    
    // Kiosks collection
    match /kiosks/{kioskId} {
      allow read: if isSystemManager() || canAccessKiosk(kioskId);
      allow create: if isSystemManager();
      allow update, delete: if isSystemManager();
    }
    
    // Users collection
    match /users/{userId} {
      allow read, list: if isAuthenticated() && (
        request.auth.uid == userId || 
        isSystemManager() ||
        (isFranchisee() && 
         exists(/databases/$(database)/documents/users/$(userId)) &&
         get(/databases/$(database)/documents/users/$(userId)).data.kiosk_id == getUserKioskId())
      );
      allow create: if isSystemManager() || 
                       (isFranchisee() && 
                        request.resource.data.role == 'assistant' &&
                        request.resource.data.kiosk_id == getUserKioskId());
      allow update: if isSystemManager() || 
                       (isFranchisee() && 
                        resource.data.kiosk_id == getUserKioskId() &&
                        request.resource.data.kiosk_id == getUserKioskId());
      allow delete: if isSystemManager();
    }
    
    // Sales collection
    match /sales/{saleId} {
      allow read: if isAuthenticated() && (
        isSystemManager() || 
        (resource.data.kiosk_id != null && canAccessKiosk(resource.data.kiosk_id))
      );
      allow create: if isAuthenticated() && (
        isSystemManager() || 
        (request.resource.data.kiosk_id != null && canAccessKiosk(request.resource.data.kiosk_id))
      );
      allow update, delete: if isSystemManager() || 
                               (isFranchisee() && resource.data.kiosk_id != null && canAccessKiosk(resource.data.kiosk_id));
    }
    
    // TicketTypes collection
    match /ticketTypes/{ticketId} {
      allow read, list: if isAuthenticated() && (
        isSystemManager() || 
        (resource.data.kiosk_id != null && canAccessKiosk(resource.data.kiosk_id))
      );
      allow create: if isAuthenticated() && (
        isSystemManager() || 
        (isFranchisee() && request.resource.data.kiosk_id != null && canAccessKiosk(request.resource.data.kiosk_id))
      );
      allow update, delete: if isSystemManager() || 
                               (isFranchisee() && resource.data.kiosk_id != null && canAccessKiosk(resource.data.kiosk_id));
    }
    
    // AuditLogs collection
    match /auditLogs/{logId} {
      allow read, list: if isSystemManager() || 
                     (isAuthenticated() && (resource.data.kiosk_id == null || (resource.data.kiosk_id != null && canAccessKiosk(resource.data.kiosk_id))));
      allow create: if isAuthenticated();
      allow update, delete: if false;
    }
    
    // Notifications collection
    match /notifications/{notificationId} {
      allow read: if isAuthenticated() && 
                     resource.data.user_id == request.auth.uid;
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && 
                       resource.data.user_id == request.auth.uid;
      allow delete: if isSystemManager();
    }
  }
}
```

## הוראות עדכון

1. לך ל-[Firebase Console](https://console.firebase.google.com/)
2. בחר את הפרויקט שלך
3. לך ל-Firestore Database > Rules
4. העתק את הכללים למעלה
5. לחץ על "Publish" כדי לשמור

## הערות חשובות

- כללים אלה דורשים שהמשתמשים יהיו עם השדה `role` (system_manager, franchisee, assistant)
- כללים אלה דורשים שכל מכירה וסוג כרטיס יהיו עם `kiosk_id`
- בדוק שהנתונים שלך תואמים למבנה החדש לפני העדכון

