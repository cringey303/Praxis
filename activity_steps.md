# Activity Feed & Projects Roadmap

## Vision
Transform the dashboard from a simple welcome screen into a dynamic feed where students can:
1. **Make Posts** - Share updates with images and tag other users
2. **Create Projects** - Post "hiring" opportunities for collaboration

The feed becomes the central hub where students discover opportunities and connect through work.

---

## Phase 1: Foundation (Current Sprint)
**Goal:** Basic posts and projects that appear in a unified feed

### Posts
- [ ] Database: `posts` table (id, author_id, content, image_url, created_at)
- [ ] Database: `post_tags` table for @mentions (post_id, tagged_user_id)
- [ ] API: `POST /posts` - create a post
- [ ] API: `GET /feed` - get posts and projects combined
- [ ] Frontend: Post composer with image upload
- [ ] Frontend: Feed widget on dashboard
- [ ] Frontend: @mention autocomplete (stretch)

### Projects
- [ ] Database: `projects` table (id, owner_id, title, description, image_url, created_at)
- [ ] API: `POST /projects` - create a project
- [ ] API: `GET /projects` - list projects
- [ ] Frontend: Project creation form
- [ ] Frontend: Projects appear in feed with "Project" tag

### Feed
- [ ] Unified feed showing both posts and projects
- [ ] Type filter: All / Posts only / Projects only
- [ ] Chronological ordering (newest first)

---

## Phase 2: Project Details
**Goal:** Projects become full entities with requirements and applications

### Project Enhancements
- [ ] Database: Add fields - `looking_for` (text[]), `team_size`, `majors_needed`, `status` (open/closed)
- [ ] API: `GET /projects/:id` - project detail page
- [ ] API: `PUT /projects/:id` - update project
- [ ] Frontend: Project detail page with full description
- [ ] Frontend: "Looking for" tags display (e.g., "2 CS majors, 1 Designer")

### Applications
- [ ] Database: `project_applications` table (id, project_id, applicant_id, message, status, created_at)
- [ ] API: `POST /projects/:id/apply` - submit application
- [ ] API: `GET /projects/:id/applications` - owner views applications
- [ ] API: `PUT /applications/:id` - accept/reject application
- [ ] Frontend: Apply button and application form
- [ ] Frontend: Owner dashboard to review applications

---

## Phase 3: Teams & Collaboration
**Goal:** Accepted applicants become team members with shared space

### Team Management
- [ ] Database: `project_members` table (project_id, user_id, role, joined_at)
- [ ] API: Team member CRUD
- [ ] Frontend: Team roster on project page
- [ ] Frontend: User's "My Projects" tab showing memberships

### Project Space
- [ ] Database: `project_messages` table for team chat
- [ ] Frontend: Basic project chat/discussion board
- [ ] Frontend: Project tab in user navigation

---

## Phase 4: Discovery & Profiles
**Goal:** Make projects and posts discoverable

### Search & Filtering
- [ ] API: `GET /feed?search=...&major=...&type=...`
- [ ] Frontend: Search bar in feed
- [ ] Frontend: Filter by major/skills needed
- [ ] Frontend: Filter by project status (hiring/full)

### Profile Integration
- [ ] User can showcase projects on profile
- [ ] "Projects" tab on profile shows owned + member projects
- [ ] Posts appear on user's profile
- [ ] Activity shows project joins, posts, etc.

---

## Phase 5: Polish
**Goal:** Notifications, real-time updates, refinements

### Notifications
- [ ] Database: `notifications` table
- [ ] Notify on: @mention, application received, application accepted
- [ ] Frontend: Notification bell in navbar
- [ ] Email notifications (optional)

### Real-time
- [ ] WebSocket for live feed updates
- [ ] Live notification count

### Analytics
- [ ] Project view counts
- [ ] Application statistics for owners

---

## Data Models (Reference)

### posts
```sql
id UUID PRIMARY KEY
author_id UUID REFERENCES users(id)
content TEXT NOT NULL
image_url TEXT
type TEXT DEFAULT 'post'  -- 'post' or 'project_announcement'
created_at TIMESTAMPTZ DEFAULT NOW()
```

### post_tags (for @mentions)
```sql
post_id UUID REFERENCES posts(id)
tagged_user_id UUID REFERENCES users(id)
PRIMARY KEY (post_id, tagged_user_id)
```

### projects
```sql
id UUID PRIMARY KEY
owner_id UUID REFERENCES users(id)
title TEXT NOT NULL
description TEXT
image_url TEXT
status TEXT DEFAULT 'open'  -- 'open', 'closed', 'completed'
looking_for TEXT[]  -- e.g., ['CS major', 'Designer']
team_size INT
created_at TIMESTAMPTZ DEFAULT NOW()
```

### project_applications
```sql
id UUID PRIMARY KEY
project_id UUID REFERENCES projects(id)
applicant_id UUID REFERENCES users(id)
message TEXT
status TEXT DEFAULT 'pending'  -- 'pending', 'accepted', 'rejected'
created_at TIMESTAMPTZ DEFAULT NOW()
```

### project_members
```sql
project_id UUID REFERENCES projects(id)
user_id UUID REFERENCES users(id)
role TEXT DEFAULT 'member'  -- 'owner', 'member'
joined_at TIMESTAMPTZ DEFAULT NOW()
PRIMARY KEY (project_id, user_id)
```
