# Recommended Next Steps for Praxis

Based on the current project state (Next.js + Rust API, Auth & User Management implemented), here are the recommended next features to implement, ordered by impact and logical progression.

## ~~1. Public Profile Page (`/profile/[username]`)~~
~~**Why:** You currently collect `username` and display it in settings as `praxis.com/username`, but this route doesn't exist yet.~~
**~~Implementation:~~**
- ~~Create dynamic route `apps/web/src/app/profile/[username]/page.tsx`.~~
- ~~Fetch user public info (display name, avatar, bio - *need to add bio field*).~~
- ~~reuse [Sidebar](file:///Users/lucasroot/projects/praxis/apps/web/src/components/dashboard/Sidebar.tsx#23-131) / [NavBar](file:///Users/lucasroot/projects/praxis/apps/web/src/components/dashboard/NavBar.tsx#19-84) or decided if public pages are layout-free.~~

## 2. Activity Feed / Dashboard Widgets
**Why:** The dashboard currently only shows a "Welcome" card and a "User List". It feels empty.
**Implementation:**
- **System Activity**: "User X joined", "User Y updated their profile".
- **My Activity**: "You logged in from Chrome on Mac".
- Create `ActivityFeedWidget.tsx` and backend endpoint `/activity/recent`.

## 3. Security Settings
**Why:** generic `signup` route exists, implying local password auth, but there is no way to change a password.
**Implementation:**
- Create `apps/web/src/app/settings/security/page.tsx`.
- Add "Change Password" form (Current PW, New PW, Confirm PW).
- Add "Active Sessions" list (using `tower_sessions` data if accessible, or explicit session tracking).

## 4. Admin Enhancements
**Why:** You have basic "Delete User" in the widget for admins. Real apps need more control.
**Implementation:**
- **Role Management**: Allow admins to promote/demote other users.
- **User Search/Filter**: The list will grow; add search by username/email.
- **Admin Layout**: Maybe a specific `/admin` route or just conditionally render more widgets on `/dashboard`.

## 5. Notification System
**Why:** You have a "Notifications" tab in settings that is disabled.
**Implementation:**
- Database table for `notifications`.
- In-app dropdown (bell icon in [NavBar](file:///Users/lucasroot/projects/praxis/apps/web/src/components/dashboard/NavBar.tsx#19-84)).
- Settings page to toggle email vs in-app notifications.

## 6. Database Schema Migration & Type Safety
**Why:** Ensure `sqlx` models match the code.
**Implementation:**
- Verify `schema.sql` (if it exists) is up to date.
- Add `bio` field to `users` table for Profile Page.
- Add `activity_log` table for Dashboard.
