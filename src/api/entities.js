// Use Firebase instead of base44
import { firebase } from './firebaseClient';

export const TicketType = firebase.entities.TicketType;
export const Sale = firebase.entities.Sale;
export const AuditLog = firebase.entities.AuditLog;
export const Notification = firebase.entities.Notification;
export const User = firebase.entities.User;

// Auth
export const auth = firebase.auth;