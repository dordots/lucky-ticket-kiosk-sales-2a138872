// Firebase client wrapper to match base44 API structure
import * as salesService from '@/firebase/services/sales';
import * as ticketTypesService from '@/firebase/services/ticketTypes';
import * as usersService from '@/firebase/services/users';
import * as auditLogsService from '@/firebase/services/auditLogs';
import * as notificationsService from '@/firebase/services/notifications';
import * as authService from '@/firebase/services/auth';

// Create a Firebase client that matches base44 API structure
export const firebase = {
  entities: {
    Sale: {
      list: (orderBy = null, limitCount = null) => {
        return salesService.getAllSales(limitCount);
      },
      filter: (filters = {}) => {
        return salesService.getSalesByFilter(filters);
      },
      get: (id) => {
        return salesService.getSaleById(id);
      },
      create: (data) => {
        return salesService.createSale(data);
      },
      update: (id, data) => {
        return salesService.updateSale(id, data);
      },
      delete: (id) => {
        return salesService.deleteSale(id);
      }
    },
    TicketType: {
      list: () => {
        return ticketTypesService.getAllTicketTypes();
      },
      filter: (filters = {}) => {
        return ticketTypesService.getTicketTypesByFilter(filters);
      },
      get: (id) => {
        return ticketTypesService.getTicketTypeById(id);
      },
      create: (data) => {
        return ticketTypesService.createTicketType(data);
      },
      update: (id, data) => {
        return ticketTypesService.updateTicketType(id, data);
      },
      delete: (id) => {
        return ticketTypesService.deleteTicketType(id);
      }
    },
    User: {
      list: () => {
        return usersService.getAllUsers();
      },
      get: (id) => {
        return usersService.getUserById(id);
      },
      update: (id, data) => {
        return usersService.updateUser(id, data);
      }
    },
    AuditLog: {
      list: (orderBy = '-created_date', limitCount = 100) => {
        return auditLogsService.getAllAuditLogs(orderBy, limitCount);
      },
      filter: (filters = {}) => {
        return auditLogsService.getAuditLogsByFilter(filters);
      },
      create: (data) => {
        return auditLogsService.createAuditLog(data);
      }
    },
    Notification: {
      list: (orderBy = '-created_date', limitCount = 100) => {
        return notificationsService.getAllNotifications(orderBy, limitCount);
      },
      filter: (filters = {}) => {
        return notificationsService.getNotificationsByFilter(filters);
      },
      get: (id) => {
        return notificationsService.getNotificationById(id);
      },
      create: (data) => {
        return notificationsService.createNotification(data);
      },
      update: (id, data) => {
        return notificationsService.updateNotification(id, data);
      },
      delete: (id) => {
        return notificationsService.deleteNotification(id);
      }
    }
  },
  auth: {
    me: () => {
      return authService.getCurrentUser();
    },
    login: (email, password) => {
      return authService.signIn(email, password);
    },
    logout: () => {
      return authService.signOutUser();
    },
    setCurrentUser: (userId) => {
      return authService.setCurrentUser(userId);
    },
    getAllUsers: () => {
      return authService.getAllUsers();
    },
    onAuthStateChange: (callback) => {
      return authService.onAuthStateChange(callback);
    },
    createUser: (email, password, userData) => {
      return authService.createUser(email, password, userData);
    },
    changePassword: (currentPassword, newPassword) => {
      return authService.changePassword(currentPassword, newPassword);
    }
  }
};

export default firebase;

