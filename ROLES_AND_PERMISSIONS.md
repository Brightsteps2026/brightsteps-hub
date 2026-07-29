# BrightSteps Hub — Roles and Permissions Specification

This document defines who should see and edit what, once the hub has real user accounts. It is written for whoever builds the authentication and access control layer.

## Roles

### 1. Administrator
Full access to every module. Can manage user accounts and assign roles to other staff.

### 2. Teacher
- Full access to: Attendance, Portfolio, Assessment, Gradebook, Planning, Assignments, Behavior, Calendar
- Restricted to their own assigned grade levels and subjects (set on their Staff record)
- Read only access to: Students (only students in their assigned grades), Reports (only for their own students)
- No access to: Admissions, Staff directory (beyond their own profile), Settings

### 3. Learning Assistant
Same as Teacher, but typically without permission to finalize grades or generate official Report Cards. Can log Portfolio entries, Attendance, and Behavior notes for their assigned grades.

### 4. Parent
- Access limited to the Family View for their own linked child or children only
- Can see: their child's Portfolio, Assessments, Attendance summary, Assignments due, Reports, upcoming Calendar events for their child's grade, school wide Communication posts
- Cannot see: other students' data, Staff directory, Admissions, Finance, internal notes
- Read only for everything, cannot edit any record

### 5. Student (future, not yet in current build)
- Access limited to their own Assignments and their own Portfolio, with permission to add reflections
- Cannot see grades, behavior notes, or other students' data

## Data Visibility Rules

| Module | Administrator | Teacher | Learning Assistant | Parent |
|---|---|---|---|---|
| Students | All | Assigned grades only | Assigned grades only | Own child only |
| Staff | All | Own profile only | Own profile only | No access |
| Attendance | All | Assigned grades | Assigned grades | Own child only |
| Portfolio | All | Assigned grades | Assigned grades | Own child only |
| Assessment | All | Assigned grades | Assigned grades | Own child only |
| Gradebook | All | Assigned grades | View only, assigned grades | Own child only |
| Planning | All | Own plans + shared | Own plans + shared | No access |
| Calendar | All | All | All | All (read only) |
| Admissions | All | No access | No access | No access |
| Reports | All | Own students | Own students | Own child only |
| Behavior | All | Assigned grades | Assigned grades | Own child only |
| Communication | Post: Admin only | Read only | Read only | Read only |
| Resources | All | All | All | Parent facing only |
| Settings | Admin only | No access | No access | No access |

## Authentication Requirements

- Email and password based login at minimum, magic link is a good option for parents
- Each user account links to exactly one role
- Teacher and Learning Assistant accounts link to one or more grade levels (from their Staff record)
- Parent accounts link to one or more Student records (a family with multiple children needs multiple links, not multiple accounts)
- Passwords reset via email
- No shared or generic logins per role, every person gets their own account

## Notes for Implementation

- This maps directly onto Supabase Auth plus Row Level Security policies, one policy per table per role
- The current hub stores everything as a single JSON document per data type; a real backend should normalize this into proper relational tables (students, staff, attendance, portfolio_entries, assessments, etc.) with foreign keys, rather than keeping the single blob structure
- Grade level assignment for Teachers and Learning Assistants should live on their user profile so Row Level Security can filter automatically, rather than being checked in application code
