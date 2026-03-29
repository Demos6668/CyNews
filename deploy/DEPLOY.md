# CYFY-N Deployment Guide (Debian 12)

## Prerequisites

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install nginx and certbot
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx

# Configure firewall
sudo apt install -y ufw
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Deploy

```bash
# 1. Clone the repo
sudo mkdir -p /opt/cyfy-n
sudo chown $USER:$USER /opt/cyfy-n
git clone https://github.com/Demos6668/CyNews.git /opt/cyfy-n
cd /opt/cyfy-n

# 2. Configure environment
cp .env.example .env
nano .env  # Set POSTGRES_PASSWORD to a strong random value
           # Set CORS_ORIGINS to your domain

# 3. Build and start
docker compose up -d --build

# 4. Verify
curl http://localhost:8080/api/healthz
# Should return {"status":"ok"}

# 5. Trigger initial data fetch
curl -X POST http://localhost:8080/api/scheduler/refresh
```

## Nginx + TLS

```bash
# 1. Install nginx config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/cyfy-n
sudo ln -sf /etc/nginx/sites-available/cyfy-n /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 2. Edit server_name in the config
sudo nano /etc/nginx/sites-available/cyfy-n
# Replace server_name _; with your domain

# 3. Test and reload
sudo nginx -t && sudo systemctl reload nginx

# 4. Get TLS certificate
sudo certbot --nginx -d yourdomain.example.com

# 5. After certbot succeeds, uncomment the HTTPS block in nginx.conf
#    and enable the HTTP->HTTPS redirect
sudo nano /etc/nginx/sites-available/cyfy-n
sudo nginx -t && sudo systemctl reload nginx
```

## Auto-Start on Boot

```bash
sudo cp deploy/cyfy-n.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cyfy-n
```

## Useful Commands

```bash
# View logs
docker compose logs -f api

# Restart
docker compose restart api

# Update
git pull
docker compose up -d --build

# Database backup
docker compose exec db pg_dump -U postgres cynews > backup_$(date +%Y%m%d).sql

# Database restore
cat backup.sql | docker compose exec -T db psql -U postgres cynews
```
