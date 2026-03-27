#!/usr/bin/env bash
# VPS Cleanup & Maintenance Script for montalvo.io
# Automated disk recovery, stale artifact cleanup, and health checks
# Run as root: bash /opt/lapc-invoice-maker/scripts/vps-cleanup.sh
# Safe to run on cron — all operations are idempotent

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; }

TOTAL_FREED=0
STEP=0
TOTAL_STEPS=12

bytes_to_human() {
    local bytes=$1
    if (( bytes >= 1073741824 )); then
        echo "$(awk "BEGIN {printf \"%.1f\", $bytes/1073741824}")GB"
    elif (( bytes >= 1048576 )); then
        echo "$(awk "BEGIN {printf \"%.0f\", $bytes/1048576}")MB"
    else
        echo "$(awk "BEGIN {printf \"%.0f\", $bytes/1024}")KB"
    fi
}

disk_before() {
    df --output=used / | tail -1 | tr -d ' '
}

track_freed() {
    local before=$1
    local after
    after=$(disk_before)
    local freed=$(( (before - after) * 1024 ))
    if (( freed > 0 )); then
        TOTAL_FREED=$(( TOTAL_FREED + freed ))
        ok "Freed $(bytes_to_human $freed)"
    else
        ok "Done (minimal change)"
    fi
}

next_step() {
    STEP=$((STEP + 1))
    log "${STEP}/${TOTAL_STEPS}  $1"
}

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  VPS Cleanup & Maintenance${NC}"
echo -e "${CYAN}  montalvo.io — $(date)${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

DISK_BEFORE=$(disk_before)
log "Disk usage before: $(df -h / | awk 'NR==2 {print $3 " used / " $2 " (" $5 ")"}')"
log "Memory: $(free -h | awk 'NR==2 {print $3 " used / " $2}')"
echo ""

# =======================================================
# SECTION 1: DOCKER CLEANUP
# =======================================================
echo -e "${CYAN}--- Docker Cleanup ---${NC}"

next_step "Pruning Docker build cache..."
snap=$(disk_before)
docker builder prune -a -f 2>/dev/null || true
track_freed "$snap"

next_step "Removing unused Docker images..."
snap=$(disk_before)
docker image prune -a -f 2>/dev/null || true
track_freed "$snap"

next_step "Pruning stopped containers, unused networks, dangling volumes..."
snap=$(disk_before)
docker container prune -f 2>/dev/null || true
docker network prune -f 2>/dev/null || true
docker volume prune -f 2>/dev/null || true
track_freed "$snap"

# =======================================================
# SECTION 2: HOST ARTIFACT CLEANUP
# =======================================================
echo ""
echo -e "${CYAN}--- Host Artifact Cleanup ---${NC}"

next_step "Cleaning stale node_modules and .next from host repos..."
snap=$(disk_before)
# These repos run in Docker — host node_modules/.next are build leftovers
REPOS_IN_DOCKER=(
    "/home/claw/studyapp"
    "/home/claw/pierce-worker-portal"
    "/home/claw/dashboard"
)
for repo in "${REPOS_IN_DOCKER[@]}"; do
    if [ -d "$repo/node_modules" ]; then
        rm -rf "$repo/node_modules"
        log "  Removed $repo/node_modules"
    fi
    if [ -d "$repo/.next" ]; then
        rm -rf "$repo/.next"
        log "  Removed $repo/.next"
    fi
done
track_freed "$snap"

next_step "Clearing npm caches..."
snap=$(disk_before)
rm -rf /home/claw/.npm/_cacache 2>/dev/null || true
rm -rf /root/.npm/_cacache 2>/dev/null || true
mkdir -p /home/claw/.npm/_cacache 2>/dev/null || true
chown -R claw:claw /home/claw/.npm 2>/dev/null || true
mkdir -p /root/.npm/_cacache 2>/dev/null || true
track_freed "$snap"

next_step "Clearing user caches (.cache, .bun, pip)..."
snap=$(disk_before)
rm -rf /home/claw/.cache/* 2>/dev/null || true
rm -rf /home/claw/.bun/install/cache 2>/dev/null || true
rm -rf /home/claw/.local/share/pip/cache 2>/dev/null || true
rm -rf /root/.cache/* 2>/dev/null || true
track_freed "$snap"

# =======================================================
# SECTION 3: SYSTEM CLEANUP
# =======================================================
echo ""
echo -e "${CYAN}--- System Cleanup ---${NC}"

next_step "Cleaning APT cache and removing unused packages..."
snap=$(disk_before)
apt-get clean -y 2>/dev/null || true
apt-get autoremove -y 2>/dev/null || true
track_freed "$snap"

next_step "Vacuuming journald (keeping 7 days)..."
snap=$(disk_before)
journalctl --vacuum-time=7d 2>/dev/null || true
track_freed "$snap"

next_step "Flushing PM2 logs..."
snap=$(disk_before)
if command -v pm2 &>/dev/null; then
    pm2 flush 2>/dev/null || true
elif [ -d /home/claw/.pm2/logs ]; then
    truncate -s 0 /home/claw/.pm2/logs/*.log 2>/dev/null || true
fi
track_freed "$snap"

next_step "Cleaning old rotated logs..."
snap=$(disk_before)
find /var/log -name "*.gz" -mtime +14 -delete 2>/dev/null || true
find /var/log -name "*.old" -mtime +14 -delete 2>/dev/null || true
find /var/log -name "*.[0-9]" -mtime +14 -delete 2>/dev/null || true
track_freed "$snap"

# =======================================================
# SECTION 4: HEALTH CHECKS
# =======================================================
echo ""
echo -e "${CYAN}--- Health Checks ---${NC}"

next_step "Running health checks..."

# Container health
echo ""
log "  Container status:"
docker ps --format '  {{.Names}}: {{.Status}}' 2>/dev/null | while read line; do
    if echo "$line" | grep -q "healthy\|Up"; then
        ok "$line"
    else
        warn "$line"
    fi
done

# Disk usage warning
DISK_PCT=$(df / | awk 'NR==2 {gsub(/%/,""); print $5}')
if (( DISK_PCT > 80 )); then
    err "  Disk usage at ${DISK_PCT}% — investigate large dirs"
elif (( DISK_PCT > 60 )); then
    warn "  Disk usage at ${DISK_PCT}%"
else
    ok "  Disk usage at ${DISK_PCT}%"
fi

# Memory check
MEM_PCT=$(free | awk 'NR==2 {printf "%.0f", $3/$2 * 100}')
if (( MEM_PCT > 85 )); then
    warn "  Memory usage at ${MEM_PCT}%"
else
    ok "  Memory usage at ${MEM_PCT}%"
fi

# Fail2ban status
F2B_BANNED=$(fail2ban-client status sshd 2>/dev/null | grep "Currently banned" | awk '{print $NF}')
if [ -n "$F2B_BANNED" ] && (( F2B_BANNED > 0 )); then
    warn "  Fail2ban: ${F2B_BANNED} IPs currently banned"
else
    ok "  Fail2ban: no active bans"
fi

# SSL cert expiry (via traefik)
if command -v openssl &>/dev/null; then
    CERT_EXPIRY=$(echo | openssl s_client -servername invoice.montalvo.io -connect 127.0.0.1:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ -n "$CERT_EXPIRY" ]; then
        CERT_EPOCH=$(date -d "$CERT_EXPIRY" +%s 2>/dev/null || true)
        NOW_EPOCH=$(date +%s)
        if [ -n "$CERT_EPOCH" ]; then
            DAYS_LEFT=$(( (CERT_EPOCH - NOW_EPOCH) / 86400 ))
            if (( DAYS_LEFT < 14 )); then
                warn "  SSL cert expires in ${DAYS_LEFT} days"
            else
                ok "  SSL cert valid for ${DAYS_LEFT} days"
            fi
        fi
    fi
fi

# Systemd failed units
FAILED=$(systemctl --failed --no-pager --no-legend 2>/dev/null | wc -l)
if (( FAILED > 0 )); then
    warn "  ${FAILED} failed systemd unit(s):"
    systemctl --failed --no-pager --no-legend 2>/dev/null | while read line; do
        warn "    $line"
    done
else
    ok "  No failed systemd units"
fi

# Pending security updates
SECURITY_UPDATES=$(apt list --upgradable 2>/dev/null | grep -c security || true)
if (( SECURITY_UPDATES > 0 )); then
    warn "  ${SECURITY_UPDATES} pending security update(s)"
else
    ok "  System packages up to date"
fi

# =======================================================
# SUMMARY
# =======================================================
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Cleanup Complete${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
log "Disk before: $(bytes_to_human $(( DISK_BEFORE * 1024 )))"
log "Disk after:  $(df -h / | awk 'NR==2 {print $3 " used / " $2 " (" $5 ")"}')"
log "Total freed: $(bytes_to_human $TOTAL_FREED)"
echo ""

log "Docker disk usage:"
docker system df 2>/dev/null || true
echo ""
