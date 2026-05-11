<div dir="rtl" align="right">

<div align="center">

# ⏱ TimeIn — מערכת מעקב שעות חכמה

**פלטפורמת Full-Stack לניהול שעות עבודה, בנויה לצוותי פיתוח מודרניים**

[![NestJS](https://img.shields.io/badge/NestJS-v10-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-v19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Railway-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://railway.app/)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![Azure Pipelines](https://img.shields.io/badge/CI%2FCD-Azure_Pipelines-0078D7?style=for-the-badge&logo=azurepipelines&logoColor=white)](https://azure.microsoft.com/en-us/products/devops/pipelines)

[ הדגמה חיה](https://frontend-indol-alpha-93.vercel.app/login)

</div>

---

## משתמש דמו

> ניתן להתחבר ולחקור את המערכת עם הפרטים הבאים:

| שדה | ערך |
|---|---|
| אימייל | `demo@timein.com` |
| סיסמא | `Demo1234` |

---

## צילומי מסך

<div align="center">

### לוח בקרה ראשי
![Dashboard](./docs/screenshots/dashboard.png)

### ניהול רשומות שעות
![Time Entries](./docs/screenshots/timeentries.png)

### ניהול מנהל מערכת
![Admin](./docs/screenshots/admin.png)

### אינטגרציות
![Integrations](./docs/screenshots/integration.png)

</div>

---

##  תוכן עניינים

- [סקירה כללית](#-סקירה-כללית)
- [תכונות מרכזיות](#-תכונות-מרכזיות)
- [טכנולוגיות](#-טכנולוגיות)
- [ארכיטקטורה](#-ארכיטקטורה)
- [התקנה והרצה](#-התקנה-והרצה)
- [תיעוד API](#-תיעוד-api)
- [מבנה הפרויקט](#-מבנה-הפרויקט)
- [CI/CD Pipeline](#-cicd-pipeline)

---

## סקירה כללית

**TimeIn** היא מערכת מעקב שעות ברמת Production, שתוכננה עבור צוותי פיתוח תוכנה.  
המערכת מבטלת עבודה ידנית על ידי **הצעה אוטומטית של רשומות שעות מ-Git commits ומ-ClickUp**, ומעניקה למנהלים תובנות בזמן אמת על ניצול שעות העבודה — בלי להאט את המפתחים.

**עקרונות התכנון:**
- **תיעוד ללא חיכוך** — מילוי אוטומטי של רשומות מפעילות Git קיימת
- **אחריות עם גמישות** — תהליך אישור מובנה (`DRAFT → SUBMITTED → APPROVED`) ללא מיקרו-ניהול
- **תובנות מבוססות נתונים** — זיהוי חריגות שמתריע על ימים חסרים ורשומות ארוכות באופן חריג

---

## תכונות מרכזיות

### מעקב שעות
- טיימר בזמן אמת עם כפתורי play / pause / stop
- יצירת רשומות ידנית עם בחירת פרויקט, משימה וסוג עבודה
- **הצעות חכמות** מ-Git commits ו-ClickUp לכל תאריך נבחר
- העתקת רשומות קיימות לשחזור דפוסים חוזרים
- סיכום שעות יומי / שבועי / חודשי בתצוגה מהירה

### תהליך אישורים
- מחזור חיים מלא: `DRAFT` ← `SUBMITTED` ← `APPROVED / REJECTED`
- מנהלים מאשרים או דוחים הגשות עם הערות
- היסטוריית ביקורת מלאה של כל שינוי סטטוס

### דוחות וניתוח נתונים

| סוג דוח | תיאור |
|---|---|
| לפי עובד | סך שעות מקובץ לפי חבר צוות |
| לפי פרויקט | התפלגות זמן בין פרויקטים |
| לפי משימה | פירוט גרנולרי לפי משימה |
| פירוט יומי | שעות לכל יום עם פירוט עובדים |
| זיהוי חריגות | סימון רשומות ארוכות וימים חסרים |
| ניתוח פערי Git | השוואת פעילות Git מול שעות מתועדות |

###  אינטגרציות
- **Git** — סנכרון commits מכל repository, קישור commits לרשומות שעות, זיהוי פעילות תורמים
- **ClickUp** — סנכרון משימות, שליפת זמנים מוערכים, קישור מזהי ClickUp למשימות פנימיות

###  ניהול צוות
- בקרת גישה מבוססת תפקידים: `ADMIN`, `MANAGER`, `EMPLOYEE`
- מבנה היררכי עם מנהלים המפקחים על קבוצות עובדים
- יצירת משתמשים, הפעלה / השבתה (למנהל מערכת בלבד)

###  התראות
- מרכז התראות פנימי עם מעקב קריא / לא נקרא
- היסטוריית התראות עם pagination

---

##  טכנולוגיות

### Backend
| טכנולוגיה | שימוש |
|---|---|
| **NestJS** | פריימוורק Node.js מודולרי (TypeScript-first) |
| **PostgreSQL + Prisma** | בסיס נתונים רלציוני עם ORM בטיחות-טיפוסים |
| **Redis** | Cache לסשנים ואופטימיזציית ביצועים |
| **JWT + Passport.js** | אותנטיקציה Stateless |
| **Swagger / OpenAPI** | תיעוד API אינטראקטיבי שנוצר אוטומטית |
| **Winston** | Structured logging |
| **Jest** | בדיקות Unit ו-End-to-End |
| **Docker** | Containerization לפריסה |

### Frontend
| טכנולוגיה | שימוש |
|---|---|
| **React 19** | ספריית UI עם concurrent features עדכניים |
| **TypeScript 6** | בטיחות טיפוסים מקצה לקצה |
| **Vite 8** | שרת פיתוח עם HMR מהיר במיוחד |
| **Ant Design 6** | ספריית קומפוננטות UI ברמה ארגונית |
| **Recharts** | ויזואליזציה של נתונים |
| **Zustand** | ניהול State גלובלי קל משקל |
| **React Router v7** | ניתוב בצד הלקוח עם Route Guards |
| **Axios** | HTTP client עם interceptors |
| **Day.js** | מניפולציה של תאריכים ושעות |

### Infrastructure & DevOps
| טכנולוגיה | שימוש |
|---|---|
| **Vercel** | אחסון Frontend עם Preview deployments אוטומטיים |
| **Railway** | אחסון Backend ו-PostgreSQL |
| **Docker** | Containerization לשרת |
| **Azure Pipelines** | CI/CD — lint, בדיקות ו-build בכל push |

---

## ארכיטקטורה

```
┌─────────────────────────────────────────────────────────────┐
│                        דפדפן לקוח                           │
│              React 19 + Ant Design + Zustand                │
│                     פרוס על Vercel                          │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / REST
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    שרת NestJS API                            │
│                   פרוס על Railway                            │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Auth    │  │  שעות    │  │  דוחות   │  │אינטגרציות │  │
│  │  Module  │  │  Module  │  │  Module  │  │  Module   │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │פרויקטים  │  │ משימות   │  │ משתמשים  │  │  טיימר    │  │
│  │  Module  │  │  Module  │  │  Module  │  │  Module   │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
  ┌─────────────────────┐   ┌─────────────────────┐
  │  PostgreSQL (Prisma) │   │    Redis Cache       │
  │   מאוחסן ב-Railway   │   │   (סשן וביצועים)    │
  └─────────────────────┘   └─────────────────────┘
```

---

## התקנה והרצה

### דרישות מקדימות
- Node.js ≥ 20
- Docker & Docker Compose
- מסד נתונים PostgreSQL (או שימוש בסט Docker המצורף)
- Redis instance

### 1. שיבוט הריפוזיטורי

```bash
git clone https://github.com/ella6441/Project-TimeIn-Node-React.git
cd TimeIn
```

### 2. הגדרת משתני סביבה

```bash
# Backend
cp backend/.env.example backend/.env
# ערכי backend/.env עם URL בסיס הנתונים, JWT secrets ו-Redis URL

# Frontend
cp frontend/.env.example frontend/.env
# ערכי frontend/.env עם כתובת ה-API
```

**מפתחות `.env` ל-Backend:**
```env
DATABASE_URL="postgresql://user:password@host:5432/timein"
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"
REDIS_URL="redis://localhost:6379"
PORT=3000
```

**מפתחות `.env` ל-Frontend:**
```env
VITE_API_URL="http://localhost:3000/api"
```

### 3. הפעלה עם Docker (מומלץ)

```bash
cd backend
docker build -t timein-backend .
docker run -p 3000:3000 --env-file .env timein-backend
```

### 4. הפעלה ידנית

```bash
# Backend
cd backend
npm install
npx prisma migrate deploy
npx prisma db seed     # אופציונלי: זריעת נתוני דוגמה
npm run start:dev

# Frontend (טרמינל נפרד)
cd frontend
npm install
npm run dev
```

האפליקציה רצה על:
- **Frontend:** `http://localhost:5173`
- **Backend API:** `http://localhost:3000/api`
- **Swagger Docs:** `http://localhost:3000/api/docs`

---

## תיעוד API

תיעוד Swagger אינטראקטיבי זמין בכתובת `/api/docs` כאשר השרת רץ.

### נקודות קצה — Auth
| Method | נתיב | תיאור |
|---|---|---|
| `POST` | `/api/auth/login` | התחברות וקבלת JWT tokens |
| `POST` | `/api/auth/refresh` | רענון Access Token |
| `POST` | `/api/auth/logout` | ביטול הסשן |

### נקודות קצה — רשומות שעות
| Method | נתיב | תיאור |
|---|---|---|
| `GET` | `/api/time-entries` | רשימת רשומות (מסוננת לפי תאריך, משתמש, סטטוס) |
| `POST` | `/api/time-entries` | יצירת רשומה חדשה |
| `PATCH` | `/api/time-entries/:id` | עדכון רשומה |
| `DELETE` | `/api/time-entries/:id` | מחיקת רשומה |
| `POST` | `/api/time-entries/:id/submit` | הגשה לאישור |
| `POST` | `/api/time-entries/:id/approve` | אישור (מנהל בלבד) |

### נקודות קצה — דוחות
| Method | נתיב | תיאור |
|---|---|---|
| `GET` | `/api/reports/by-employee` | שעות מקובצות לפי עובד |
| `GET` | `/api/reports/by-project` | שעות מקובצות לפי פרויקט |
| `GET` | `/api/reports/by-task` | שעות מקובצות לפי משימה |
| `GET` | `/api/reports/anomalies` | דוח זיהוי חריגות |
| `GET` | `/api/reports/git-gap` | פעילות Git מול שעות מתועדות |

---

## מבנה הפרויקט

```
TimeIn/
├── backend/
│   ├── src/
│   │   ├── auth/              # אותנטיקציה JWT ו-Guards
│   │   ├── users/             # ניהול משתמשים ותפקידים
│   │   ├── projects/          # CRUD פרויקטים
│   │   ├── tasks/             # ניהול משימות
│   │   ├── time-entries/      # לוגיקת תיעוד שעות מרכזית
│   │   ├── timer/             # שירות טיימר בזמן אמת
│   │   ├── reports/           # Analytics ודוחות
│   │   ├── integrations/      # מחברי Git ו-ClickUp
│   │   ├── notifications/     # מערכת התראות
│   │   ├── redis/             # שכבת Caching
│   │   ├── prisma/            # שירות בסיס הנתונים
│   │   └── common/            # Guards, Filters, Middleware
│   ├── prisma/
│   │   ├── schema.prisma      # סכמת בסיס הנתונים
│   │   └── migrations/        # היסטוריית Migrations
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── pages/             # קומפוננטות עמוד ברמת Route
│   │   ├── layouts/           # מעטפת האפליקציה וניווט
│   │   ├── api/               # מודולי API client מוטיפוסים
│   │   ├── router/            # Routes ו-Auth Guards
│   │   ├── store/             # Zustand State Stores
│   │   └── types/             # טיפוסי TypeScript משותפים
│   └── vite.config.ts
│
├── docs/
│   └── screenshots/           # צילומי מסך של האפליקציה
│
└── azure-pipelines.yml        # הגדרת CI/CD Pipeline
```

---

## CI/CD Pipeline

כל push מפעיל את תהליך Azure Pipelines:

```
Push לענף
      │
      ├── שלב Backend
      │     ├── npm install
      │     ├── ESLint
      │     ├── בדיקות Unit (Jest)
      │     └── בניית Artifact
      │
      └── שלב Frontend
            ├── npm install
            ├── ESLint
            └── Vite build
```

Merge ל-`main` מפעיל פריסות אוטומטיות:
- **Frontend** ← Vercel (עם Preview URLs לכל PR)
- **Backend** ← Railway (דרך Docker container)

---

##  אודות המפתחת

**אלה** — מפתחת Full-Stack

[![GitHub](https://img.shields.io/badge/GitHub-ella6441-181717?style=flat-square&logo=github)](https://github.com/ella6441)

---

<div align="center">

נבנה באמצעות NestJS, React ו-PostgreSQL

</div>

</div>
