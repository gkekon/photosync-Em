# PhotoSync - Wedding Photography Dashboard

## Deployment Guide (Free Hosting)

### Step 1: MongoDB Atlas (Free Database)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Create a free account
3. Create a **FREE** shared cluster (M0)
4. Click "Connect" → "Connect your application"
5. Copy the connection string (looks like: `mongodb+srv://username:password@cluster.xxxxx.mongodb.net/`)
6. Replace `<password>` with your actual password
7. Add `/photosync` at the end: `mongodb+srv://username:password@cluster.xxxxx.mongodb.net/photosync`

**Save this connection string - you'll need it!**

---

### Step 2: Backend Deployment (Render - Free)

1. Go to [Render](https://render.com) and sign up (free)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo (or use "Public Git repository")
4. Configure:
   - **Name:** `photosync-backend`
   - **Region:** Choose closest to you
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`

5. Add **Environment Variables:**
   - `MONGO_URL` = your MongoDB Atlas connection string
   - `DB_NAME` = `photosync`
   - `GOOGLE_CLIENT_ID` = your Google client ID
   - `GOOGLE_CLIENT_SECRET` = your Google client secret

6. Click **"Create Web Service"**
7. Wait for deployment (~5 min)
8. Copy your backend URL (e.g., `https://photosync-backend.onrender.com`)

---

### Step 3: Frontend Deployment (Vercel - Free)

1. Go to [Vercel](https://vercel.com) and sign up (free)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repo
4. Configure:
   - **Framework Preset:** Create React App
   - **Root Directory:** `frontend`

5. Add **Environment Variables:**
   - `REACT_APP_BACKEND_URL` = your Render backend URL (from Step 2)

6. Click **"Deploy"**
7. Wait for deployment (~2 min)
8. Your app is live! 🎉

---

### Step 4: Update Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Go to **APIs & Services → Credentials**
3. Edit your OAuth client
4. Add to **Authorized JavaScript origins:**
   - `https://your-app.vercel.app`
5. Add to **Authorized redirect URIs:**
   - `https://your-app.vercel.app/api/oauth/calendar/callback`
6. Save

---

### Step 5: Connect Custom Domain (Optional)

**In Vercel:**
1. Go to your project → Settings → Domains
2. Add `app.yourdomain.com`
3. Add the DNS records shown to your domain provider

**In Render:**
1. Go to your service → Settings → Custom Domains
2. Add `api.yourdomain.com`
3. Add the DNS records shown

---

### Free Tier Limits

| Service | Free Limit | Notes |
|---------|-----------|-------|
| MongoDB Atlas | 512MB storage | Plenty for thousands of events |
| Render | 750 hrs/month | May sleep after 15 min inactivity |
| Vercel | 100GB bandwidth | More than enough |

---

### Upgrading (Optional)

To remove Render cold starts ($7/month):
- Render → Your service → Settings → Change to "Starter" plan

